'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import {
    TransferRequestSchema,
    ThirdPartyTransferResponseSchema,
    type TransferRequest,
    type ThirdPartyTransferResponse,
    UpdateTransferRequestSchema,
    type UpdateTransferRequest
} from '@/schemas/transfer'
import { generateTaskNumber, generateTraceId } from '@/lib/utils'
import { getCurrencyByPlatform } from '@/lib/helpers'

async function callThirdPartyTransferAPI(
    request: TransferRequest,
    traceId: string
): Promise<ThirdPartyTransferResponse> {
    try {
        const response = await fetch('third-party-transfer-api-url', {
            method: 'POST',
            body: JSON.stringify(request)
        })

        const data = await response.json()
        return ThirdPartyTransferResponseSchema.parse(data)
    } catch (error) {
        throw new Error(
            `调用第三方转账API失败: ${error instanceof Error ? error.message : '未知错误'}`
        )
    }
}

async function callThirdPartyUpdateTransferAPI(
    request: UpdateTransferRequest,
    traceId: string
): Promise<ThirdPartyTransferResponse> {
    try {
        const response = await fetch(
            'openApi/v1/mediaAccount/transferApplication/update',
            {
                method: 'POST',
                body: JSON.stringify(request)
            }
        )

        const data = await response.json()
        return ThirdPartyTransferResponseSchema.parse(data)
    } catch (error) {
        throw new Error(
            `调用第三方修改转账API失败: ${error instanceof Error ? error.message : '未知错误'}`
        )
    }
}

export async function createTransferWorkOrder(input: unknown) {
    const traceId = generateTraceId()

    try {
        // 验证输入参数
        const validatedInput = TransferRequestSchema.parse(input)

        // 开启事务
        const result = await prisma.$transaction(async (tx) => {
            // 1. 调用第三方API
            const thirdPartyResponse = await callThirdPartyTransferAPI(
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
                    workOrderSubtype: 'TRANSFER',
                    status: initialStatus,
                    rawDataId: rawData.id,
                    metadata: { traceId },
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            })

            // 5. 创建转账业务数据
            const businessData = await tx.transferBusinessData.create({
                data: {
                    workOrderId: workOrder.id,
                    mediaPlatform: validatedInput.mediaPlatform,
                    sourceAccountId: validatedInput.mediaAccountId,
                    targetAccountId: validatedInput.targetMediaAccountId,
                    amount: validatedInput.amount,
                    currency: getCurrencyByPlatform(
                        validatedInput.mediaPlatform
                    ),
                    isMoveAllBalance: validatedInput.isMoveAllBalance,
                    transferStatus: initialStatus,
                    transferTime: new Date(),
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
                              sourceAccountId: businessData.sourceAccountId,
                              targetAccountId: businessData.targetAccountId,
                              amount: businessData.amount,
                              isMoveAllBalance: businessData.isMoveAllBalance,
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

export async function updateTransferWorkOrder(input: unknown) {
    const traceId = generateTraceId()

    try {
        // 1. 验证输入参数
        const validatedInput = UpdateTransferRequestSchema.parse(input)

        // 开启事务
        const result = await prisma.$transaction(async (tx) => {
            // 2. 查找现有工单
            const existingWorkOrder = await tx.tecdo_work_orders.findFirst({
                where: {
                    taskId: validatedInput.taskId,
                    workOrderSubtype: 'TRANSFER',
                    isDeleted: false
                },
                include: {
                    transferData: true,
                    rawData: true
                }
            })

            if (!existingWorkOrder) {
                throw new Error(`未找到转账工单: ${validatedInput.taskId}`)
            }

            if (!existingWorkOrder.transferData) {
                throw new Error(`工单 ${validatedInput.taskId} 不是转账工单`)
            }

            // 3. 检查工单状态是否可修改
            const modifiableStatuses = ['INIT', 'PENDING']
            if (!modifiableStatuses.includes(existingWorkOrder.status)) {
                throw new Error(
                    `当前工单状态 ${existingWorkOrder.status} 不允许修改`
                )
            }

            // 4. 调用第三方API
            const thirdPartyResponse = await callThirdPartyUpdateTransferAPI(
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
            const updatedBusinessData = await tx.transferBusinessData.update({
                where: { workOrderId: existingWorkOrder.id },
                data: {
                    targetAccountId: validatedInput.targetMediaAccountId,
                    amount: validatedInput.amount,
                    isMoveAllBalance: validatedInput.isMoveAllBalance,
                    transferStatus: newStatus,
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
                              targetAccountId:
                                  updatedBusinessData.targetAccountId,
                              amount: updatedBusinessData.amount,
                              isMoveAllBalance:
                                  updatedBusinessData.isMoveAllBalance,
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
