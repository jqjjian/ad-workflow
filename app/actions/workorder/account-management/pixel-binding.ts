'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import {
    PixelBindingRequestSchema,
    ThirdPartyPixelBindingResponseSchema,
    type PixelBindingRequest,
    type ThirdPartyPixelBindingResponse,
    UpdatePixelBindingRequestSchema,
    type UpdatePixelBindingRequest
} from '@/schemas/pixel-binding'
import { generateTaskNumber, generateTraceId } from '@/lib/utils'
import { z } from 'zod'
import { auth } from '@/auth'
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

async function callThirdPartyPixelBindingAPI(
    request: PixelBindingRequest,
    traceId: string
): Promise<ThirdPartyPixelBindingResponse> {
    try {
        const response = await fetch(
            '/openApi/v1/bindPixelApplication/create',
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
        return ThirdPartyPixelBindingResponseSchema.parse(data)
    } catch (error) {
        if (error instanceof ThirdPartyError) {
            throw error
        }

        throw new ThirdPartyError(
            `调用第三方Pixel绑定API失败: ${error instanceof Error ? error.message : '未知错误'}`,
            error
        )
    }
}

async function callThirdPartyUpdatePixelBindingAPI(
    request: UpdatePixelBindingRequest,
    traceId: string
): Promise<ThirdPartyPixelBindingResponse> {
    try {
        const response = await fetch('openApi/v1/bindPixelApplication/update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Trace-Id': traceId
            },
            body: JSON.stringify(request)
        })

        const data = await response.json()
        return ThirdPartyPixelBindingResponseSchema.parse(data)
    } catch (error) {
        if (error instanceof ThirdPartyError) {
            throw error
        }

        throw new ThirdPartyError(
            `调用第三方Pixel绑定更新API失败: ${error instanceof Error ? error.message : '未知错误'}`,
            error
        )
    }
}

export async function createPixelBindingWorkOrder(input: unknown) {
    const traceId = generateTraceId()
    let workOrder: any = null

    try {
        // 验证输入参数
        const validatedInput = await PixelBindingRequestSchema.parseAsync(input)

        // 开启事务
        const result = await db.$transaction(async (tx) => {
            // 1. 调用第三方API
            const thirdPartyResponse = await callThirdPartyPixelBindingAPI(
                validatedInput,
                traceId
            )

            // 2. 先创建工单主记录（因为需要先有ID才能关联）
            workOrder = await tx.tecdo_work_orders.create({
                data: {
                    taskId: thirdPartyResponse.data?.taskId || 'unknown',
                    taskNumber:
                        validatedInput.taskNumber || generateTaskNumber(),
                    userId: 'current-user-id', // 从 session 获取
                    workOrderType: 'ACCOUNT_MANAGEMENT',
                    workOrderSubtype: 'BIND_PIXEL',
                    status:
                        thirdPartyResponse.code === '0' ? 'PENDING' : 'FAILED',
                    metadata: {
                        traceId,
                        platformType: 'FACEBOOK'
                    },
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            })

            // 3. 创建原始数据记录
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

            // 4. 根据第三方API响应确定工单状态
            const initialStatus =
                thirdPartyResponse.code === '0' ? 'PENDING' : 'FAILED'

            // 更新工单的rawDataId
            await tx.tecdo_work_orders.update({
                where: { id: workOrder.id },
                data: { rawDataId: rawData.id }
            })

            // 5. 创建Pixel绑定业务数据 (使用已有的账号绑定表)
            const businessData = await tx.tecdo_account_binding_data.create({
                data: {
                    workOrderId: workOrder.id,
                    mediaAccountId: validatedInput.value, // 保存账号ID
                    mediaPlatform: validatedInput.mediaPlatform.toString(),
                    bindingValue: validatedInput.pixelId, // 存储像素ID
                    bindingRole: validatedInput.role.toString(),
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
                              pixelId: businessData.bindingValue, // 返回像素ID
                              account: businessData.mediaAccountId, // 返回账号ID
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
        return handleError(error, traceId, '创建Pixel绑定')
    }
}

export async function updatePixelBindingWorkOrder(input: unknown) {
    const traceId = generateTraceId()
    let workOrder: any = null

    try {
        // 验证输入参数
        const validatedInput =
            await UpdatePixelBindingRequestSchema.parseAsync(input)

        // 开启事务
        const result = await db.$transaction(async (tx) => {
            // 1. 检查工单是否存在且状态是否允许修改
            workOrder = await tx.tecdo_work_orders.findFirst({
                where: {
                    taskId: validatedInput.taskId,
                    isDeleted: false
                },
                include: {
                    tecdo_account_binding_data: true // 使用正确的模型
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
                await callThirdPartyUpdatePixelBindingAPI(
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

            // 5. 更新Pixel绑定业务数据
            await tx.tecdo_account_binding_data.update({
                where: { id: workOrder.tecdo_account_binding_data.id },
                data: {
                    bindingValue: validatedInput.pixelId, // 更新像素ID
                    bindingRole: validatedInput.role.toString(),
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
        return handleError(error, traceId, '更新Pixel绑定')
    }
}

/**
 * 提交Pixel绑定/解绑工单到第三方接口
 * @param workOrderId 工单ID
 * @returns 操作结果
 */
export async function submitPixelBindingWorkOrderToThirdParty(
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
                pixelId: 'pixel-123',
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
        const { pixelId, bindingType } = workOrder.workOrderParams
        const operation = bindingType === 'bind' ? '绑定' : '解绑'

        // Pixel主要是Facebook/Meta平台才有
        if (
            workOrder.mediaPlatform !== '1' &&
            workOrder.mediaPlatform !== '3'
        ) {
            return {
                success: false,
                message: '该媒体平台不支持Pixel绑定/解绑'
            }
        }

        // 调用Facebook/Meta API
        // thirdPartyResponse = await callFacebookPixelBindingAPI(workOrder.mediaAccountId, pixelId, bindingType)
        thirdPartyResponse = { success: true, operationId: 'fb-pixel-123' }

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
        //     details: `Pixel${operation}提交给第三方平台${thirdPartyResponse.success ? '成功' : '失败'}，操作ID：${thirdPartyResponse.operationId || '无'}`
        // })

        // 刷新相关页面
        revalidatePath('/account/manage')
        revalidatePath('/account/workorders')

        return {
            success: thirdPartyResponse.success,
            message: thirdPartyResponse.success
                ? `Pixel${operation}工单已成功提交给第三方平台`
                : `Pixel${operation}工单提交第三方平台失败`,
            thirdPartyResponse
        }
    } catch (error) {
        console.error('提交Pixel绑定/解绑工单到第三方接口出错:', error)
        return {
            success: false,
            message: '提交Pixel绑定/解绑工单到第三方接口失败'
        }
    }
}
