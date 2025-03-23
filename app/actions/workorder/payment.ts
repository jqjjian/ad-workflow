'use server'

import { db } from '@/lib/db'
import { withAuth } from '@/lib/auth-actions'
import { Logger } from '@/lib/logger'
import { ApiResponse } from '@/schemas/third-party-type'
import { PaymentStatus, WorkOrderType, WorkOrderSubtype } from '@prisma/client'
import { callExternalApi } from '@/lib/request'

const openApiUrl =
    process.env.NODE_ENV === 'production'
        ? process.env.OPEN_API_URL
        : process.env.OPEN_API_URL_TEST

/**
 * 获取支付记录详情
 */
export async function getPaymentDetail(
    paymentId: number,
    userId: string | undefined
): Promise<ApiResponse<any>> {
    return withAuth(async () => {
        if (!userId) {
            return { code: '401', success: false, message: '用户ID不能为空' }
        }

        try {
            // 查询支付记录
            const payment = await db.paymentRecord.findFirst({
                where: {
                    id: paymentId,
                    userId
                },
                include: {
                    task: true
                }
            })

            if (!payment) {
                return {
                    code: '404',
                    success: false,
                    message: '找不到支付记录'
                }
            }

            return {
                code: '0',
                success: true,
                data: payment
            }
        } catch (error) {
            Logger.error(
                `获取支付记录详情失败: ${error instanceof Error ? error.message : String(error)}`
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
 * 查询支付记录列表
 */
export async function getPaymentRecords(params: {
    page?: number
    pageSize?: number
    userId?: string
    paymentStatus?: PaymentStatus
    dateRange?: { start: Date; end: Date }
    paymentMethod?: string
    taskId?: string
}): Promise<ApiResponse<{ total: number; items: any[] }>> {
    return withAuth(async () => {
        try {
            const {
                page = 1,
                pageSize = 10,
                userId,
                paymentStatus,
                dateRange,
                paymentMethod,
                taskId
            } = params

            // 构建查询条件
            const where = {
                ...(userId && { userId }),
                ...(paymentStatus && { paymentStatus }),
                ...(dateRange && {
                    createdAt: {
                        gte: dateRange.start,
                        lte: dateRange.end
                    }
                }),
                ...(paymentMethod && { paymentMethod }),
                ...(taskId && { taskId })
            }

            // 查询总数
            const total = await db.paymentRecord.count({ where })

            // 查询数据
            const items = await db.paymentRecord.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    task: {
                        include: {
                            accountManagementDetail: true
                        }
                    }
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
                `查询支付记录列表失败: ${error instanceof Error ? error.message : String(error)}`
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
 * 处理支付回调
 */
export async function handlePaymentCallback(data: {
    paymentNo: string
    thirdPartyTradeNo: string
    thirdPartyBuyerId?: string
    amount: number
    status: string
    paymentTime: string
    extraData?: any
}): Promise<ApiResponse<void>> {
    try {
        // 1. 查找支付记录
        const payment = await db.paymentRecord.findFirst({
            where: { paymentNo: data.paymentNo },
            include: { task: true }
        })

        if (!payment) {
            return { code: '404', success: false, message: '找不到支付记录' }
        }

        // 2. 确定支付状态
        let paymentStatus: PaymentStatus
        switch (data.status.toUpperCase()) {
            case 'SUCCESS':
            case 'TRADE_SUCCESS':
                paymentStatus = 'COMPLETED'
                break
            case 'PROCESSING':
            case 'WAIT_BUYER_PAY':
                paymentStatus = 'PROCESSING'
                break
            case 'TRADE_CLOSED':
            case 'CLOSED':
                paymentStatus = 'CANCELLED'
                break
            case 'FAIL':
            case 'TRADE_FAILED':
                paymentStatus = 'FAILED'
                break
            default:
                paymentStatus = 'FAILED'
        }

        // 3. 更新支付记录
        await db.paymentRecord.update({
            where: { id: payment.id },
            data: {
                paymentStatus,
                thirdPartyTradeNo: data.thirdPartyTradeNo,
                thirdPartyBuyerId: data.thirdPartyBuyerId,
                paymentTime: new Date(data.paymentTime),
                paymentDetail: JSON.stringify({
                    ...(payment.paymentDetail
                        ? JSON.parse(payment.paymentDetail)
                        : {}),
                    callbackData: data
                })
            }
        })

        // 4. 如果支付成功，更新对应的工单状态
        if (paymentStatus === 'COMPLETED' && payment.task) {
            await db.tecdo_third_party_tasks.update({
                where: { id: payment.task.id },
                data: {
                    status: 'SUCCESS'
                }
            })

            // 5. 调用第三方API通知支付成功（如果需要）
            const taskId = payment.task.taskId
            const apiUrl = `${openApiUrl}/openApi/v1/payment/notify`
            await callExternalApi({
                url: apiUrl,
                body: {
                    taskId,
                    paymentNo: data.paymentNo,
                    thirdPartyTradeNo: data.thirdPartyTradeNo,
                    status: 'SUCCESS'
                }
            })
        }

        return {
            code: '0',
            success: true,
            message: '支付回调处理成功'
        }
    } catch (error) {
        Logger.error(
            `处理支付回调失败: ${error instanceof Error ? error.message : String(error)}`
        )
        return {
            code: '1',
            success: false,
            message: error instanceof Error ? error.message : '未知错误'
        }
    }
}

/**
 * 取消支付
 */
export async function cancelPayment(
    paymentId: number,
    userId: string | undefined
): Promise<ApiResponse<void>> {
    return withAuth(async () => {
        if (!userId) {
            return { code: '401', success: false, message: '用户ID不能为空' }
        }

        try {
            // 1. 查找支付记录
            const payment = await db.paymentRecord.findFirst({
                where: {
                    id: paymentId,
                    userId,
                    paymentStatus: {
                        in: ['PENDING', 'PROCESSING'] // 只能取消待支付和处理中的订单
                    }
                },
                include: { task: true }
            })

            if (!payment) {
                return {
                    code: '404',
                    success: false,
                    message: '找不到可取消的支付记录'
                }
            }

            // 2. 更新支付记录状态
            await db.paymentRecord.update({
                where: { id: payment.id },
                data: {
                    paymentStatus: 'CANCELLED'
                }
            })

            // 3. 更新关联的工单状态
            if (payment.task) {
                await db.tecdo_third_party_tasks.update({
                    where: { id: payment.task.id },
                    data: {
                        status: 'CANCELLED',
                        failureReason: '用户取消支付'
                    }
                })
            }

            // 4. 如果需要，调用第三方API取消支付
            if (payment.thirdPartyTradeNo) {
                const apiUrl = `${openApiUrl}/openApi/v1/payment/cancel`
                await callExternalApi({
                    url: apiUrl,
                    body: {
                        thirdPartyTradeNo: payment.thirdPartyTradeNo
                    }
                })
            }

            return {
                code: '0',
                success: true,
                message: '支付已取消'
            }
        } catch (error) {
            Logger.error(
                `取消支付失败: ${error instanceof Error ? error.message : String(error)}`
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
 * 创建支付链接（用于重新支付）
 */
export async function createPaymentLink(
    taskId: string,
    userId: string | undefined
): Promise<ApiResponse<{ paymentUrl: string }>> {
    return withAuth(async () => {
        if (!userId) {
            return { code: '401', success: false, message: '用户ID不能为空' }
        }

        try {
            // 1. 查找工单和支付记录
            const task = await db.tecdo_third_party_tasks.findFirst({
                where: {
                    taskId,
                    userId,
                    workOrderType: WorkOrderType.ACCOUNT_MANAGEMENT,
                    workOrderSubtype: WorkOrderSubtype.DEPOSIT
                },
                include: {
                    paymentRecord: true,
                    accountManagementDetail: true
                }
            })

            if (!task || !task.paymentRecord || !task.accountManagementDetail) {
                return {
                    code: '404',
                    success: false,
                    message: '找不到有效的充值工单'
                }
            }

            // 2. 检查支付状态，只有失败或取消的支付才能重新生成链接
            if (
                !['FAILED', 'CANCELLED'].includes(
                    task.paymentRecord.paymentStatus
                )
            ) {
                return {
                    code: '400',
                    success: false,
                    message: '当前支付状态不允许重新支付'
                }
            }

            // 3. 调用第三方API生成新的支付链接
            const apiUrl = `${openApiUrl}/openApi/v1/payment/recreate`
            const response = await callExternalApi<{ paymentUrl: string }>({
                url: apiUrl,
                body: {
                    taskId,
                    paymentNo: task.paymentRecord.paymentNo,
                    amount: task.accountManagementDetail.amount,
                    currency: task.accountManagementDetail.currency
                }
            })

            if (response.code !== '0' || !response.data?.paymentUrl) {
                return {
                    code: '1',
                    success: false,
                    message: response.message || '创建支付链接失败'
                }
            }

            // 4. 更新支付记录状态
            await db.paymentRecord.update({
                where: { id: task.paymentRecord.id },
                data: {
                    paymentStatus: 'PENDING',
                    paymentDetail: JSON.stringify({
                        ...(task.paymentRecord.paymentDetail
                            ? JSON.parse(task.paymentRecord.paymentDetail)
                            : {}),
                        newPaymentUrl: response.data.paymentUrl,
                        recreateTime: new Date().toISOString()
                    }),
                    failureReason: null
                }
            })

            // 5. 更新工单状态
            await db.tecdo_third_party_tasks.update({
                where: { id: task.id },
                data: {
                    status: 'PENDING',
                    failureReason: null
                }
            })

            return {
                code: '0',
                success: true,
                data: { paymentUrl: response.data.paymentUrl }
            }
        } catch (error) {
            Logger.error(
                `创建支付链接失败: ${error instanceof Error ? error.message : String(error)}`
            )
            return {
                code: '1',
                success: false,
                message: error instanceof Error ? error.message : '未知错误'
            }
        }
    })
}
