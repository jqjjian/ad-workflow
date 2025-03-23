import { prisma } from '@/lib/prisma'
import {
    DepositRequestSchema,
    ThirdPartyDepositResponseSchema,
    type DepositRequest,
    type ThirdPartyDepositResponse,
    UpdateDepositRequestSchema,
    UpdateDepositResponseSchema,
    type UpdateDepositRequest,
    type UpdateDepositResponse
} from '@/schemas/deposit'
import { generateTaskNumber } from '@/lib/utils'
import { getCurrencyByPlatform } from '@/lib/helpers'

// 调用第三方充值API
async function callThirdPartyDepositAPI(
    request: DepositRequest
): Promise<ThirdPartyDepositResponse> {
    try {
        const response = await fetch('third-party-api-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // 其他必要的headers
            },
            body: JSON.stringify(request)
        })

        const data = await response.json()
        return ThirdPartyDepositResponseSchema.parse(data)
    } catch (error) {
        throw new Error(
            `调用第三方充值API失败: ${error instanceof Error ? error.message : '未知错误'}`
        )
    }
}

// 调用第三方修改充值API
async function callThirdPartyUpdateDepositAPI(
    request: UpdateDepositRequest
): Promise<ThirdPartyDepositResponse> {
    try {
        const response = await fetch('third-party-update-api-url', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
                // 其他必要的headers
            },
            body: JSON.stringify(request)
        })

        const data = await response.json()
        return ThirdPartyDepositResponseSchema.parse(data)
    } catch (error) {
        throw new Error(
            `调用第三方修改充值API失败: ${error instanceof Error ? error.message : '未知错误'}`
        )
    }
}

export async function createDepositWorkOrder(input: unknown) {
    try {
        // 验证输入参数
        const validatedInput = DepositRequestSchema.parse(input)

        // 开启事务
        return await prisma.$transaction(async (tx) => {
            // 1. 调用第三方API
            const thirdPartyResponse =
                await callThirdPartyDepositAPI(validatedInput)

            // 2. 创建原始数据记录
            const rawData = await tx.tecdo_raw_data.create({
                data: {
                    requestData: JSON.stringify(validatedInput),
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
                    taskNumber: generateTaskNumber(),
                    userId: 'current-user-id', // 从 session 获取
                    workOrderType: 'PAYMENT',
                    workOrderSubtype: 'DEPOSIT',
                    status: initialStatus,
                    rawDataId: rawData.id,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            })

            // 5. 创建充值业务数据
            const businessData = await tx.tecdo_deposit_business_data.create({
                data: {
                    workOrderId: workOrder.id,
                    mediaAccountId: validatedInput.mediaAccountId,
                    mediaPlatform: validatedInput.mediaPlatform,
                    amount: validatedInput.amount,
                    currency: getCurrencyByPlatform(
                        validatedInput.mediaPlatform
                    ),
                    dailyBudget: validatedInput.dailyBudget,
                    externalTaskNumber: validatedInput.taskNumber,
                    depositStatus: initialStatus,
                    depositTime: new Date(),
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
                success: thirdPartyResponse.code === '0',
                code: thirdPartyResponse.code,
                message: thirdPartyResponse.message,
                data: {
                    workOrderId: workOrder.id,
                    taskId: workOrder.taskId,
                    externalTaskId: thirdPartyResponse.data?.taskId,
                    status: initialStatus,
                    amount: businessData.amount,
                    currency: businessData.currency,
                    createdAt: workOrder.createdAt
                }
            }
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                success: false,
                code: 'VALIDATION_ERROR',
                message: '参数验证失败',
                data: {
                    errors: error.errors
                }
            }
        }

        return {
            success: false,
            code: 'SYSTEM_ERROR',
            message: error instanceof Error ? error.message : '系统错误'
        }
    }
}

export async function getDepositWorkOrder(workOrderId: string) {
    const workOrder = await prisma.workOrder.findUnique({
        where: {
            id: workOrderId,
            isDeleted: false
        },
        include: {
            rawData: true,
            depositData: true
        }
    })

    if (!workOrder) {
        throw new Error('工单不存在')
    }

    return {
        ...workOrder,
        rawData: {
            ...workOrder.rawData,
            requestData: JSON.parse(workOrder.rawData!.requestData),
            responseData: workOrder.rawData?.responseData
                ? JSON.parse(workOrder.rawData.responseData)
                : null
        }
    }
}

export async function updateDepositWorkOrderStatus(
    workOrderId: string,
    status: string,
    response?: any
) {
    return await prisma.$transaction(async (tx) => {
        // 1. 更新工单状态
        const workOrder = await tx.tecdo_work_orders.update({
            where: { id: workOrderId },
            data: {
                status,
                updatedAt: new Date()
            }
        })

        // 2. 更新业务数据状态
        await tx.tecdo_deposit_business_data.update({
            where: { workOrderId },
            data: {
                depositStatus: status,
                completedTime: status === 'SUCCESS' ? new Date() : undefined,
                failureReason:
                    status === 'FAILED' ? response?.message : undefined,
                updatedAt: new Date()
            }
        })

        // 3. 如果有响应数据，更新原始数据
        if (response) {
            await tx.tecdo_raw_data.update({
                where: { workOrderId },
                data: {
                    responseData: JSON.stringify(response),
                    updatedAt: new Date()
                }
            })
        }

        return workOrder
    })
}

// 处理第三方回调
export async function handleDepositCallback(callbackData: unknown) {
    const callbackSchema = z.object({
        taskId: z.string(),
        status: z.string(),
        message: z.string().optional()
    })

    try {
        const validatedCallback = callbackSchema.parse(callbackData)

        return await prisma.$transaction(async (tx) => {
            // 1. 查找对应的工单
            const workOrder = await tx.tecdo_work_orders.findFirst({
                where: { taskId: validatedCallback.taskId },
                include: { depositData: true }
            })

            if (!workOrder) {
                throw new Error(`未找到对应的工单: ${validatedCallback.taskId}`)
            }

            // 2. 映射状态
            const statusMap: Record<string, string> = {
                success: 'SUCCESS',
                failed: 'FAILED',
                processing: 'PENDING'
            }

            const newStatus =
                statusMap[validatedCallback.status.toLowerCase()] || 'FAILED'

            // 3. 更新工单状态
            await tx.tecdo_work_orders.update({
                where: { id: workOrder.id },
                data: {
                    status: newStatus,
                    updatedAt: new Date()
                }
            })

            // 4. 更新业务数据
            await tx.tecdo_deposit_business_data.update({
                where: { workOrderId: workOrder.id },
                data: {
                    depositStatus: newStatus,
                    completedTime:
                        newStatus === 'SUCCESS' ? new Date() : undefined,
                    failureReason:
                        newStatus === 'FAILED'
                            ? validatedCallback.message
                            : undefined,
                    updatedAt: new Date()
                }
            })

            // 5. 更新原始数据的响应部分
            await tx.tecdo_raw_data.update({
                where: { workOrderId: workOrder.id },
                data: {
                    responseData: JSON.stringify({
                        ...JSON.parse(workOrder.rawData?.responseData || '{}'),
                        callback: callbackData
                    }),
                    updatedAt: new Date()
                }
            })

            return {
                success: true,
                code: '0',
                message: '回调处理成功',
                data: {
                    workOrderId: workOrder.id,
                    status: newStatus
                }
            }
        })
    } catch (error) {
        return {
            success: false,
            code: 'CALLBACK_ERROR',
            message: error instanceof Error ? error.message : '回调处理失败'
        }
    }
}

export async function updateDepositWorkOrder(input: unknown) {
    try {
        // 1. 验证输入参数
        const validatedInput = UpdateDepositRequestSchema.parse(input)

        // 开启事务
        return await prisma.$transaction(async (tx) => {
            // 2. 查找现有工单
            const existingWorkOrder = await tx.tecdo_work_orders.findFirst({
                where: {
                    taskId: validatedInput.taskId,
                    isDeleted: false
                },
                include: {
                    depositData: true
                }
            })

            if (!existingWorkOrder) {
                throw new Error(`未找到工单: ${validatedInput.taskId}`)
            }

            if (!existingWorkOrder.depositData) {
                throw new Error(`工单 ${validatedInput.taskId} 不是充值工单`)
            }

            // 3. 检查工单状态是否可修改
            const modifiableStatuses = ['INIT', 'PENDING']
            if (!modifiableStatuses.includes(existingWorkOrder.status)) {
                throw new Error(
                    `当前工单状态 ${existingWorkOrder.status} 不允许修改`
                )
            }

            // 4. 调用第三方API
            const thirdPartyResponse =
                await callThirdPartyUpdateDepositAPI(validatedInput)

            // 5. 更新原始数据
            await tx.tecdo_raw_data.update({
                where: { workOrderId: existingWorkOrder.id },
                data: {
                    requestData: JSON.stringify({
                        ...JSON.parse(
                            existingWorkOrder.rawData?.requestData || '{}'
                        ),
                        updateRequest: validatedInput
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
                    updatedAt: new Date()
                }
            })

            // 8. 更新业务数据
            const updatedBusinessData = await tx.tecdo_deposit_business_data.update({
                where: { workOrderId: existingWorkOrder.id },
                data: {
                    amount: validatedInput.amount,
                    dailyBudget: validatedInput.dailyBudget,
                    depositStatus: newStatus,
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
                data: {
                    workOrderId: existingWorkOrder.id,
                    taskId: existingWorkOrder.taskId,
                    status: newStatus,
                    amount: updatedBusinessData.amount,
                    currency: updatedBusinessData.currency,
                    dailyBudget: updatedBusinessData.dailyBudget,
                    updatedAt: updatedBusinessData.updatedAt
                }
            }
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                code: 'VALIDATION_ERROR',
                message: '参数验证失败',
                data: {
                    errors: error.errors
                }
            }
        }

        return {
            code: 'SYSTEM_ERROR',
            message: error instanceof Error ? error.message : '系统错误'
        }
    }
}
