'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/auth'
import { ValidationError, ThirdPartyError } from '@/utils/business-error'
import { generateTaskNumber, generateTraceId } from '@/lib/utils'
import { v4 as uuidv4 } from 'uuid'
import { UserRole, WorkOrderSubtype } from '@prisma/client'
import { ApproveWorkOrderParams, RejectWorkOrderParams } from './types'

// 创建转账请求的Schema
const TransferRequestSchema = z.object({
    taskNumber: z.string().max(128).optional(),
    mediaPlatform: z.string(),
    sourceAccountId: z.string().min(1, '源账户ID不能为空'),
    targetAccountId: z.string().min(1, '目标账户ID不能为空'),
    amount: z.string().optional(),
    currency: z.string().default('CNY'),
    isMoveAllBalance: z.boolean().default(false),
    remarks: z.string().optional()
})

type TransferRequest = z.infer<typeof TransferRequestSchema>

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

async function callThirdPartyTransferAPI(
    request: TransferRequest,
    traceId: string
) {
    try {
        const response = await fetch('/openApi/v1/mediaAccount/transfer', {
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
            `调用第三方转账API失败: ${error instanceof Error ? error.message : '未知错误'}`,
            error
        )
    }
}

/**
 * 创建转账工单
 * @param input 转账工单参数
 * @returns 操作结果
 */
export async function createTransferWorkOrder(input: unknown) {
    const traceId = generateTraceId()
    let workOrder: any = null

    try {
        // 获取当前用户会话
        const session = await auth()
        if (!session || !session.user) {
            return {
                success: false,
                message: '未登录或会话已过期'
            }
        }

        // 安全地提取用户信息
        const userId = session.user.id
        const username = session.user.name || '系统用户'

        // 检查用户是否存在
        const userExists = await db.tecdo_users.findUnique({
            where: { id: userId }
        })

        // 如果用户不存在，使用备用系统用户
        const actualUserId = userExists ? userId : '系统中已知存在的用户ID'

        // 验证输入参数
        const validatedData = await TransferRequestSchema.parseAsync(input)
        const {
            sourceAccountId,
            targetAccountId,
            mediaPlatform,
            amount,
            currency = 'CNY',
            isMoveAllBalance = false,
            remarks
        } = validatedData

        const taskNumber =
            validatedData.taskNumber ||
            generateTaskNumber('ACCOUNT_MANAGEMENT', 'TRANSFER')

        // 检查源媒体账户是否存在，但不作为工单创建的必要条件
        try {
            const sourceAccount = await db.tecdo_media_accounts.findUnique({
                where: { id: sourceAccountId }
            })

            if (!sourceAccount) {
                console.log(
                    `注意: 源媒体账户ID ${sourceAccountId} 在系统中不存在，但仍将创建工单`
                )
            } else {
                console.log(
                    `源媒体账户ID ${sourceAccountId} 验证通过，继续创建工单`
                )
            }
        } catch (mediaAccountError) {
            console.error(
                '查询源媒体账户时出错，但将继续创建工单:',
                mediaAccountError
            )
        }

        // 检查目标媒体账户是否存在，但不作为工单创建的必要条件
        try {
            const targetAccount = await db.tecdo_media_accounts.findUnique({
                where: { id: targetAccountId }
            })

            if (!targetAccount) {
                console.log(
                    `注意: 目标媒体账户ID ${targetAccountId} 在系统中不存在，但仍将创建工单`
                )
            } else {
                console.log(
                    `目标媒体账户ID ${targetAccountId} 验证通过，继续创建工单`
                )
            }
        } catch (mediaAccountError) {
            console.error(
                '查询目标媒体账户时出错，但将继续创建工单:',
                mediaAccountError
            )
        }

        // 开启事务
        const result = await db.$transaction(async (tx) => {
            // 1. 调用第三方API
            const thirdPartyResponse = await callThirdPartyTransferAPI(
                validatedData,
                traceId
            )

            // 2. 创建工单
            workOrder = await tx.tecdo_work_orders.create({
                data: {
                    taskId: thirdPartyResponse.data?.taskId || 'unknown',
                    taskNumber: taskNumber,
                    userId: actualUserId,
                    workOrderType: 'ACCOUNT_MANAGEMENT',
                    workOrderSubtype: 'TRANSFER',
                    status: 'PENDING',
                    mediaAccountId: sourceAccountId, // 使用源账户作为mediaAccountId
                    metadata: {
                        traceId,
                        platformType: mediaPlatform,
                        sourceAccountId: sourceAccountId,
                        targetAccountId: targetAccountId,
                        amount: amount,
                        currency: currency,
                        isMoveAllBalance: isMoveAllBalance
                    },
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            })

            // 3. 记录工单审计日志
            await tx.tecdo_audit_logs.create({
                data: {
                    id: uuidv4(),
                    entityType: 'WORK_ORDER',
                    entityId: workOrder.id,
                    action: '创建转账工单',
                    performedBy: username,
                    newValue: JSON.stringify({
                        sourceAccountId: sourceAccountId,
                        targetAccountId: targetAccountId,
                        mediaPlatform: mediaPlatform,
                        amount: amount,
                        currency: currency,
                        isMoveAllBalance: isMoveAllBalance
                    }),
                    createdAt: new Date()
                }
            })

            // 4. 尝试创建业务数据记录
            try {
                // 检查是否已存在关联的业务数据
                const existingBusinessData =
                    await tx.tecdo_transfer_business_data.findUnique({
                        where: { workOrderId: workOrder.id }
                    })

                if (existingBusinessData) {
                    console.log(
                        `工单ID ${workOrder.id} 已有关联的业务数据，不再创建新记录`
                    )
                } else {
                    // 创建业务数据记录
                    await tx.tecdo_transfer_business_data.create({
                        data: {
                            workOrderId: workOrder.id,
                            mediaPlatform: mediaPlatform,
                            sourceAccountId: sourceAccountId,
                            targetAccountId: targetAccountId,
                            amount: amount,
                            currency: currency,
                            isMoveAllBalance: isMoveAllBalance,
                            transferStatus: 'PENDING',
                            transferTime: new Date(),
                            completedTime: new Date('9999-12-31'), // 使用远期日期表示尚未完成
                            mediaAccountId: sourceAccountId, // 使用源账户作为mediaAccountId
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }
                    })
                    console.log('转账业务数据创建成功')
                }
            } catch (businessDataError) {
                console.error(
                    '创建转账业务数据时出错，但工单已创建:',
                    businessDataError
                )
                // 记录更详细的错误信息
                await tx.tecdo_error_log.create({
                    data: {
                        id: uuidv4(),
                        entityType: 'TRANSFER_BUSINESS_DATA',
                        entityId: workOrder.id,
                        errorCode: 'BUSINESS_DATA_CREATE_FAILED',
                        errorMessage:
                            businessDataError instanceof Error
                                ? businessDataError.message
                                : '创建业务数据失败',
                        stackTrace:
                            businessDataError instanceof Error
                                ? businessDataError.stack || ''
                                : '',
                        severity: 'ERROR',
                        resolved: false,
                        createdAt: new Date()
                    }
                })
                // 仅记录错误，不中断工单创建流程
            }

            // 返回结果
            return { workOrder, thirdPartyResponse }
        })

        // 刷新相关页面
        revalidatePath('/account/manage')
        revalidatePath('/account/applications')

        // 返回成功信息
        console.log('转账工单创建成功:', {
            workOrderId: result.workOrder.id,
            taskId: result.workOrder.taskId
        })

        return {
            success: true,
            message: '转账工单创建成功',
            data: {
                workOrderId: result.workOrder.id,
                taskId: result.workOrder.taskId
            }
        }
    } catch (error) {
        console.error('创建转账工单出错:', error)

        // 对于Zod验证错误，提供详细的验证失败信息
        if (error instanceof z.ZodError) {
            return {
                success: false,
                message: '参数验证失败',
                errors: error.errors
            }
        }

        return {
            success: false,
            message: error instanceof Error ? error.message : '创建转账工单失败'
        }
    }
}

/**
 * 修改转账工单
 * @param input 包含taskId和需要修改的其他参数
 * @returns 操作结果
 */
export async function updateTransferWorkOrder(input: unknown) {
    const traceId = generateTraceId()
    let workOrder: any = null

    try {
        // 假设有一个更新Schema
        const UpdateTransferRequestSchema = z.object({
            taskId: z.string(),
            amount: z.string().optional(),
            targetAccountId: z.string().optional(),
            isMoveAllBalance: z.boolean().optional(),
            remarks: z.string().optional()
        })

        // 验证输入参数
        const validatedInput =
            await UpdateTransferRequestSchema.parseAsync(input)

        // 开启事务
        const result = await db.$transaction(async (tx) => {
            // 1. 检查工单是否存在且状态是否允许修改
            workOrder = await tx.tecdo_work_orders.findFirst({
                where: {
                    taskId: validatedInput.taskId,
                    isDeleted: false
                },
                include: {
                    tecdo_transfer_business_data: true
                }
            })

            if (!workOrder) {
                throw new Error('工单不存在')
            }

            if (!['PENDING', 'FAILED'].includes(workOrder.status)) {
                throw new Error('当前工单状态不允许修改')
            }

            // 2. 调用第三方API更新转账信息
            const updateRequest = {
                ...validatedInput
                // 注释掉重复的taskId，因为validatedInput已经包含了taskId
                // taskId: validatedInput.taskId,
            }

            const thirdPartyResponse = await callThirdPartyTransferAPI(
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

            // 5. 更新转账业务数据
            const updateData: any = {
                transferStatus: newStatus,
                failureReason:
                    newStatus === 'FAILED' ? thirdPartyResponse.message : null,
                updatedAt: new Date()
            }

            if (validatedInput.amount) {
                updateData.amount = validatedInput.amount
            }

            if (validatedInput.targetAccountId) {
                updateData.targetAccountId = validatedInput.targetAccountId
            }

            if (validatedInput.isMoveAllBalance !== undefined) {
                updateData.isMoveAllBalance = validatedInput.isMoveAllBalance
            }

            await tx.tecdo_transfer_business_data.update({
                where: { id: workOrder.tecdo_transfer_business_data.id },
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
        return handleError(error, traceId, '更新转账工单')
    }
}

/**
 * 提交转账工单到第三方接口
 * @param workOrderId 工单ID
 * @returns 操作结果
 */
export async function submitTransferWorkOrderToThirdParty(
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
            include: { tecdo_transfer_business_data: true }
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
                workOrder.tecdo_transfer_business_data?.mediaPlatform,
            sourceAccountId:
                workOrder.tecdo_transfer_business_data?.sourceAccountId,
            targetAccountId:
                workOrder.tecdo_transfer_business_data?.targetAccountId,
            amount: workOrder.tecdo_transfer_business_data?.amount,
            isMoveAllBalance:
                workOrder.tecdo_transfer_business_data?.isMoveAllBalance,
            action: 'EXECUTE' // 执行转账
        }

        // 调用第三方API
        const thirdPartyResponse = await callThirdPartyTransferAPI(
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

        await db.tecdo_transfer_business_data.update({
            where: { workOrderId },
            data: {
                transferStatus: newStatus,
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
                    ? '工单已成功提交给第三方平台处理'
                    : `提交失败: ${thirdPartyResponse.message}`,
            thirdPartyResponse
        }
    } catch (error) {
        console.error('提交转账工单到第三方接口出错:', error)
        return {
            success: false,
            message: '提交转账工单到第三方接口失败'
        }
    }
}

/**
 * 管理员审批转账工单
 * @param params 审批参数
 * @returns 操作结果
 */
export async function approveTransferWorkOrder(
    params: ApproveWorkOrderParams
): Promise<{
    success: boolean
    message?: string
    data?: { workOrderId: string }
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

        // 验证是否为管理员
        if (
            session.user.role !== UserRole.ADMIN &&
            session.user.role !== UserRole.SUPER_ADMIN
        ) {
            return {
                success: false,
                message: '无权操作，仅管理员可审批工单'
            }
        }

        // 查询工单
        const workOrder = await db.tecdo_work_orders.findUnique({
            where: { id: params.workOrderId }
        })

        // 验证工单是否存在
        if (!workOrder) {
            return {
                success: false,
                message: '工单不存在'
            }
        }

        // 验证工单状态
        if (workOrder.status !== 'PENDING') {
            return {
                success: false,
                message: '只能审批待处理状态的工单'
            }
        }

        // 验证工单类型
        if (workOrder.workOrderSubtype !== 'TRANSFER') {
            return {
                success: false,
                message: '非转账工单，无法进行此操作'
            }
        }

        const username = session.user.name || 'unknown'
        const now = new Date()

        // 更新工单状态为已审批
        await db.tecdo_work_orders.update({
            where: { id: params.workOrderId },
            data: {
                status: 'PROCESSING',
                updatedAt: now,
                remark: params.remarks || workOrder.remark
            }
        })

        // 添加工单日志
        await db.tecdo_audit_logs.create({
            data: {
                id: uuidv4(),
                entityType: 'WORK_ORDER',
                entityId: params.workOrderId,
                action: '审批通过',
                performedBy: username,
                previousValue: JSON.stringify({ status: workOrder.status }),
                newValue: JSON.stringify({
                    status: 'PROCESSING',
                    remarks: params.remarks
                }),
                createdAt: now
            }
        })

        // 刷新相关页面
        revalidatePath('/admin/workorders')

        return {
            success: true,
            message: '转账工单审批成功',
            data: {
                workOrderId: params.workOrderId
            }
        }
    } catch (error) {
        console.error('审批转账工单出错:', error)
        return {
            success: false,
            message: '转账工单审批失败'
        }
    }
}

/**
 * 拒绝转账工单
 * @param params 拒绝参数
 * @returns 操作结果
 */
export async function rejectTransferWorkOrder(
    params: RejectWorkOrderParams
): Promise<{
    success: boolean
    message?: string
    data?: { workOrderId: string }
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

        // 验证是否为管理员
        if (
            session.user.role !== UserRole.ADMIN &&
            session.user.role !== UserRole.SUPER_ADMIN
        ) {
            return {
                success: false,
                message: '无权操作，仅管理员可拒绝工单'
            }
        }

        if (!params.reason) {
            return {
                success: false,
                message: '必须提供拒绝原因'
            }
        }

        // 查询工单
        const workOrder = await db.tecdo_work_orders.findUnique({
            where: { id: params.workOrderId }
        })

        // 验证工单是否存在
        if (!workOrder) {
            return {
                success: false,
                message: '工单不存在'
            }
        }

        // 验证工单状态
        if (workOrder.status !== 'PENDING') {
            return {
                success: false,
                message: '只能拒绝待处理状态的工单'
            }
        }

        // 验证工单类型
        if (workOrder.workOrderSubtype !== 'TRANSFER') {
            return {
                success: false,
                message: '非转账工单，无法进行此操作'
            }
        }

        const username = session.user.name || 'unknown'
        const now = new Date()

        // 更新工单状态为已拒绝
        await db.tecdo_work_orders.update({
            where: { id: params.workOrderId },
            data: {
                status: 'CANCELLED',
                updatedAt: now,
                remark: params.reason
            }
        })

        // 添加工单日志
        await db.tecdo_audit_logs.create({
            data: {
                id: uuidv4(),
                entityType: 'WORK_ORDER',
                entityId: params.workOrderId,
                action: '拒绝工单',
                performedBy: username,
                previousValue: JSON.stringify({ status: workOrder.status }),
                newValue: JSON.stringify({
                    status: 'CANCELLED',
                    reason: params.reason
                }),
                createdAt: now
            }
        })

        // 刷新相关页面
        revalidatePath('/admin/workorders')

        return {
            success: true,
            message: '转账工单已拒绝',
            data: {
                workOrderId: params.workOrderId
            }
        }
    } catch (error) {
        console.error('拒绝转账工单出错:', error)
        return {
            success: false,
            message: '拒绝转账工单失败'
        }
    }
}
