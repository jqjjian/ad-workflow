'use server'

import { db } from '@/lib/db'
import { withAuth } from '@/lib/auth-actions'
import {
    DepositSchema,
    WithdrawalSchema,
    TransferSchema,
    AccountBindSchema,
    PixelBindSchema,
    EmailBindSchema
} from '@/schemas'
import { generateWorkOrderNumber } from '../utils/workorder-utils'
import { callExternalApi } from '@/lib/request'
import { Logger } from '@/lib/logger'
import { ApiResponse } from '@/schemas/third-party-type'
import { WorkOrderType, WorkOrderSubtype } from '@prisma/client'

const openApiUrl =
    process.env.NODE_ENV === 'production'
        ? process.env.OPEN_API_URL
        : process.env.OPEN_API_URL_TEST

/**
 * 创建充值工单
 */
export async function createDepositOrder(
    data: any, // 使用实际的充值数据类型
    userId: string | undefined
): Promise<ApiResponse<{ taskId: string; paymentUrl?: string }>> {
    return withAuth(async () => {
        if (!userId) {
            return { code: '401', success: false, message: '用户ID不能为空' }
        }

        try {
            // 1. 验证数据
            const validatedData = DepositSchema.parse(data)

            // 2. 生成工单编号
            const taskNumber = generateWorkOrderNumber(
                WorkOrderType.ACCOUNT_MANAGEMENT,
                WorkOrderSubtype.DEPOSIT
            )

            // 3. 创建本地工单记录
            const task = await db.tecdo_third_party_tasks.create({
                data: {
                    taskNumber,
                    taskId: taskNumber,
                    typeId: 3, // 账户管理类型ID
                    workOrderType: WorkOrderType.ACCOUNT_MANAGEMENT,
                    workOrderSubtype: WorkOrderSubtype.DEPOSIT,
                    status: 'INIT',
                    userId,
                    rawData: JSON.stringify(validatedData),
                    accountManagementDetail: {
                        create: {
                            mediaAccountId: data.mediaAccountId,
                            mediaAccountName: data.mediaAccountName,
                            mediaPlatform: data.mediaPlatform,
                            amount: data.amount,
                            currency: data.currency,
                            exchangeRate: data.exchangeRate
                        }
                    }
                }
            })

            // 4. 创建支付记录
            const paymentRecord = await db.paymentRecord.create({
                data: {
                    taskId: task.taskId,
                    userId,
                    paymentNo: `P${taskNumber}`,
                    amount: data.amount,
                    currency: data.currency,
                    paymentMethod: data.paymentMethod,
                    paymentChannel: data.paymentChannel || '默认渠道',
                    paymentStatus: 'PENDING'
                }
            })

            // 5. 调用第三方API
            const apiUrl = `${openApiUrl}/openApi/v1/accountManagement/deposit/create`
            const response = await callExternalApi<{
                taskId: string
                paymentUrl: string
            }>({
                url: apiUrl,
                body: {
                    taskNumber,
                    ...validatedData
                }
            })

            // 6. 处理响应
            if (response.code !== '0' || !response.data?.taskId) {
                // 更新状态为失败
                await db.$transaction([
                    db.tecdo_third_party_tasks.update({
                        where: { id: task.id },
                        data: {
                            status: 'FAILED',
                            rawResponse: JSON.stringify(response),
                            failureReason: '第三方返回错误'
                        }
                    }),
                    db.paymentRecord.update({
                        where: { id: paymentRecord.id },
                        data: {
                            paymentStatus: 'FAILED',
                            failureReason:
                                response.message || '创建充值订单失败'
                        }
                    })
                ])

                return {
                    code: '1',
                    success: false,
                    message: response.message || '创建充值订单失败'
                }
            }

            // 7. 更新本地工单和支付信息
            await db.$transaction([
                db.tecdo_third_party_tasks.update({
                    where: { id: task.id },
                    data: {
                        taskId: response.data.taskId,
                        status: 'PENDING', // 充值单要等支付完成才成功
                        rawResponse: JSON.stringify(response)
                    }
                }),
                db.paymentRecord.update({
                    where: { id: paymentRecord.id },
                    data: {
                        paymentStatus: 'PROCESSING',
                        paymentDetail: JSON.stringify({
                            paymentUrl: response.data.paymentUrl
                        })
                    }
                })
            ])

            return {
                code: '0',
                success: true,
                data: {
                    taskId: response.data.taskId,
                    paymentUrl: response.data.paymentUrl
                }
            }
        } catch (error) {
            Logger.error(
                `创建充值订单失败: ${error instanceof Error ? error.message : String(error)}`
            )
            return {
                code: '1',
                success: false,
                message: error instanceof Error ? error.message : '未知错误'
            }
        }
    })
}

/**
 * 创建减款工单
 */
export async function createWithdrawalOrder(
    data: any, // 使用实际的减款数据类型
    userId: string | undefined
): Promise<ApiResponse<{ taskId: string }>> {
    return withAuth(async () => {
        // 实现类似创建充值工单的逻辑，但针对减款
        // ...
        return {
            code: '0',
            success: true,
            data: { taskId: 'mock-withdrawal-task-id' }
        }
    })
}

/**
 * 创建转账工单
 */
export async function createTransferOrder(
    data: any,
    userId: string | undefined
): Promise<ApiResponse<{ taskId: string }>> {
    // 类似实现
    return { code: '0', success: true, data: { taskId: 'mock-id' } } as any
}

/**
 * 创建绑定账号工单
 */
export async function createBindAccountOrder(
    data: any,
    userId: string | undefined
): Promise<ApiResponse<{ taskId: string }>> {
    // 类似实现
    return { code: '0', success: true, data: { taskId: 'mock-id' } } as any
}

/**
 * 创建解绑账号工单
 */
export async function createUnbindAccountOrder(
    data: any,
    userId: string | undefined
): Promise<ApiResponse<{ taskId: string }>> {
    // 类似实现
    return { code: '0', success: true, data: { taskId: 'mock-id' } } as any
}

/**
 * 创建绑定Pixel工单
 */
export async function createBindPixelOrder(
    data: any,
    userId: string | undefined
): Promise<ApiResponse<{ taskId: string }>> {
    // 类似实现
    return { code: '0', success: true, data: { taskId: 'mock-id' } } as any
}

/**
 * 创建解绑Pixel工单
 */
export async function createUnbindPixelOrder(
    data: any,
    userId: string | undefined
): Promise<ApiResponse<{ taskId: string }>> {
    // 类似实现
    return { code: '0', success: true, data: { taskId: 'mock-id' } } as any
}

/**
 * 查询账户管理工单
 */
export async function getAccountManagementOrders(params: {
    page?: number
    pageSize?: number
    userId?: string
    workOrderSubtype?: WorkOrderSubtype
    status?: string
    dateRange?: { start: Date; end: Date }
    mediaAccountId?: string
}): Promise<ApiResponse<{ total: number; items: any[] }>> {
    return withAuth(async () => {
        try {
            const {
                page = 1,
                pageSize = 10,
                userId,
                workOrderSubtype,
                status,
                dateRange,
                mediaAccountId
            } = params

            // 构建工单查询条件
            const where = {
                workOrderType: WorkOrderType.ACCOUNT_MANAGEMENT,
                ...(workOrderSubtype && { workOrderSubtype }),
                ...(userId && { userId }),
                ...(status && { status }),
                ...(dateRange && {
                    createdAt: {
                        gte: dateRange.start,
                        lte: dateRange.end
                    }
                })
            }

            // 如果需要按媒体账号ID过滤
            if (mediaAccountId) {
                where['accountManagementDetail'] = {
                    mediaAccountId
                }
            }

            // 查询总数
            const total = await db.tecdo_third_party_tasks.count({ where })

            // 查询数据
            const items = await db.tecdo_third_party_tasks.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    accountManagementDetail: true,
                    paymentRecord: workOrderSubtype === WorkOrderSubtype.DEPOSIT
                },
                orderBy: { createdAt: 'desc' }
            })

            return {
                code: '0',
                success: true,
                data: { total, items }
            }
        } catch (error) {
            Logger.error(
                `查询账户管理工单失败: ${error instanceof Error ? error.message : String(error)}`
            )
            return {
                code: '1',
                success: false,
                message: error instanceof Error ? error.message : '未知错误'
            }
        }
    })
}

/**
 * 更新账户管理工单
 */
export async function updateAccountManagementOrder(
    taskId: string,
    data: any,
    userId: string | undefined
): Promise<ApiResponse<{ taskId: string }>> {
    // 实现更新逻辑
    return { code: '0', success: true, data: { taskId } } as any
}

/**
 * 软删除账户管理工单
 */
export async function deleteAccountManagementOrder(
    taskId: string,
    userId: string | undefined
): Promise<ApiResponse<void>> {
    // 实现软删除逻辑
    return { code: '0', success: true } as any
}
