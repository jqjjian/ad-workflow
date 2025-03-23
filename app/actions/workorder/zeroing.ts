'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import {
    ZeroingRequestSchema,
    ThirdPartyZeroingResponseSchema,
    type ZeroingRequest,
    type ThirdPartyZeroingResponse
} from '@/schemas/zeroing'
import { generateTaskNumber, generateTraceId } from '@/lib/utils'

async function callThirdPartyZeroingAPI(
    request: ZeroingRequest,
    traceId: string
): Promise<ThirdPartyZeroingResponse> {
    try {
        const response = await fetch(
            'openApi/v1/mediaAccount/clearApplication/create',
            {
                method: 'POST',
                body: JSON.stringify(request)
            }
        )

        const data = await response.json()
        return ThirdPartyZeroingResponseSchema.parse(data)
    } catch (error) {
        throw new Error(
            `调用第三方清零API失败: ${error instanceof Error ? error.message : '未知错误'}`
        )
    }
}

export async function createZeroingWorkOrder(input: unknown) {
    const traceId = generateTraceId()

    try {
        // 验证输入参数
        const validatedInput = ZeroingRequestSchema.parse(input)

        // 开启事务
        const result = await prisma.$transaction(async (tx) => {
            // 1. 调用第三方API
            const thirdPartyResponse = await callThirdPartyZeroingAPI(
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
                    workOrderSubtype: 'ZEROING',
                    status: initialStatus,
                    rawDataId: rawData.id,
                    metadata: { traceId },
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            })

            // 5. 创建清零业务数据
            const businessData = await tx.zeroingBusinessData.create({
                data: {
                    workOrderId: workOrder.id,
                    mediaAccountId: validatedInput.mediaAccountId,
                    mediaPlatform: validatedInput.mediaPlatform,
                    zeroingStatus: initialStatus,
                    zeroingTime: new Date(),
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

// 处理清零回调
export async function handleZeroingCallback(callbackData: unknown) {
    const callbackSchema = z.object({
        taskId: z.string(),
        status: z.string(),
        message: z.string().optional()
    })

    try {
        const validatedCallback = callbackSchema.parse(callbackData)

        const result = await prisma.$transaction(async (tx) => {
            // 1. 查找对应的工单
            const workOrder = await tx.tecdo_work_orders.findFirst({
                where: { taskId: validatedCallback.taskId },
                include: { zeroingData: true }
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
            await tx.zeroingBusinessData.update({
                where: { workOrderId: workOrder.id },
                data: {
                    zeroingStatus: newStatus,
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

        // 重新验证页面数据
        revalidatePath('/workorder')
        return result
    } catch (error) {
        return {
            success: false,
            code: 'CALLBACK_ERROR',
            message: error instanceof Error ? error.message : '回调处理失败'
        }
    }
}
