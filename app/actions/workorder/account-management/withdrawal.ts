'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/auth'
import { ValidationError, ThirdPartyError } from '@/utils/business-error'
import { generateTaskNumber, generateTraceId } from '@/lib/utils'

// 创建减款请求的Schema
const WithdrawalRequestSchema = z.object({
    taskNumber: z.string().max(128).optional(),
    mediaPlatform: z.string(),
    mediaAccountId: z.string().min(1, '媒体账号ID不能为空'),
    amount: z.string().min(1, '减款金额不能为空'),
    currency: z.string().default('CNY'),
    remarks: z.string().optional()
})

type WithdrawalRequest = z.infer<typeof WithdrawalRequestSchema>

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

async function callThirdPartyWithdrawalAPI(
    request: WithdrawalRequest,
    traceId: string
) {
    try {
        const response = await fetch('openApi/v1/mediaAccount/withdrawal', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Trace-Id': traceId
            },
            body: JSON.stringify(request)
        })

        const data = await response.json()
        // 假设响应也有特定结构
        return data
    } catch (error) {
        if (error instanceof ThirdPartyError) {
            throw error
        }

        throw new ThirdPartyError(
            `调用第三方减款API失败: ${error instanceof Error ? error.message : '未知错误'}`,
            error
        )
    }
}

/**
 * 创建减款工单
 * @param input 减款工单参数
 * @returns 操作结果
 */
export async function createWithdrawalWorkOrder(input: unknown) {
    const traceId = generateTraceId()
    let workOrder: any = null

    try {
        // 获取当前用户会话
        const session = await auth()
        if (!session || !session.user) {
            return {
                code: 'AUTH_ERROR',
                message: '未登录或会话已过期',
                traceId
            }
        }

        // 安全地提取用户信息
        const userId = session.user?.id || 'system'
        const username = session.user?.name || 'unknown'

        // 验证输入参数
        const parsedInput =
            typeof input === 'object' && input !== null ? input : {}

        // 如果前端传入的是数字类型的 amount，需要转换为字符串
        if (parsedInput && typeof (parsedInput as any).amount === 'number') {
            ;(parsedInput as any).amount = String((parsedInput as any).amount)
        }

        const validatedInput =
            await WithdrawalRequestSchema.parseAsync(parsedInput)

        // 开启事务
        const result = await db.$transaction(async (tx) => {
            // 1. 调用第三方API
            const thirdPartyResponse = await callThirdPartyWithdrawalAPI(
                validatedInput,
                traceId
            )

            // 2. 先创建工单主记录（因为需要先有ID才能关联）
            workOrder = await tx.tecdo_work_orders.create({
                data: {
                    taskId: thirdPartyResponse.data?.taskId || 'unknown',
                    taskNumber:
                        validatedInput.taskNumber || generateTaskNumber(),
                    userId,
                    workOrderType: 'PAYMENT',
                    workOrderSubtype: 'WITHDRAWAL',
                    status:
                        thirdPartyResponse.code === '0' ? 'PENDING' : 'FAILED',
                    metadata: {
                        traceId,
                        platformType: validatedInput.mediaPlatform,
                        username
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

            // 5. 创建减款业务数据
            const businessData = await tx.tecdo_withdrawal_business_data.create(
                {
                    data: {
                        workOrderId: workOrder.id,
                        mediaAccountId: validatedInput.mediaAccountId,
                        mediaPlatform: validatedInput.mediaPlatform,
                        amount: validatedInput.amount,
                        currency: validatedInput.currency,
                        withdrawalStatus: initialStatus,
                        withdrawalTime: new Date(),
                        completedTime: null,
                        failureReason:
                            initialStatus === 'FAILED'
                                ? thirdPartyResponse.message
                                : null,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                }
            )

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
                              amount: businessData.amount,
                              currency: businessData.currency,
                              createdAt: workOrder.createdAt
                          }
                        : undefined,
                traceId
            }
        })

        // 重新验证页面数据
        revalidatePath('/workorder')
        revalidatePath('/account/manage')
        revalidatePath('/account/workorders')
        return result
    } catch (error) {
        return handleError(error, traceId, '创建减款工单')
    }
}

/**
 * 修改减款工单
 * @param input 包含taskId和需要修改的其他参数
 * @returns 操作结果
 */
export async function updateWithdrawalWorkOrder(input: unknown) {
    const traceId = generateTraceId()
    let workOrder: any = null

    try {
        // 获取当前用户会话
        const session = await auth()
        if (!session || !session.user) {
            return {
                code: 'AUTH_ERROR',
                message: '未登录或会话已过期',
                traceId
            }
        }

        // 安全地提取用户信息
        const userId = session.user?.id || 'system'
        const username = session.user?.name || 'unknown'

        // 假设有一个更新Schema
        const UpdateWithdrawalRequestSchema = z.object({
            taskId: z.string(),
            amount: z.string().optional(),
            remarks: z.string().optional()
        })

        // 验证输入参数
        const parsedInput =
            typeof input === 'object' && input !== null ? input : {}

        // 如果前端传入的是数字类型的 amount，需要转换为字符串
        if (parsedInput && typeof (parsedInput as any).amount === 'number') {
            ;(parsedInput as any).amount = String((parsedInput as any).amount)
        }

        const validatedInput =
            await UpdateWithdrawalRequestSchema.parseAsync(parsedInput)

        // 开启事务
        const result = await db.$transaction(async (tx) => {
            // 1. 检查工单是否存在且状态是否允许修改
            workOrder = await tx.tecdo_work_orders.findFirst({
                where: {
                    taskId: validatedInput.taskId,
                    isDeleted: false
                },
                include: {
                    tecdo_withdrawal_business_data: true
                }
            })

            if (!workOrder) {
                throw new Error('工单不存在')
            }

            if (!['PENDING', 'FAILED'].includes(workOrder.status)) {
                throw new Error('当前工单状态不允许修改')
            }

            // 2. 调用第三方API更新减款信息
            const updateRequest = {
                ...validatedInput,
                mediaPlatform:
                    workOrder.tecdo_withdrawal_business_data.mediaPlatform,
                mediaAccountId:
                    workOrder.tecdo_withdrawal_business_data.mediaAccountId
            }

            const thirdPartyResponse = await callThirdPartyWithdrawalAPI(
                updateRequest as any,
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

            // 5. 更新减款业务数据
            const updateData: any = {
                withdrawalStatus: newStatus,
                failureReason:
                    newStatus === 'FAILED' ? thirdPartyResponse.message : null,
                updatedAt: new Date()
            }

            if (validatedInput.amount) {
                updateData.amount = validatedInput.amount
            }

            await tx.tecdo_withdrawal_business_data.update({
                where: { id: workOrder.tecdo_withdrawal_business_data.id },
                data: updateData
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
        revalidatePath('/account/manage')
        revalidatePath('/account/workorders')
        return result
    } catch (error) {
        return handleError(error, traceId, '更新减款工单')
    }
}

/**
 * 提交减款工单到第三方接口
 * @param workOrderId 工单ID
 * @returns 操作结果
 */
export async function submitWithdrawalWorkOrderToThirdParty(
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
        const workOrder = await db.tecdo_work_orders.findFirst({
            where: { id: workOrderId, isDeleted: false },
            include: { tecdo_withdrawal_business_data: true }
        })

        if (!workOrder || workOrder.status !== 'PENDING') {
            return {
                success: false,
                message: '工单不存在或状态非待处理，无法提交'
            }
        }

        const userId = session.user.id || 'unknown'
        const username = session.user.name || 'unknown'

        // 构造第三方请求
        const traceId = generateTraceId()
        const thirdPartyRequest = {
            taskId: workOrder.taskId,
            mediaPlatform:
                workOrder.tecdo_withdrawal_business_data?.mediaPlatform,
            mediaAccountId:
                workOrder.tecdo_withdrawal_business_data?.mediaAccountId,
            amount: workOrder.tecdo_withdrawal_business_data?.amount,
            currency: workOrder.tecdo_withdrawal_business_data?.currency,
            action: 'EXECUTE' // 执行减款
        }

        // 调用第三方API
        const thirdPartyResponse = await callThirdPartyWithdrawalAPI(
            thirdPartyRequest as any,
            traceId
        )

        // 更新工单状态
        const newStatus =
            thirdPartyResponse.code === '0' ? 'PROCESSING' : 'FAILED'

        await db.tecdo_work_orders.update({
            where: { id: workOrderId },
            data: {
                status: newStatus,
                updatedAt: new Date()
            }
        })

        await db.tecdo_withdrawal_business_data.update({
            where: { workOrderId },
            data: {
                withdrawalStatus: newStatus,
                failureReason:
                    newStatus === 'FAILED' ? thirdPartyResponse.message : null,
                updatedAt: new Date()
            }
        })

        // 创建原始数据记录
        await db.tecdo_raw_data.create({
            data: {
                requestData: JSON.stringify({
                    ...thirdPartyRequest,
                    traceId
                }),
                responseData: JSON.stringify(thirdPartyResponse),
                syncStatus: 'PENDING',
                syncAttempts: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
                tecdo_work_orders: { connect: { id: workOrderId } }
            }
        })

        // 刷新相关页面
        revalidatePath('/workorder')
        revalidatePath('/account/manage')
        revalidatePath('/account/workorders')

        return {
            success: thirdPartyResponse.code === '0',
            message:
                thirdPartyResponse.code === '0'
                    ? '减款工单已成功提交给第三方平台处理'
                    : `提交失败: ${thirdPartyResponse.message}`,
            thirdPartyResponse
        }
    } catch (error) {
        console.error('提交减款工单到第三方接口出错:', error)
        return {
            success: false,
            message: '提交减款工单到第三方接口失败'
        }
    }
}
