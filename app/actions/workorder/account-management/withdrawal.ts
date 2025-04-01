'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/auth'
import { ValidationError, ThirdPartyError } from '@/utils/business-error'
import { API_BASE_URL, callExternalApi } from '@/lib/request'
import { generateTaskNumber, generateTraceId } from '@/lib/utils'
import { v4 as uuidv4 } from 'uuid'
import {
    UserRole,
    WorkOrderSubtype,
    WorkOrderType,
    MediaPlatform,
    AccountStatus
} from '@prisma/client'
import { ApproveWorkOrderParams, RejectWorkOrderParams } from './types'
import {
    WithdrawalRequestSchema as ImportedWithdrawalRequestSchema,
    UpdateWithdrawalRequestSchema
} from '@/schemas/withdrawal'
import { WorkOrderStatus } from '@/schemas/enums'

// 创建减款请求的Schema
const WithdrawalRequestSchema = z.object({
    taskNumber: z.string().max(128).optional(),
    mediaPlatform: z.string(),
    mediaAccountId: z.string().min(1, '媒体账号ID不能为空'),
    mediaAccountName: z.string().optional(),
    amount: z.string().min(1, '减款金额不能为空'),
    currency: z.string().default('USD').optional(),
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
        const result = await callExternalApi({
            url: `${API_BASE_URL}/openApi/v1/mediaAccount/deductApplication/create`,
            body: request
        })

        // 假设响应也有特定结构
        return result
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
        const userId = session.user.id
        const username = session.user.name || '系统用户'

        // 检查用户是否存在
        const userExists = await db.tecdo_users.findUnique({
            where: { id: userId }
        })

        // 如果用户不存在，使用备用系统用户
        const actualUserId = userExists ? userId : '系统中已知存在的用户ID'

        // 验证输入数据
        const validatedData = await WithdrawalRequestSchema.parseAsync(input)
        const {
            mediaAccountId,
            mediaPlatform: mediaPlatformString,
            amount,
            currency = 'USD',
            remarks
        } = validatedData

        // 尝试从输入中获取媒体账户名称
        const mediaAccountNameFromInput = (input as any)?.mediaAccountName || ''
        console.log('从前端获取的mediaAccountName:', mediaAccountNameFromInput)

        // 解析mediaPlatform，确保有效
        const mediaPlatformNumber = Number(mediaPlatformString)
        if (isNaN(mediaPlatformNumber)) {
            return {
                success: false,
                message: '无效的媒体平台值'
            }
        }

        const taskNumber =
            validatedData.taskNumber ||
            generateTaskNumber('ACCOUNT_MANAGEMENT', 'WITHDRAWAL')

        // 检查媒体账户是否存在，但不作为工单创建的必要条件
        let accountName = mediaAccountNameFromInput
        try {
            const mediaAccount = await db.tecdo_media_accounts.findUnique({
                where: { id: mediaAccountId }
            })

            if (!mediaAccount) {
                console.log(
                    `注意: 媒体账户ID ${mediaAccountId} 在系统中不存在，但仍将创建工单`
                )
                // 只有在没有从输入获取账户名称时，才使用默认值
                if (!accountName) {
                    accountName = `媒体账户${mediaAccountId}`
                }
            } else {
                console.log(
                    `媒体账户ID ${mediaAccountId} 验证通过，继续创建工单`
                )
                // 优先使用从输入获取的名称，其次使用从数据库获取的名称
                if (!accountName) {
                    accountName = mediaAccount.accountName
                }
            }
        } catch (mediaAccountError) {
            console.error(
                '查询媒体账户时出错，但将继续创建工单:',
                mediaAccountError
            )
            // 只有在没有从输入获取账户名称时，才使用默认值
            if (!accountName) {
                accountName = `媒体账户${mediaAccountId}`
            }
        }

        console.log('使用的媒体账户名称:', accountName)

        // 开启事务
        const result = await db.$transaction(async (tx) => {
            // 创建工单 - 不再调用第三方API，只创建工单等待管理员审批
            const workOrderId = `WDR-${uuidv4()}`
            workOrder = await tx.tecdo_work_orders.create({
                data: {
                    id: workOrderId,
                    taskId: taskNumber,
                    taskNumber: taskNumber,
                    userId: actualUserId,
                    workOrderType: 'ACCOUNT_MANAGEMENT',
                    workOrderSubtype: 'WITHDRAWAL',
                    status: 'PENDING', // 初始状态为待处理
                    mediaAccountId: mediaAccountId,
                    metadata: {
                        traceId,
                        platformType: mediaPlatformString, // 保持原始值
                        mediaPlatformNumber: mediaPlatformNumber, // 添加数字形式
                        username,
                        amount: amount,
                        currency: currency,
                        remarks: remarks || '',
                        mediaAccountName: accountName // 添加媒体账户名称
                    },
                    remark: remarks || '',
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            })

            // 记录审计日志
            await tx.tecdo_audit_logs.create({
                data: {
                    id: uuidv4(),
                    entityType: 'WORK_ORDER',
                    entityId: workOrder.id,
                    action: '创建减款工单',
                    performedBy: username,
                    newValue: JSON.stringify({
                        mediaAccountId: mediaAccountId,
                        mediaPlatform: mediaPlatformString,
                        amount: amount,
                        currency: currency
                    }),
                    createdAt: new Date()
                }
            })

            // 创建业务数据记录
            try {
                // 检查是否已存在关联的业务数据
                const existingBusinessData =
                    await tx.tecdo_withdrawal_business_data.findUnique({
                        where: { workOrderId: workOrder.id }
                    })

                if (existingBusinessData) {
                    console.log(
                        `工单ID ${workOrder.id} 已有关联的业务数据，不再创建新记录`
                    )
                } else {
                    // 检查媒体账户是否存在
                    const mediaAccount =
                        await tx.tecdo_media_accounts.findUnique({
                            where: { id: mediaAccountId }
                        })

                    // 创建业务数据记录
                    if (mediaAccount) {
                        // 如果媒体账户存在，直接创建业务数据
                        await tx.tecdo_withdrawal_business_data.create({
                            data: {
                                workOrderId: workOrder.id,
                                mediaAccountId: mediaAccountId,
                                mediaPlatform: mediaPlatformString, // 保持为字符串
                                amount: amount,
                                currency: currency,
                                withdrawalStatus: 'PENDING',
                                withdrawalTime: null,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            }
                        })
                    } else {
                        // 如果媒体账户不存在，先创建一个临时的媒体账户记录，再创建业务数据
                        console.log(
                            `媒体账户ID ${mediaAccountId} 不存在，创建临时记录`
                        )

                        // 为临时账户创建一个描述性的名称
                        const tempAccountName = `临时账户-${mediaAccountId}`

                        // 首先创建临时媒体账户
                        const tempMediaAccount =
                            await tx.tecdo_media_accounts.create({
                                data: {
                                    id: mediaAccountId,
                                    accountName: tempAccountName,
                                    mediaPlatform:
                                        mediaPlatformString as unknown as MediaPlatform,
                                    accountStatus: AccountStatus.ACTIVE,
                                    userId: actualUserId, // 使用当前用户ID
                                    platformId: `temp-${mediaAccountId}`, // 临时平台ID
                                    currency: currency,
                                    timezone: 'Asia/Shanghai', // 默认时区
                                    balance: 0,
                                    totalSpent: 0,
                                    lastSyncTime: new Date(),
                                    isDeleted: false,
                                    createdAt: new Date(),
                                    updatedAt: new Date(),
                                    metadata: {
                                        isTemporary: true,
                                        createdForWorkOrder: workOrder.id,
                                        note: '此账户是为了解决外键约束而创建的临时记录'
                                    }
                                }
                            })

                        // 更新工单元数据中的账户名称
                        const updatedWorkOrder =
                            await tx.tecdo_work_orders.findUnique({
                                where: { id: workOrder.id },
                                select: { metadata: true }
                            })

                        if (updatedWorkOrder) {
                            // 解析现有的元数据，确保它是对象
                            let currentMetadata: Record<string, any> = {}
                            try {
                                if (
                                    typeof updatedWorkOrder.metadata ===
                                    'string'
                                ) {
                                    // 如果是字符串，尝试解析
                                    currentMetadata = JSON.parse(
                                        updatedWorkOrder.metadata
                                    )
                                } else if (
                                    updatedWorkOrder.metadata &&
                                    typeof updatedWorkOrder.metadata ===
                                        'object'
                                ) {
                                    // 如果已经是对象
                                    currentMetadata =
                                        updatedWorkOrder.metadata as Record<
                                            string,
                                            any
                                        >
                                }
                            } catch (e) {
                                console.error('解析元数据失败:', e)
                            }

                            // 确保包含了所有必要的字段
                            currentMetadata.mediaAccountName = tempAccountName

                            // 更新元数据
                            await tx.tecdo_work_orders.update({
                                where: { id: workOrder.id },
                                data: {
                                    metadata: currentMetadata
                                }
                            })

                            // 添加更多日志以便调试
                            console.log('更新了工单元数据：', {
                                workOrderId: workOrder.id,
                                mediaAccountName: tempAccountName,
                                metadata: currentMetadata
                            })
                        }

                        // 然后创建业务数据
                        await tx.tecdo_withdrawal_business_data.create({
                            data: {
                                workOrderId: workOrder.id,
                                mediaAccountId: mediaAccountId,
                                mediaPlatform: mediaPlatformString, // 保持为字符串
                                amount: amount,
                                currency: currency,
                                withdrawalStatus: 'PENDING',
                                withdrawalTime: null,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            }
                        })

                        // 记录创建临时账户的审计日志
                        await tx.tecdo_audit_logs.create({
                            data: {
                                id: uuidv4(),
                                entityType: 'MEDIA_ACCOUNT',
                                entityId: mediaAccountId,
                                action: '创建临时媒体账户',
                                performedBy: username,
                                newValue: JSON.stringify({
                                    id: mediaAccountId,
                                    mediaPlatform: mediaPlatformString,
                                    isTemporary: true,
                                    forWorkOrder: workOrder.id
                                }),
                                createdAt: new Date()
                            }
                        })
                    }
                    console.log('减款业务数据创建成功')
                }
            } catch (businessDataError) {
                console.error(
                    '创建减款业务数据时出错，但工单已创建:',
                    businessDataError
                )
                // 记录更详细的错误信息
                await tx.tecdo_error_log.create({
                    data: {
                        id: uuidv4(),
                        entityType: 'WITHDRAWAL_BUSINESS_DATA',
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
            return { workOrder }
        })

        // 刷新相关页面
        revalidatePath('/account/manage')
        revalidatePath('/account/applications')

        // 返回成功信息
        console.log('减款工单创建成功:', {
            workOrderId: result.workOrder.id,
            taskId: result.workOrder.taskId
        })

        return {
            success: true,
            message: '减款工单创建成功，等待管理员审批',
            data: {
                workOrderId: result.workOrder.id,
                taskId: result.workOrder.taskId
            }
        }
    } catch (error) {
        console.error('创建减款工单出错:', error)

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
            message: error instanceof Error ? error.message : '创建减款工单失败'
        }
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

        // 验证工单状态，现在只在工单状态为PROCESSING时执行
        if (!workOrder || workOrder.status !== 'PROCESSING') {
            return {
                success: false,
                message: '工单不存在或状态不正确，无法提交到第三方'
            }
        }

        // 验证业务数据是否存在
        if (!workOrder.tecdo_withdrawal_business_data) {
            console.error(`工单ID ${workOrderId} 没有关联的业务数据记录`)

            // 尝试查找业务数据
            const businessData =
                await db.tecdo_withdrawal_business_data.findFirst({
                    where: { workOrderId: workOrderId }
                })

            if (!businessData) {
                // 业务数据确实不存在，需要先创建
                console.log(`为工单 ${workOrderId} 创建业务数据记录`)

                // 从工单元数据中获取必要信息
                const metadata = (workOrder.metadata as any) || {}

                // 创建新的业务数据记录
                await db.tecdo_withdrawal_business_data.create({
                    data: {
                        workOrderId: workOrderId,
                        mediaAccountId: workOrder.mediaAccountId || '',
                        mediaPlatform:
                            metadata.platformType ||
                            metadata.mediaPlatform ||
                            '1',
                        amount: metadata.amount || '0',
                        currency: metadata.currency || 'CNY',
                        withdrawalStatus: 'PROCESSING',
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                })

                console.log(`已为工单 ${workOrderId} 创建业务数据记录`)
            }
        }

        const userId = session.user.id || 'unknown'
        const username = session.user.name || 'unknown'

        // 构造第三方请求
        const traceId = generateTraceId()

        // 重新查询确保获取最新的业务数据
        const freshWorkOrder = await db.tecdo_work_orders.findFirst({
            where: { id: workOrderId },
            include: { tecdo_withdrawal_business_data: true }
        })

        if (!freshWorkOrder || !freshWorkOrder.tecdo_withdrawal_business_data) {
            return {
                success: false,
                message: '无法获取工单业务数据，请联系系统管理员'
            }
        }

        // 确保mediaPlatform是正确格式
        const businessData = freshWorkOrder.tecdo_withdrawal_business_data
        const mediaPlatformString = businessData.mediaPlatform

        const thirdPartyRequest = {
            taskId: freshWorkOrder.taskId,
            mediaPlatform: mediaPlatformString,
            mediaAccountId: businessData.mediaAccountId,
            amount: businessData.amount,
            currency: businessData.currency,
            action: 'EXECUTE' // 执行减款
        }

        console.log('调用第三方API请求数据:', thirdPartyRequest)

        // 调用第三方API
        const thirdPartyResponse = await callThirdPartyWithdrawalAPI(
            thirdPartyRequest as any,
            traceId
        )

        console.log('第三方API响应:', thirdPartyResponse)

        // 更新工单状态
        const newStatus =
            thirdPartyResponse.code === '0' ? 'COMPLETED' : 'FAILED'

        await db.tecdo_work_orders.update({
            where: { id: workOrderId },
            data: {
                status: newStatus,
                updatedAt: new Date()
            }
        })

        // 更新业务数据 - 使用businessData.id而不是workOrderId确保能找到记录
        try {
            await db.tecdo_withdrawal_business_data.update({
                where: { id: businessData.id },
                data: {
                    withdrawalStatus: newStatus,
                    withdrawalTime:
                        newStatus === 'COMPLETED' ? new Date() : null,
                    failureReason:
                        newStatus === 'FAILED'
                            ? thirdPartyResponse.message
                            : null,
                    updatedAt: new Date()
                }
            })
            console.log(`成功更新业务数据ID: ${businessData.id}`)
        } catch (updateError) {
            console.error('更新业务数据失败:', updateError)
            // 尝试使用upsert保证数据存在
            await db.tecdo_withdrawal_business_data.upsert({
                where: { id: businessData.id },
                update: {
                    withdrawalStatus: newStatus,
                    withdrawalTime:
                        newStatus === 'COMPLETED' ? new Date() : null,
                    failureReason:
                        newStatus === 'FAILED'
                            ? thirdPartyResponse.message
                            : null,
                    updatedAt: new Date()
                },
                create: {
                    id: businessData.id,
                    workOrderId: workOrderId,
                    mediaAccountId: businessData.mediaAccountId,
                    mediaPlatform: mediaPlatformString,
                    amount: businessData.amount,
                    currency: businessData.currency || 'CNY',
                    withdrawalStatus: newStatus,
                    withdrawalTime:
                        newStatus === 'COMPLETED' ? new Date() : null,
                    failureReason:
                        newStatus === 'FAILED'
                            ? thirdPartyResponse.message
                            : null,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            })
        }

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

        // 添加审计日志
        await db.tecdo_audit_logs.create({
            data: {
                id: uuidv4(),
                entityType: 'WORK_ORDER',
                entityId: workOrderId,
                action:
                    newStatus === 'COMPLETED' ? '减款处理完成' : '减款处理失败',
                performedBy: username,
                previousValue: JSON.stringify({ status: 'PROCESSING' }),
                newValue: JSON.stringify({
                    status: newStatus,
                    response: thirdPartyResponse
                }),
                createdAt: new Date()
            }
        })

        // 刷新相关页面
        revalidatePath('/workorder')
        revalidatePath('/admin/workorders')
        revalidatePath('/account/manage')
        revalidatePath('/account/workorders')

        return {
            success: thirdPartyResponse.code === '0',
            message:
                thirdPartyResponse.code === '0'
                    ? '减款工单已成功处理'
                    : `减款失败: ${thirdPartyResponse.message}`,
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

/**
 * 管理员审批减款工单
 * @param params 审批参数
 * @returns 操作结果
 */
export async function approveWithdrawalWorkOrder(
    params: ApproveWorkOrderParams
): Promise<{
    success: boolean
    message?: string
    data?: { workOrderId: string; thirdPartyTaskId?: string }
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

        // 验证是否为管理员 - 可以根据业务需要决定是否启用
        // if (
        //     session.user.role !== UserRole.ADMIN &&
        //     session.user.role !== UserRole.SUPER_ADMIN
        // ) {
        //     return {
        //         success: false,
        //         message: '无权操作，仅管理员可审批工单'
        //     }
        // }

        // 查询工单
        const workOrder = await db.tecdo_work_orders.findUnique({
            where: { id: params.workOrderId },
            include: { tecdo_withdrawal_business_data: true }
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
        if (workOrder.workOrderSubtype !== 'WITHDRAWAL') {
            return {
                success: false,
                message: '非减款工单，无法进行此操作'
            }
        }

        // 检查是否有关联的业务数据
        if (!workOrder.tecdo_withdrawal_business_data) {
            console.warn(
                `工单ID ${params.workOrderId} 无关联的业务数据，尝试创建...`
            )

            // 从工单元数据中获取必要信息
            const metadata = (workOrder.metadata as any) || {}

            // 尝试创建业务数据
            try {
                await db.tecdo_withdrawal_business_data.create({
                    data: {
                        workOrderId: params.workOrderId,
                        mediaAccountId: workOrder.mediaAccountId || '',
                        mediaPlatform:
                            metadata.platformType ||
                            metadata.mediaPlatform ||
                            '1',
                        amount: metadata.amount || '0',
                        currency: metadata.currency || 'USD',
                        withdrawalStatus: 'PROCESSING',
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                })
                console.log(`已为工单 ${params.workOrderId} 创建业务数据记录`)
            } catch (err) {
                console.error(`创建业务数据失败:`, err)
                // 继续审批流程，后面会再次尝试创建
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

        // 调用第三方API处理减款
        console.log('正在向第三方提交减款申请...')
        const apiResult = await submitWithdrawalWorkOrderToThirdParty(
            params.workOrderId
        )

        // 如果API调用失败，记录错误但不影响审批流程
        if (!apiResult.success) {
            console.error('调用第三方API处理减款失败:', apiResult.message)

            // 记录API调用失败
            await db.tecdo_audit_logs.create({
                data: {
                    id: uuidv4(),
                    entityType: 'WORK_ORDER',
                    entityId: params.workOrderId,
                    action: '调用第三方API失败',
                    performedBy: username,
                    previousValue: JSON.stringify({ status: 'PROCESSING' }),
                    newValue: JSON.stringify({
                        apiError: apiResult.message
                    }),
                    createdAt: new Date()
                }
            })

            // 更新工单状态为失败
            await db.tecdo_work_orders
                .update({
                    where: { id: params.workOrderId },
                    data: {
                        status: 'FAILED',
                        updatedAt: new Date(),
                        remark: `调用第三方API失败: ${apiResult.message}`
                    }
                })
                .catch((err) => {
                    console.error(`更新工单状态失败:`, err)
                })

            return {
                success: true,
                message: `减款工单审批成功，但第三方处理失败: ${apiResult.message}`,
                data: {
                    workOrderId: params.workOrderId
                }
            }
        }

        console.log('向第三方提交减款申请成功:', apiResult)

        // 提取第三方返回的任务ID（如果有）
        let thirdPartyTaskId = undefined
        if (apiResult.thirdPartyResponse && apiResult.thirdPartyResponse.data) {
            thirdPartyTaskId = apiResult.thirdPartyResponse.data.taskId

            // 如果存在任务ID，更新工单记录
            if (thirdPartyTaskId) {
                await db.tecdo_work_orders.update({
                    where: { id: params.workOrderId },
                    data: {
                        thirdPartyTaskId: thirdPartyTaskId,
                        metadata: {
                            ...((workOrder.metadata as Record<string, any>) ||
                                {}),
                            thirdPartyResponse: JSON.stringify(
                                apiResult.thirdPartyResponse
                            )
                        },
                        updatedAt: new Date()
                    }
                })
            }
        }

        // 刷新相关页面
        revalidatePath('/admin/workorders')
        revalidatePath('/workorder')
        revalidatePath('/account/manage')
        revalidatePath('/account/applications')

        return {
            success: true,
            message: '减款工单审批并提交第三方处理成功',
            data: {
                workOrderId: params.workOrderId,
                thirdPartyTaskId: thirdPartyTaskId
            }
        }
    } catch (error) {
        console.error('审批减款工单出错:', error)
        return {
            success: false,
            message: error instanceof Error ? error.message : '减款工单审批失败'
        }
    }
}

/**
 * 拒绝减款工单
 * @param params 拒绝参数
 * @returns 操作结果
 */
export async function rejectWithdrawalWorkOrder(
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
        if (workOrder.workOrderSubtype !== 'WITHDRAWAL') {
            return {
                success: false,
                message: '非减款工单，无法进行此操作'
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
            message: '减款工单已拒绝',
            data: {
                workOrderId: params.workOrderId
            }
        }
    } catch (error) {
        console.error('拒绝减款工单出错:', error)
        return {
            success: false,
            message: '拒绝减款工单失败'
        }
    }
}
