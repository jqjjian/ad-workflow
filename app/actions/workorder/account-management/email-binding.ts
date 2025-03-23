'use server'

import { db } from '@/lib/db'
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
import { auth } from '@/auth'
import { z } from 'zod'
import { ValidationError, ThirdPartyError } from '@/utils/business-error'

// 创建一个统一的错误处理函数
function handleError(error: unknown, traceId: string, operation: string) {
    console.error(`${operation} 失败:`, error)

    if (error instanceof z.ZodError) {
        return {
            code: 'VALIDATION_ERROR',
            message: '参数验证失败',
            data: { errors: error.errors },
            traceId
        }
    }

    if (error instanceof ThirdPartyError) {
        return {
            code: 'THIRD_PARTY_ERROR',
            message: error.message,
            data: error.details,
            traceId
        }
    }

    return {
        code: 'SYSTEM_ERROR',
        message: error instanceof Error ? error.message : '系统错误',
        traceId
    }
}

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
        if (error instanceof ThirdPartyError) {
            throw error
        }

        throw new ThirdPartyError(
            `调用第三方邮箱绑定API失败: ${error instanceof Error ? error.message : '未知错误'}`,
            error
        )
    }
}

async function callThirdPartyUpdateEmailBindingAPI(
    request: UpdateEmailBindingRequest,
    traceId: string
): Promise<ThirdPartyEmailBindingResponse> {
    try {
        const response = await fetch(
            '/openApi/v1/mediaAccount/bindEmailApplication/update',
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
        if (error instanceof ThirdPartyError) {
            throw error
        }

        throw new ThirdPartyError(
            `调用第三方邮箱绑定更新API失败: ${error instanceof Error ? error.message : '未知错误'}`,
            error
        )
    }
}

export async function createEmailBindingWorkOrder(input: unknown) {
    const traceId = generateTraceId()
    let workOrder: any = null

    try {
        // 验证输入参数
        const validatedInput = await EmailBindingRequestSchema.parseAsync(input)

        // 开启事务
        const result = await db.$transaction(async (tx) => {
            // 1. 调用第三方API
            const thirdPartyResponse = await callThirdPartyEmailBindingAPI(
                validatedInput,
                traceId
            )

            // 4. 先创建工单主记录（因为需要先有ID才能关联）
            workOrder = await tx.tecdo_work_orders.create({
                data: {
                    taskId: thirdPartyResponse.data?.taskId || 'unknown',
                    taskNumber:
                        validatedInput.taskNumber || generateTaskNumber(),
                    userId: 'current-user-id', // 从 session 获取
                    workOrderType: 'ACCOUNT_MANAGEMENT',
                    workOrderSubtype: 'BIND_EMAIL',
                    status:
                        thirdPartyResponse.code === '0' ? 'PENDING' : 'FAILED',
                    metadata: {
                        traceId,
                        platformType: 'MSA'
                    },
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            })

            // 2. 创建原始数据记录
            const rawData = await tx.tecdo_raw_data.create({
                data: {
                    requestData: JSON.stringify({
                        ...validatedInput,
                        traceId
                    }),
                    responseData: JSON.stringify(thirdPartyResponse),
                    syncStatus: 'PENDING',
                    syncAttempts: 0,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    tecdo_work_orders: { connect: { id: workOrder.id } }
                }
            })

            // 3. 根据第三方API响应确定工单状态
            const initialStatus =
                thirdPartyResponse.code === '0' ? 'PENDING' : 'FAILED'

            // 更新工单的rawDataId
            await tx.tecdo_work_orders.update({
                where: { id: workOrder.id },
                data: { rawDataId: rawData.id }
            })

            // 5. 创建邮箱绑定业务数据 (使用已有的账号绑定表)
            const businessData = await tx.tecdo_account_binding_data.create({
                data: {
                    workOrderId: workOrder.id,
                    mediaPlatform: validatedInput.mediaPlatform.toString(),
                    mediaAccountId: validatedInput.mediaAccountId,
                    bindingValue: validatedInput.value, // 存储邮箱地址
                    bindingRole: validatedInput.role.toString(), // 转为字符串
                    bindingStatus: initialStatus,
                    bindingTime: new Date(),
                    failureReason:
                        initialStatus === 'FAILED'
                            ? thirdPartyResponse.message
                            : null,
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
                              email: businessData.bindingValue, // 使用bindingValue字段作为邮箱
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
        return handleError(error, traceId, '创建邮箱绑定')
    }
}

export async function updateEmailBindingWorkOrder(input: unknown) {
    const traceId = generateTraceId()
    let workOrder: any = null

    try {
        // 验证输入参数
        const validatedInput =
            await UpdateEmailBindingRequestSchema.parseAsync(input)

        // 开启事务
        const result = await db.$transaction(async (tx) => {
            // 1. 检查工单是否存在且状态是否允许修改
            workOrder = await tx.tecdo_work_orders.findFirst({
                where: {
                    taskId: validatedInput.taskId,
                    isDeleted: false
                },
                include: {
                    tecdo_account_binding_data: true // 使用正确的关联名称
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
                    syncStatus: 'PENDING',
                    syncAttempts: 0,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    tecdo_work_orders: { connect: { id: workOrder.id } }
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
            await tx.tecdo_account_binding_data.update({
                where: { id: workOrder.tecdo_account_binding_data.id },
                data: {
                    bindingValue: validatedInput.value, // 使用bindingValue存储邮箱
                    bindingRole: validatedInput.role.toString(), // 转为字符串
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
        return handleError(error, traceId, '更新邮箱绑定')
    }
}

/**
 * 提交邮箱绑定/解绑工单到第三方接口
 * @param workOrderId 工单ID
 * @returns 操作结果
 */
export async function submitEmailBindingWorkOrderToThirdParty(
    workOrderId: string
): Promise<{
    success: boolean
    message?: string
    thirdPartyResponse?: any
}> {
    try {
        // 获取当前用户会话
        const session = await auth()
        if (!session || !session.user) {
            return {
                success: false,
                message: '未登录或会话已过期'
            }
        }

        // 查询工单详情
        // const workOrder = await db.workOrders.findUnique({
        //     where: { workOrderId }
        // })

        // 模拟工单数据
        const workOrder = {
            workOrderId,
            systemStatus: 'PENDING', // 直接使用字符串
            mediaPlatform: '1', // 修改为字符串类型
            mediaAccountId: 'acc-123',
            workOrderParams: {
                emailAddress: 'test@example.com',
                bindingType: 'bind'
            }
        }

        // 验证工单是否存在且状态为待处理
        if (!workOrder || workOrder.systemStatus !== 'PENDING') {
            return {
                success: false,
                message: '工单不存在或状态非待处理，无法提交'
            }
        }

        const userId = session.user.id || 'unknown'
        const username = session.user.name || 'unknown'

        // 根据媒体平台选择不同的第三方API
        let thirdPartyResponse
        const { emailAddress, bindingType } = workOrder.workOrderParams
        const operation = bindingType === 'bind' ? '绑定' : '解绑'

        switch (workOrder.mediaPlatform) {
            case '1': // Facebook
                // thirdPartyResponse = await callFacebookEmailBindingAPI(workOrder.mediaAccountId, emailAddress, bindingType)
                thirdPartyResponse = {
                    success: true,
                    operationId: 'fb-email-123'
                }
                break
            case '2': // Google
                // thirdPartyResponse = await callGoogleEmailBindingAPI(workOrder.mediaAccountId, emailAddress, bindingType)
                thirdPartyResponse = {
                    success: true,
                    operationId: 'google-email-123'
                }
                break
            case '5': // TikTok
                // thirdPartyResponse = await callTiktokEmailBindingAPI(workOrder.mediaAccountId, emailAddress, bindingType)
                thirdPartyResponse = {
                    success: true,
                    operationId: 'tiktok-email-123'
                }
                break
            default:
                return {
                    success: false,
                    message: '不支持的媒体平台'
                }
        }

        // 更新工单状态
        // await db.workOrders.update({
        //     where: { workOrderId },
        //     data: {
        //         systemStatus: thirdPartyResponse.success ? 'PROCESSING' : 'FAILED',
        //         thirdPartyStatus: thirdPartyResponse.success ? 'PROCESSING' : 'FAILED',
        //         updatedAt: new Date(),
        //         updatedBy: userId,
        //         thirdPartyResponse: JSON.stringify(thirdPartyResponse)
        //     }
        // })

        // 添加工单日志
        // await db.workOrderLogs.create({
        //     id: uuidv4(),
        //     workOrderId,
        //     timestamp: new Date(),
        //     action: thirdPartyResponse.success ? '提交第三方成功' : '提交第三方失败',
        //     operator: username,
        //     details: `邮箱${operation}提交给第三方平台${thirdPartyResponse.success ? '成功' : '失败'}，操作ID：${thirdPartyResponse.operationId || '无'}`
        // })

        // 刷新相关页面
        revalidatePath('/account/manage')
        revalidatePath('/account/workorders')

        return {
            success: thirdPartyResponse.success,
            message: thirdPartyResponse.success
                ? `邮箱${operation}工单已成功提交给第三方平台`
                : `邮箱${operation}工单提交第三方平台失败`,
            thirdPartyResponse
        }
    } catch (error) {
        console.error('提交邮箱绑定/解绑工单到第三方接口出错:', error)
        return {
            success: false,
            message: '提交邮箱绑定/解绑工单到第三方接口失败'
        }
    }
}
