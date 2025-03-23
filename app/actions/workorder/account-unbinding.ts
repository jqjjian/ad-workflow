'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import {
    AccountUnbindingRequestSchema,
    ThirdPartyUnbindingResponseSchema,
    type AccountUnbindingRequest,
    type ThirdPartyUnbindingResponse,
    UpdateUnbindingRequestSchema,
    type UpdateUnbindingRequest
} from '@/schemas/account-unbinding'
import { generateTaskNumber, generateTraceId } from '@/lib/utils'

async function callThirdPartyUnbindingAPI(
    request: AccountUnbindingRequest,
    traceId: string
): Promise<ThirdPartyUnbindingResponse> {
    try {
        const response = await fetch(
            'openApi/v1/mediaAccount/unBindIdApplication/create',
            {
                method: 'POST',
                body: JSON.stringify(request)
            }
        )

        const data = await response.json()
        return ThirdPartyUnbindingResponseSchema.parse(data)
    } catch (error) {
        throw new Error(
            `调用第三方解绑API失败: ${error instanceof Error ? error.message : '未知错误'}`
        )
    }
}

async function callThirdPartyUpdateUnbindingAPI(
    request: UpdateUnbindingRequest,
    traceId: string
): Promise<ThirdPartyUnbindingResponse> {
    try {
        const response = await fetch(
            'openApi/v1/mediaAccount/unBindIdApplication/update',
            {
                method: 'POST',
                body: JSON.stringify(request)
            }
        )

        const data = await response.json()
        return ThirdPartyUnbindingResponseSchema.parse(data)
    } catch (error) {
        throw new Error(
            `调用第三方修改解绑API失败: ${error instanceof Error ? error.message : '未知错误'}`
        )
    }
}

export async function createAccountUnbindingWorkOrder(input: unknown) {
    const traceId = generateTraceId()

    try {
        // 验证输入参数
        const validatedInput =
            await AccountUnbindingRequestSchema.parseAsync(input)

        // 开启事务
        const result = await prisma.$transaction(async (tx) => {
            // 1. 调用第三方API
            const thirdPartyResponse = await callThirdPartyUnbindingAPI(
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
                    workOrderType: 'ACCOUNT_MANAGEMENT',
                    workOrderSubtype: 'UNBIND_ACCOUNT',
                    status: initialStatus,
                    rawDataId: rawData.id,
                    metadata: {
                        traceId,
                        platformType:
                            validatedInput.mediaPlatform === 1 ? 'BM' : 'MCC'
                    },
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            })

            // 5. 创建解绑业务数据
            const businessData = await tx.accountUnbindingData.create({
                data: {
                    workOrderId: workOrder.id,
                    mediaPlatform: validatedInput.mediaPlatform.toString(),
                    mediaAccountId: validatedInput.mediaAccountId,
                    unbindingValue: validatedInput.value,
                    unbindingStatus: initialStatus,
                    unbindingTime: new Date(),
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
                              mediaPlatform: businessData.mediaPlatform,
                              mediaAccountId: businessData.mediaAccountId,
                              unbindingValue: businessData.unbindingValue,
                              createdAt: workOrder.createdAt
                          }
                        : undefined,
                traceId
            }
        })

        // 重新验证页面数据
        revalidatePath('/workorder')
        return result
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

export async function updateAccountUnbindingWorkOrder(input: unknown) {
    const traceId = generateTraceId()

    try {
        // 1. 验证输入参数
        const validatedInput =
            await UpdateUnbindingRequestSchema.parseAsync(input)

        // 开启事务
        const result = await prisma.$transaction(async (tx) => {
            // 2. 查找现有工单
            const existingWorkOrder = await tx.tecdo_work_orders.findFirst({
                where: {
                    taskId: validatedInput.taskId,
                    workOrderSubtype: 'UNBIND_ACCOUNT',
                    isDeleted: false
                },
                include: {
                    accountUnbindingData: true,
                    rawData: true
                }
            })

            if (!existingWorkOrder) {
                throw new Error(`未找到解绑工单: ${validatedInput.taskId}`)
            }

            if (!existingWorkOrder.accountUnbindingData) {
                throw new Error(`工单 ${validatedInput.taskId} 不是解绑工单`)
            }

            // 3. 检查工单状态是否可修改
            const modifiableStatuses = ['INIT', 'PENDING', 'RETURNED']
            if (!modifiableStatuses.includes(existingWorkOrder.status)) {
                throw new Error(
                    `当前工单状态 ${existingWorkOrder.status} 不允许修改`
                )
            }

            // 4. 调用第三方API
            const thirdPartyResponse = await callThirdPartyUpdateUnbindingAPI(
                validatedInput,
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
                        updateResponse: thirdPartyResponse
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
                        lastUpdateTraceId: traceId
                    },
                    updatedAt: new Date()
                }
            })

            // 8. 更新业务数据
            const updatedBusinessData = await tx.accountUnbindingData.update({
                where: { workOrderId: existingWorkOrder.id },
                data: {
                    unbindingValue: validatedInput.value,
                    unbindingStatus: newStatus,
                    failureReason:
                        newStatus === 'FAILED'
                            ? thirdPartyResponse.message
                            : null,
                    updatedAt: new Date()
                }
            })

            return {
                code: thirdPartyResponse.code,
                message: thirdPartyResponse.message,
                data:
                    thirdPartyResponse.code === '0'
                        ? {
                              workOrderId: existingWorkOrder.id,
                              taskId: existingWorkOrder.taskId,
                              status: newStatus,
                              unbindingValue:
                                  updatedBusinessData.unbindingValue,
                              updatedAt: updatedBusinessData.updatedAt
                          }
                        : undefined,
                traceId
            }
        })

        // 重新验证页面数据
        revalidatePath('/workorder')
        return result
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
