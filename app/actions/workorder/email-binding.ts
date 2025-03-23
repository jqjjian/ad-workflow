'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import {
    EmailBindingRequestSchema,
    ThirdPartyEmailBindingResponseSchema,
    type EmailBindingRequest,
    type ThirdPartyEmailBindingResponse,
    UpdateEmailBindingRequestSchema,
    type UpdateEmailBindingRequest
} from '@/schemas/email-binding'
import { generateTaskNumber, generateTraceId } from '@/lib/utils'

async function callThirdPartyEmailBindingAPI(
    request: EmailBindingRequest,
    traceId: string
): Promise<ThirdPartyEmailBindingResponse> {
    try {
        const response = await fetch(
            'openApi/v1/mediaAccount/bindEmailApplication/create',
            {
                method: 'POST',
                body: JSON.stringify(request)
            }
        )

        const data = await response.json()
        return ThirdPartyEmailBindingResponseSchema.parse(data)
    } catch (error) {
        throw new Error(
            `调用第三方邮箱绑定API失败: ${error instanceof Error ? error.message : '未知错误'}`
        )
    }
}

async function callThirdPartyUpdateEmailBindingAPI(
    request: UpdateEmailBindingRequest,
    traceId: string
): Promise<ThirdPartyEmailBindingResponse> {
    try {
        const response = await fetch(
            'openApi/v1/mediaAccount/bindEmailApplication/update',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Trace-Id': traceId
                },
                body: JSON.stringify(request)
            }
        )

        const data = await response.json()
        return ThirdPartyEmailBindingResponseSchema.parse(data)
    } catch (error) {
        throw new Error(
            `调用第三方邮箱绑定更新API失败: ${error instanceof Error ? error.message : '未知错误'}`
        )
    }
}

export async function createEmailBindingWorkOrder(input: unknown) {
    const traceId = generateTraceId()

    try {
        // 验证输入参数
        const validatedInput = await EmailBindingRequestSchema.parseAsync(input)

        // 开启事务
        const result = await prisma.$transaction(async (tx) => {
            // 1. 调用第三方API
            const thirdPartyResponse = await callThirdPartyEmailBindingAPI(
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
                    workOrderSubtype: 'BIND_EMAIL',
                    status: initialStatus,
                    rawDataId: rawData.id,
                    metadata: {
                        traceId,
                        platformType: 'MSA'
                    },
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            })

            // 5. 创建邮箱绑定业务数据
            const businessData = await tx.emailBindingData.create({
                data: {
                    workOrderId: workOrder.id,
                    mediaPlatform: validatedInput.mediaPlatform.toString(),
                    mediaAccountId: validatedInput.mediaAccountId,
                    email: validatedInput.value,
                    bindingRole: validatedInput.role,
                    bindingStatus: initialStatus,
                    bindingTime: new Date(),
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
                              email: businessData.email,
                              bindingRole: businessData.bindingRole,
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

export async function updateEmailBindingWorkOrder(input: unknown) {
    const traceId = generateTraceId()

    try {
        // 验证输入参数
        const validatedInput =
            await UpdateEmailBindingRequestSchema.parseAsync(input)

        // 开启事务
        const result = await prisma.$transaction(async (tx) => {
            // 1. 检查工单是否存在且状态是否允许修改
            const workOrder = await tx.tecdo_work_orders.findFirst({
                where: {
                    taskId: validatedInput.taskId,
                    isDeleted: false
                },
                include: {
                    emailBindingData: true
                }
            })

            if (!workOrder) {
                throw new Error('工单不存在')
            }

            if (!['PENDING', 'FAILED'].includes(workOrder.status)) {
                throw new Error('当前工单状态不允许修改')
            }

            // 2. 调用第三方API
            const thirdPartyResponse =
                await callThirdPartyUpdateEmailBindingAPI(
                    validatedInput,
                    traceId
                )

            // 3. 创建新的原始数据记录
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

            // 4. 更新工单状态
            const newStatus =
                thirdPartyResponse.code === '0' ? 'PENDING' : 'FAILED'

            await tx.tecdo_work_orders.update({
                where: { id: workOrder.id },
                data: {
                    status: newStatus,
                    rawDataId: rawData.id,
                    updatedAt: new Date()
                }
            })

            // 5. 更新邮箱绑定业务数据
            await tx.emailBindingData.update({
                where: { id: workOrder.emailBindingData.id },
                data: {
                    email: validatedInput.value,
                    bindingRole: validatedInput.role,
                    bindingStatus: newStatus,
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
                              taskId: workOrder.taskId,
                              status: newStatus
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
