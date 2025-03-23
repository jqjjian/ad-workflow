import { prisma } from '@/lib/prisma'
import {
    WithdrawalRequestSchema,
    ThirdPartyWithdrawalResponseSchema,
    type WithdrawalRequest,
    type ThirdPartyWithdrawalResponse,
    UpdateWithdrawalRequestSchema
} from '@/schemas/withdrawal'
import { generateTaskNumber, generateTraceId } from '@/lib/utils'
import { getCurrencyByPlatform } from '@/lib/helpers'
import { z } from 'zod'

// 调用第三方减款API
async function callThirdPartyWithdrawalAPI(
    request: WithdrawalRequest,
    traceId: string
): Promise<ThirdPartyWithdrawalResponse> {
    try {
        const response = await fetch('third-party-withdrawal-api-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Trace-Id': traceId
                // 其他必要的headers
            },
            body: JSON.stringify(request)
        })

        const data = await response.json()
        return ThirdPartyWithdrawalResponseSchema.parse(data)
    } catch (error) {
        throw new Error(
            `调用第三方减款API失败: ${error instanceof Error ? error.message : '未知错误'}`
        )
    }
}

// 调用第三方修改减款API
async function callThirdPartyUpdateWithdrawalAPI(
    request: UpdateWithdrawalRequest,
    accessToken: string,
    traceId: string
): Promise<ThirdPartyWithdrawalResponse> {
    try {
        const response = await fetch(
            'openApi/v1/mediaAccount/deductApplication/update',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Token': accessToken,
                    'Trace-Id': traceId
                },
                body: JSON.stringify(request)
            }
        )

        // 获取响应头中的 Trace-Id
        const responseTraceId = response.headers.get('Trace-Id')

        const data = await response.json()

        // 保存响应的 Trace-Id
        if (responseTraceId) {
            data.traceId = responseTraceId
        }

        return ThirdPartyWithdrawalResponseSchema.parse(data)
    } catch (error) {
        throw new Error(
            `调用第三方修改减款API失败: ${error instanceof Error ? error.message : '未知错误'}`
        )
    }
}

export async function createWithdrawalWorkOrder(input: unknown) {
    const traceId = generateTraceId()

    try {
        // 验证输入参数
        const validatedInput = WithdrawalRequestSchema.parse(input)

        // 开启事务
        return await prisma.$transaction(async (tx) => {
            // 1. 调用第三方API
            const thirdPartyResponse = await callThirdPartyWithdrawalAPI(
                validatedInput,
                traceId
            )

            // 2. 创建原始数据记录
            const rawData = await tx.tecdo_raw_data.create({
                data: {
                    requestData: JSON.stringify({
                        ...validatedInput,
                        traceId
                    }),
                    responseData: JSON.stringify(thirdPartyResponse),
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            })

            // 3. 根据第三方API响应确定工单状态
            const initialStatus =
                thirdPartyResponse.code === '0' ? 'PENDING' : 'FAILED'

            // 4. 创建工单主记录
            const workOrder = await tx.tecdo_work_orders.create({
                data: {
                    taskId: thirdPartyResponse.data?.taskId || 'unknown',
                    taskNumber:
                        validatedInput.taskNumber || generateTaskNumber(),
                    userId: 'current-user-id', // 从 session 获取
                    workOrderType: 'PAYMENT',
                    workOrderSubtype: 'WITHDRAWAL',
                    status: initialStatus,
                    rawDataId: rawData.id,
                    metadata: { traceId },
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            })

            // 5. 创建减款业务数据
            const businessData = await tx.tecdo_withdrawal_business_data.create({
                data: {
                    workOrderId: workOrder.id,
                    mediaAccountId: validatedInput.mediaAccountId,
                    mediaPlatform: validatedInput.mediaPlatform,
                    amount: validatedInput.amount,
                    currency: getCurrencyByPlatform(
                        validatedInput.mediaPlatform
                    ),
                    withdrawalStatus: initialStatus,
                    withdrawalTime: new Date(),
                    failureReason:
                        initialStatus === 'FAILED'
                            ? thirdPartyResponse.message
                            : undefined,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            })

            // 6. 更新工单记录的业务数据ID
            await tx.tecdo_work_orders.update({
                where: { id: workOrder.id },
                data: { businessDataId: businessData.id }
            })

            // 7. 构建响应数据
            return {
                code: thirdPartyResponse.code,
                message: thirdPartyResponse.message,
                data:
                    thirdPartyResponse.code === '0'
                        ? {
                              workOrderId: workOrder.id,
                              taskId: workOrder.taskId,
                              externalTaskId: thirdPartyResponse.data?.taskId,
                              status: initialStatus,
                              amount: businessData.amount,
                              currency: businessData.currency,
                              createdAt: workOrder.createdAt
                          }
                        : undefined,
                traceId
            }
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                code: 'VALIDATION_ERROR',
                message: '参数验证失败',
                data: {
                    errors: error.errors
                },
                traceId
            }
        }

        return {
            code: 'SYSTEM_ERROR',
            message: error instanceof Error ? error.message : '系统错误',
            traceId
        }
    }
}

export async function updateWithdrawalWorkOrder(
    input: unknown,
    accessToken: string
) {
    const traceId = generateTraceId()

    try {
        // 1. 验证输入参数
        const validatedInput = UpdateWithdrawalRequestSchema.parse(input)

        // 开启事务
        return await prisma.$transaction(async (tx) => {
            // 2. 查找现有工单
            const existingWorkOrder = await tx.tecdo_work_orders.findFirst({
                where: {
                    taskId: validatedInput.taskId,
                    workOrderSubtype: 'WITHDRAWAL',
                    isDeleted: false
                },
                include: {
                    withdrawalData: true,
                    rawData: true
                }
            })

            if (!existingWorkOrder) {
                throw new Error(`未找到减款工单: ${validatedInput.taskId}`)
            }

            if (!existingWorkOrder.withdrawalData) {
                throw new Error(`工单 ${validatedInput.taskId} 不是减款工单`)
            }

            // 3. 检查工单状态是否可修改
            const modifiableStatuses = ['INIT', 'PENDING']
            if (!modifiableStatuses.includes(existingWorkOrder.status)) {
                throw new Error(
                    `当前工单状态 ${existingWorkOrder.status} 不允许修改`
                )
            }

            // 4. 调用第三方API
            const thirdPartyResponse = await callThirdPartyUpdateWithdrawalAPI(
                validatedInput,
                accessToken,
                traceId
            )

            // 5. 更新原始数据
            await tx.tecdo_raw_data.update({
                where: { workOrderId: existingWorkOrder.id },
                data: {
                    requestData: JSON.stringify({
                        ...JSON.parse(
                            existingWorkOrder.rawData?.requestData || '{}'
                        ),
                        updateRequest: {
                            ...validatedInput,
                            traceId
                        }
                    }),
                    responseData: JSON.stringify({
                        ...JSON.parse(
                            existingWorkOrder.rawData?.responseData || '{}'
                        ),
                        updateResponse: {
                            ...thirdPartyResponse,
                            traceId: thirdPartyResponse.traceId
                        }
                    }),
                    updatedAt: new Date()
                }
            })

            // 6. 根据API响应确定工单状态
            const newStatus =
                thirdPartyResponse.code === '0' ? 'PENDING' : 'FAILED'

            // 7. 更新工单状态
            await tx.tecdo_work_orders.update({
                where: { id: existingWorkOrder.id },
                data: {
                    status: newStatus,
                    metadata: {
                        ...existingWorkOrder.metadata,
                        lastUpdateTraceId: traceId,
                        responseTraceId: thirdPartyResponse.traceId
                    },
                    updatedAt: new Date()
                }
            })

            // 8. 更新业务数据
            const updatedBusinessData = await tx.tecdo_withdrawal_business_data.update({
                where: { workOrderId: existingWorkOrder.id },
                data: {
                    amount: validatedInput.amount,
                    withdrawalStatus: newStatus,
                    failureReason:
                        newStatus === 'FAILED'
                            ? thirdPartyResponse.message
                            : null,
                    updatedAt: new Date()
                }
            })

            // 9. 构建响应数据
            return {
                code: thirdPartyResponse.code,
                message: thirdPartyResponse.message,
                data:
                    thirdPartyResponse.code === '0'
                        ? {
                              workOrderId: existingWorkOrder.id,
                              taskId: existingWorkOrder.taskId,
                              status: newStatus,
                              amount: updatedBusinessData.amount,
                              currency: updatedBusinessData.currency,
                              updatedAt: updatedBusinessData.updatedAt
                          }
                        : undefined,
                traceId: thirdPartyResponse.traceId || traceId
            }
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                code: 'VALIDATION_ERROR',
                message: '参数验证失败',
                data: {
                    errors: error.errors
                },
                traceId
            }
        }

        return {
            code: 'SYSTEM_ERROR',
            message: error instanceof Error ? error.message : '系统错误',
            traceId
        }
    }
}
