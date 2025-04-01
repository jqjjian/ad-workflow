'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/auth'
import { ValidationError, ThirdPartyError } from '@/utils/business-error'
import { generateTaskNumber, generateTraceId } from '@/lib/utils'
import { v4 as uuidv4 } from 'uuid'
import { API_BASE_URL, callExternalApi } from '@/lib/request'
import { UserRole, WorkOrderSubtype } from '@prisma/client'
import { ApproveWorkOrderParams, RejectWorkOrderParams } from './types'

// 创建转账请求的Schema
const TransferRequestSchema = z
    .object({
        taskNumber: z.string().max(128).optional(),
        mediaPlatform: z.string(), // 接口需要Int类型，但我们接收string后在内部转换
        targetMediaPlatform: z.string().optional(),
        sourceAccountId: z.string().min(1, '源账户ID不能为空'), // 对应第三方接口的mediaAccountId
        sourceAccountName: z.string().optional(), // 扩展字段，记录源账户名称
        targetAccountId: z.string().min(1, '目标账户ID不能为空'), // 对应第三方接口的targetMediaAccountId
        targetAccountName: z.string().optional(), // 扩展字段，记录目标账户名称
        amount: z.string().optional(), // 根据isMoveAllBalance值决定是否必填
        currency: z.string().default('CNY'),
        isMoveAllBalance: z.boolean().default(false),
        remarks: z.string().optional()
    })
    .refine(
        (data) => {
            // 当isMoveAllBalance为false时，amount必填
            if (data.isMoveAllBalance === false && !data.amount) {
                return false
            }
            return true
        },
        {
            message: '当不转出所有金额时，必须指定转账金额',
            path: ['amount']
        }
    )

type TransferRequest = z.infer<typeof TransferRequestSchema>

// 明确定义创建转账工单的输入参数类型
export interface TransferWorkOrderInput {
    taskNumber?: string
    mediaPlatform: string | number // 支持字符串或数字，内部会转换
    targetMediaPlatform?: string | number
    sourceAccountId: string // 源媒体账号ID
    sourceAccountName?: string // 源媒体账号名称
    targetAccountId: string // 目标媒体账号ID
    targetAccountName?: string // 目标媒体账号名称
    amount?: string // 转账金额，isMoveAllBalance为false时必填
    currency?: string // 默认CNY
    isMoveAllBalance?: boolean // 默认false
    remarks?: string // 备注信息
}

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
        const response = await fetch(
            `${API_BASE_URL}/openApi/v1/mediaAccount/transfer`,
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
 * @param input 转账工单参数对象，包含源账户、目标账户、金额等信息
 * @returns 操作结果
 */
export async function createTransferWorkOrder(input: TransferWorkOrderInput) {
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

        // 验证输入参数 - 转换数字类型为字符串以满足Zod验证
        const processedInput = {
            ...input,
            mediaPlatform: String(input.mediaPlatform),
            targetMediaPlatform: input.targetMediaPlatform
                ? String(input.targetMediaPlatform)
                : undefined
        }

        // 验证输入参数
        const validatedData =
            await TransferRequestSchema.parseAsync(processedInput)
        const {
            sourceAccountId,
            sourceAccountName,
            targetAccountId,
            targetAccountName,
            mediaPlatform,
            targetMediaPlatform,
            amount,
            currency = 'CNY',
            isMoveAllBalance = false,
            remarks
        } = validatedData

        // 生成工单ID和任务编号，与deposit模块保持一致
        const workOrderId = `TRF-${uuidv4()}`
        const taskNumber = generateTaskNumber('ACCOUNT_MANAGEMENT', 'TRANSFER')
        const now = new Date()

        // 直接使用前端传递的账户信息，使用账户ID创建有意义的默认名称
        // 与充值/减款模块保持一致的命名方式
        const actualSourceAccountName =
            sourceAccountName || `媒体账户${sourceAccountId}`
        const actualTargetAccountName =
            targetAccountName || `媒体账户${targetAccountId}`

        console.log('使用转账账户信息:', {
            sourceAccountId,
            actualSourceAccountName,
            targetAccountId,
            actualTargetAccountName
        })

        // 开启事务
        const result = await db.$transaction(async (tx) => {
            // 创建工单
            const workOrder = await tx.tecdo_work_orders.create({
                data: {
                    id: workOrderId,
                    taskId: taskNumber,
                    taskNumber: taskNumber,
                    userId: actualUserId,
                    workOrderType: 'ACCOUNT_MANAGEMENT',
                    workOrderSubtype: 'TRANSFER',
                    status: 'PENDING',
                    mediaAccountId: sourceAccountId,
                    metadata: {
                        platformType: mediaPlatform,
                        targetPlatformType:
                            targetMediaPlatform || mediaPlatform,
                        sourceAccountId: sourceAccountId,
                        sourceAccountName: actualSourceAccountName,
                        targetAccountId: targetAccountId,
                        targetAccountName: actualTargetAccountName,
                        mediaAccountId: sourceAccountId,
                        mediaAccountName: actualSourceAccountName,
                        amount: amount || '',
                        currency: currency,
                        isMoveAllBalance: isMoveAllBalance
                    },
                    remark: remarks || null,
                    createdAt: now,
                    updatedAt: now
                }
            })

            // 记录工单审计日志
            await tx.tecdo_audit_logs.create({
                data: {
                    id: uuidv4(),
                    entityType: 'WORK_ORDER',
                    entityId: workOrder.id,
                    action: '创建转账工单',
                    performedBy: username,
                    newValue: JSON.stringify({
                        sourceId: sourceAccountId,
                        sourceAcc: actualSourceAccountName.substring(0, 50), // 限制长度
                        targetId: targetAccountId,
                        targetAcc: actualTargetAccountName.substring(0, 50), // 限制长度
                        platform: mediaPlatform,
                        amount: amount || ''
                    }),
                    createdAt: now
                }
            })

            // 尝试创建业务数据记录
            try {
                // 检查是否已存在关联的业务数据
                const existingBusinessData =
                    await tx.tecdo_transfer_business_data.findUnique({
                        where: { workOrderId: workOrder.id }
                    })

                if (!existingBusinessData) {
                    // 创建业务数据时不设置mediaAccountId
                    const businessDataFields = {
                        id: uuidv4(),
                        workOrderId: workOrder.id,
                        mediaPlatform: mediaPlatform,
                        sourceAccountId: sourceAccountId,
                        targetAccountId: targetAccountId,
                        amount: amount || '', // 确保amount有默认值
                        currency: currency,
                        isMoveAllBalance: isMoveAllBalance,
                        transferStatus: 'PENDING',
                        transferTime: new Date(),
                        completedTime: new Date('9999-12-31'), // 使用远期日期表示尚未完成
                        createdAt: now,
                        updatedAt: now
                    }

                    await tx.tecdo_transfer_business_data.create({
                        data: businessDataFields
                    })
                }
            } catch (businessDataError) {
                console.error('创建业务数据记录失败:', businessDataError)
                throw new Error(
                    `创建业务数据记录失败: ${
                        businessDataError instanceof Error
                            ? businessDataError.message
                            : '未知错误'
                    }`
                )
            }

            // 返回工单信息
            return { workOrder }
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
 * 将转账工单提交到第三方接口
 * @param workOrderId 工单ID
 * @returns 操作结果
 */
export async function submitTransferWorkOrderToThirdParty(workOrderId: string) {
    console.log(`准备提交转账工单 ${workOrderId} 到第三方接口`)

    try {
        // 获取工单详情
        const workOrder = await db.tecdo_work_orders.findUnique({
            where: { id: workOrderId }
        })

        if (!workOrder) {
            console.error(`未找到工单 ${workOrderId}`)
            return {
                success: false,
                message: '未找到指定工单'
            }
        }

        // 确保工单类型正确
        if (
            workOrder.workOrderType !== 'ACCOUNT_MANAGEMENT' ||
            workOrder.workOrderSubtype !== 'TRANSFER'
        ) {
            console.error(`工单 ${workOrderId} 不是有效的转账工单`)
            return {
                success: false,
                message: '指定的工单不是有效的转账工单'
            }
        }

        // 获取业务数据
        const businessData = await db.tecdo_transfer_business_data.findUnique({
            where: { workOrderId }
        })

        if (!businessData) {
            console.error(`未找到工单 ${workOrderId} 的业务数据`)
            return {
                success: false,
                message: '未找到工单的业务数据'
            }
        }

        const metadata = (workOrder.metadata as Record<string, any>) || {}

        // 从metadata中提取账户、平台和金额信息
        const sourceAccountId =
            metadata.sourceAccountId || businessData.sourceAccountId
        const sourceAccountName = metadata.sourceAccountName || ''
        const targetAccountId =
            metadata.targetAccountId || businessData.targetAccountId
        const targetAccountName = metadata.targetAccountName || ''
        const mediaAccountName = metadata.mediaAccountName || sourceAccountName // 优先使用存储的mediaAccountName，否则使用源账户名称
        const platformType =
            metadata.platformType || businessData.mediaPlatform || ''
        const targetPlatformType = metadata.targetPlatformType || platformType // 获取目标平台，如果不存在则使用源平台
        const amount = metadata.amount || businessData.amount
        const currency = metadata.currency || businessData.currency || 'CNY'
        const isMoveAllBalance =
            metadata.isMoveAllBalance || businessData.isMoveAllBalance || false

        console.log('转账参数:', {
            sourceAccountId,
            sourceAccountName,
            sourcePlatform: platformType,
            targetAccountId,
            targetAccountName,
            targetPlatform: targetPlatformType,
            amount,
            currency,
            isMoveAllBalance
        })

        // 模拟调用第三方API
        // 注意：这里应该替换为真实的API调用
        const apiResponse = await simulateThirdPartyAPI({
            sourceAccountId,
            targetAccountId,
            sourcePlatform: platformType,
            targetPlatform: targetPlatformType,
            amount,
            currency,
            isMoveAllBalance
        })

        // 根据API响应更新业务数据和工单状态
        if (apiResponse.success) {
            // 更新业务数据
            await db.tecdo_transfer_business_data.update({
                where: { workOrderId: workOrderId },
                data: {
                    transferStatus: 'COMPLETED',
                    completedTime: new Date(),
                    failureReason: null,
                    updatedAt: new Date()
                }
            })

            // 更新工单状态
            await db.tecdo_work_orders.update({
                where: { id: workOrderId },
                data: {
                    status: 'COMPLETED',
                    updatedAt: new Date()
                }
            })

            // 记录审计日志
            await db.tecdo_audit_logs.create({
                data: {
                    id: uuidv4(),
                    entityType: 'WORK_ORDER',
                    entityId: workOrderId,
                    action: '转账工单执行成功',
                    performedBy: '系统',
                    newValue: JSON.stringify({
                        sourceId: sourceAccountId,
                        targetId: targetAccountId,
                        platform: platformType,
                        amount: amount || '',
                        status: 'COMPLETED'
                    }),
                    createdAt: new Date()
                }
            })

            // 返回成功信息
            console.log(`工单 ${workOrderId} 执行成功`)

            // 刷新相关页面
            revalidatePath('/account/manage')
            revalidatePath('/account/applications')

            return {
                success: true,
                message: '转账工单执行成功',
                data: {
                    referenceId: apiResponse.referenceId
                }
            }
        } else {
            // 更新业务数据失败状态
            await db.tecdo_transfer_business_data.update({
                where: { workOrderId: workOrderId },
                data: {
                    transferStatus: 'FAILED',
                    completedTime: new Date(),
                    failureReason: apiResponse.message,
                    updatedAt: new Date()
                }
            })

            // 更新工单状态
            await db.tecdo_work_orders.update({
                where: { id: workOrderId },
                data: {
                    status: 'FAILED',
                    updatedAt: new Date()
                }
            })

            // 记录审计日志
            await db.tecdo_audit_logs.create({
                data: {
                    id: uuidv4(),
                    entityType: 'WORK_ORDER',
                    entityId: workOrderId,
                    action: '转账工单执行失败',
                    performedBy: '系统',
                    newValue: JSON.stringify({
                        sourceId: sourceAccountId,
                        targetId: targetAccountId,
                        platform: platformType,
                        amount: amount || '',
                        status: 'FAILED',
                        reason: apiResponse.message
                    }),
                    createdAt: new Date()
                }
            })

            // 返回失败信息
            console.error(
                `工单 ${workOrderId} 执行失败: ${apiResponse.message}`
            )

            // 刷新相关页面
            revalidatePath('/account/manage')
            revalidatePath('/account/applications')

            return {
                success: false,
                message: apiResponse.message || '执行转账工单失败'
            }
        }
    } catch (error) {
        console.error(`提交转账工单 ${workOrderId} 到第三方接口时出错:`, error)
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : '提交转账工单到第三方接口失败'
        }
    }
}

// 模拟第三方API调用函数
async function simulateThirdPartyAPI(params: {
    sourceAccountId: string
    targetAccountId: string
    sourcePlatform: string
    targetPlatform: string
    amount?: string
    currency: string
    isMoveAllBalance: boolean
}) {
    // 模拟API调用延迟
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // 模拟使用第三方账户ID进行验证
    console.log(
        `模拟第三方API验证账户: ${params.sourceAccountId} 和 ${params.targetAccountId}`
    )

    // 90%的概率成功
    const isSuccess = Math.random() < 0.9

    if (isSuccess) {
        return {
            success: true,
            message: '转账成功',
            referenceId: `TRF-${Date.now()}`
        }
    } else {
        return {
            success: false,
            message: '转账失败，第三方平台拒绝请求'
        }
    }
}

/**
 * 审批转账工单
 * @param workOrderId 工单ID
 * @returns 操作结果
 */
export async function approveTransferWorkOrder(workOrderId: string) {
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

        // 查询工单详情
        const workOrder = await db.tecdo_work_orders.findUnique({
            where: { id: workOrderId }
        })

        if (!workOrder) {
            return {
                success: false,
                message: '未找到指定工单'
            }
        }

        // 检查当前工单状态
        if (workOrder.status !== 'PENDING') {
            return {
                success: false,
                message: `工单当前状态为 ${workOrder.status}，只有处于 PENDING 状态的工单才能审批`
            }
        }

        // 查询业务数据
        const businessData = await db.tecdo_transfer_business_data.findUnique({
            where: { workOrderId }
        })

        if (!businessData) {
            return {
                success: false,
                message: '未找到工单的业务数据'
            }
        }

        // 从metadata中获取完整信息
        const metadata = (workOrder.metadata as Record<string, any>) || {}
        const sourceAccountId =
            metadata.sourceAccountId || businessData.sourceAccountId
        const sourceAccountName = metadata.sourceAccountName || ''
        const targetAccountId =
            metadata.targetAccountId || businessData.targetAccountId
        const targetAccountName = metadata.targetAccountName || ''
        const mediaAccountName = metadata.mediaAccountName || sourceAccountName // 优先使用存储的mediaAccountName，否则使用源账户名称
        const platformType =
            metadata.platformType || businessData.mediaPlatform || ''
        const targetPlatformType = metadata.targetPlatformType || platformType // 获取目标平台信息
        const amount = metadata.amount || businessData.amount
        const currency = metadata.currency || businessData.currency || 'CNY'
        const isMoveAllBalance =
            metadata.isMoveAllBalance || businessData.isMoveAllBalance || false

        // 开启事务
        await db.$transaction(async (tx) => {
            // 更新工单状态为处理中
            await tx.tecdo_work_orders.update({
                where: { id: workOrderId },
                data: {
                    status: 'PROCESSING',
                    updatedAt: new Date()
                }
            })

            // 记录审计日志
            await tx.tecdo_audit_logs.create({
                data: {
                    id: uuidv4(),
                    entityType: 'WORK_ORDER',
                    entityId: workOrderId,
                    action: '审批转账工单',
                    performedBy: username,
                    newValue: JSON.stringify({
                        sourceId: sourceAccountId,
                        targetId: targetAccountId,
                        status: 'PROCESSING'
                    }),
                    createdAt: new Date()
                }
            })
        })

        // 审批后立即提交到第三方处理
        const submitResult =
            await submitTransferWorkOrderToThirdParty(workOrderId)

        // 刷新相关页面
        revalidatePath('/account/manage')
        revalidatePath('/account/applications')

        // 返回操作结果
        return {
            success: true,
            message: '转账工单已审批并提交处理',
            data: submitResult
        }
    } catch (error) {
        console.error('审批转账工单出错:', error)
        return {
            success: false,
            message: error instanceof Error ? error.message : '审批转账工单失败'
        }
    }
}

/**
 * 拒绝转账工单
 * @param workOrderId 工单ID
 * @param rejectReason 拒绝原因
 * @returns 操作结果
 */
export async function rejectTransferWorkOrder(
    workOrderId: string,
    rejectReason: string
) {
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

        // 查询工单详情
        const workOrder = await db.tecdo_work_orders.findUnique({
            where: { id: workOrderId }
        })

        if (!workOrder) {
            return {
                success: false,
                message: '未找到指定工单'
            }
        }

        // 检查当前工单状态
        if (workOrder.status !== 'PENDING') {
            return {
                success: false,
                message: `工单当前状态为 ${workOrder.status}，只有处于 PENDING 状态的工单才能拒绝`
            }
        }

        // 查询业务数据
        const businessData = await db.tecdo_transfer_business_data.findUnique({
            where: { workOrderId }
        })

        if (!businessData) {
            return {
                success: false,
                message: '未找到工单的业务数据'
            }
        }
        // 从metadata中获取完整信息
        const metadata = (workOrder.metadata as Record<string, any>) || {}
        const sourceAccountId =
            metadata.sourceAccountId || businessData.sourceAccountId
        const sourceAccountName = metadata.sourceAccountName || ''
        const targetAccountId =
            metadata.targetAccountId || businessData.targetAccountId
        const targetAccountName = metadata.targetAccountName || ''
        const mediaAccountName = metadata.mediaAccountName || sourceAccountName // 优先使用存储的mediaAccountName，否则使用源账户名称
        const platformType =
            metadata.platformType || businessData.mediaPlatform || ''
        const targetPlatformType = metadata.targetPlatformType || platformType // 获取目标平台信息

        // 开启事务
        await db.$transaction(async (tx) => {
            // 更新工单状态为已拒绝
            await tx.tecdo_work_orders.update({
                where: { id: workOrderId },
                data: {
                    status: 'CANCELLED',
                    remark: rejectReason,
                    updatedAt: new Date()
                }
            })

            // 更新业务数据
            await tx.tecdo_transfer_business_data.update({
                where: { workOrderId },
                data: {
                    transferStatus: 'CANCELLED',
                    updatedAt: new Date()
                }
            })

            // 记录审计日志
            await tx.tecdo_audit_logs.create({
                data: {
                    id: uuidv4(),
                    entityType: 'WORK_ORDER',
                    entityId: workOrderId,
                    action: '拒绝转账工单',
                    performedBy: username,
                    newValue: JSON.stringify({
                        sourceId: sourceAccountId,
                        targetId: targetAccountId,
                        status: 'CANCELLED',
                        reason: rejectReason
                    }),
                    createdAt: new Date()
                }
            })
        })

        // 刷新相关页面
        revalidatePath('/account/manage')
        revalidatePath('/account/applications')

        // 返回操作结果
        return {
            success: true,
            message: '成功拒绝转账工单'
        }
    } catch (error) {
        console.error('拒绝转账工单出错:', error)
        return {
            success: false,
            message: error instanceof Error ? error.message : '拒绝转账工单失败'
        }
    }
}

/**
 * 查询转账工单列表
 * @param page 页码
 * @param pageSize 每页记录数
 * @param status 工单状态
 * @param platformTypes 平台类型
 * @returns 查询结果
 */
export async function getTransferWorkOrders(
    page: number = 1,
    pageSize: number = 10,
    status?: string,
    platformTypes?: string[]
) {
    try {
        // 构建查询条件
        const where: any = {
            workOrderType: 'ACCOUNT_MANAGEMENT',
            workOrderSubtype: 'TRANSFER'
        }

        // 添加状态过滤条件（如果提供）
        if (status && status !== 'ALL') {
            where.status = status
        }

        // 添加平台类型过滤条件（如果提供）
        if (platformTypes && platformTypes.length > 0) {
            // 注意：平台类型存储在metadata中的platformType字段
            // 我们只能在前面 select 内查找包含特定 platformType 的记录
        }

        // 查询总记录数
        const totalCount = await db.tecdo_work_orders.count({
            where
        })

        // 计算分页信息
        const totalPages = Math.ceil(totalCount / pageSize)
        const safeCurrentPage = Math.min(Math.max(1, page), totalPages || 1)
        const skip = (safeCurrentPage - 1) * pageSize

        // 查询分页数据
        const workOrders = await db.tecdo_work_orders.findMany({
            where,
            orderBy: {
                createdAt: 'desc'
            },
            take: pageSize,
            skip
        })

        // 获取工单对应的业务数据
        const workOrderIds = workOrders.map((order) => order.id)
        const businessData = await db.tecdo_transfer_business_data.findMany({
            where: {
                workOrderId: {
                    in: workOrderIds
                }
            }
        })

        // 获取用户信息
        const userIds = workOrders
            .map((order) => order.userId)
            .filter(Boolean) as string[]
        const users = await db.tecdo_users.findMany({
            where: {
                id: {
                    in: userIds
                }
            },
            select: {
                id: true,
                name: true
            }
        })

        // 将业务数据与工单对象合并
        const result = workOrders.map((workOrder) => {
            // 找到对应的业务数据
            const relatedBusinessData = businessData.find(
                (data) => data.workOrderId === workOrder.id
            )

            // 找到对应的用户
            const user = users.find((user) => user.id === workOrder.userId)

            // 从metadata中获取账户名称
            const metadataObj =
                (workOrder.metadata as Record<string, any>) || {}

            // 从metadata中提取账户和平台信息
            const sourceAccountName = metadataObj.sourceAccountName || ''
            const targetAccountName = metadataObj.targetAccountName || ''
            const mediaAccountName =
                metadataObj.mediaAccountName || sourceAccountName // 优先使用存储的mediaAccountName，否则使用源账户名称
            const platformType =
                metadataObj.platformType ||
                relatedBusinessData?.mediaPlatform ||
                ''
            const targetPlatformType =
                metadataObj.targetPlatformType || platformType // 获取目标平台，如果不存在则使用源平台
            const sourceAccountId =
                metadataObj.sourceAccountId ||
                relatedBusinessData?.sourceAccountId ||
                ''
            const targetAccountId =
                metadataObj.targetAccountId ||
                relatedBusinessData?.targetAccountId ||
                ''

            return {
                ...workOrder,
                businessData: relatedBusinessData || {},
                user: user || null,
                sourceAccountId,
                targetAccountId,
                sourceAccountName,
                targetAccountName,
                mediaAccountName, // 添加mediaAccountName字段
                platformType,
                targetPlatformType // 添加目标平台信息
            }
        })

        // 如果提供了平台类型过滤条件，在内存中进行过滤
        // 这是因为metadata是JSON类型，不能在数据库级别直接过滤
        let filteredResult = result
        if (platformTypes && platformTypes.length > 0) {
            filteredResult = result.filter((item) => {
                // 检查源平台或目标平台是否匹配过滤条件
                return (
                    platformTypes.includes(item.platformType) ||
                    platformTypes.includes(item.targetPlatformType)
                )
            })
        }

        return {
            success: true,
            data: {
                records: filteredResult,
                pagination: {
                    current: safeCurrentPage,
                    pageSize,
                    total: totalCount,
                    totalPages
                }
            }
        }
    } catch (error) {
        console.error('获取转账工单列表失败:', error)
        return {
            success: false,
            message:
                error instanceof Error ? error.message : '获取转账工单列表失败'
        }
    }
}

/**
 * 获取单个转账工单详情
 * @param workOrderId 工单ID
 * @returns 工单详情
 */
export async function getTransferWorkOrderById(workOrderId: string) {
    try {
        // 查询工单基本信息
        const workOrder = await db.tecdo_work_orders.findUnique({
            where: { id: workOrderId }
        })

        if (!workOrder) {
            return {
                success: false,
                message: '未找到指定工单'
            }
        }

        // 确保是转账工单
        if (
            workOrder.workOrderType !== 'ACCOUNT_MANAGEMENT' ||
            workOrder.workOrderSubtype !== 'TRANSFER'
        ) {
            return {
                success: false,
                message: '指定的工单不是转账工单'
            }
        }

        // 查询业务数据
        const businessData = await db.tecdo_transfer_business_data.findUnique({
            where: { workOrderId }
        })

        // 获取用户信息
        let user = null
        if (workOrder.userId) {
            user = await db.tecdo_users.findUnique({
                where: { id: workOrder.userId },
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            })
        }

        // 查询审计日志
        const auditLogs = await db.tecdo_audit_logs.findMany({
            where: {
                entityType: 'WORK_ORDER',
                entityId: workOrderId
            },
            orderBy: {
                createdAt: 'desc'
            }
        })

        // 从metadata中提取账户和平台信息
        const metadata = (workOrder.metadata as Record<string, any>) || {}
        const sourceAccountName = metadata.sourceAccountName || ''
        const targetAccountName = metadata.targetAccountName || ''
        const mediaAccountName = metadata.mediaAccountName || sourceAccountName // 优先使用存储的mediaAccountName，否则使用源账户名称
        const platformType =
            metadata.platformType || businessData?.mediaPlatform || ''
        const targetPlatformType = metadata.targetPlatformType || platformType // 获取目标平台，如果不存在则使用源平台
        const amount = metadata.amount || businessData?.amount || ''
        const currency = metadata.currency || businessData?.currency || 'CNY'
        const isMoveAllBalance =
            metadata.isMoveAllBalance || businessData?.isMoveAllBalance || false

        // 格式化结果
        const result = {
            ...workOrder,
            businessData: businessData || {},
            user,
            auditLogs,
            // 添加来自metadata的信息
            sourceAccountId:
                metadata.sourceAccountId || businessData?.sourceAccountId || '',
            targetAccountId:
                metadata.targetAccountId || businessData?.targetAccountId || '',
            sourceAccountName,
            targetAccountName,
            mediaAccountName, // 添加mediaAccountName字段
            platformType,
            targetPlatformType,
            amount,
            currency,
            isMoveAllBalance
        }

        return {
            success: true,
            data: result
        }
    } catch (error) {
        console.error('获取转账工单详情失败:', error)
        return {
            success: false,
            message:
                error instanceof Error ? error.message : '获取转账工单详情失败'
        }
    }
}
