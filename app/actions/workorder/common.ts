'use server'

import { db } from '@/lib/db'
import { withAuth } from '@/lib/auth-actions'
import { Logger } from '@/lib/logger'
import { ApiResponse } from '@/schemas/third-party-type'
import { WorkOrderType, WorkOrderSubtype } from '@prisma/client'

/**
 * 获取工单详情
 */
export async function getWorkOrderDetail(
    taskId: string,
    userId: string | undefined
): Promise<ApiResponse<any>> {
    return withAuth(async () => {
        if (!userId) {
            return { code: '401', success: false, message: '用户ID不能为空' }
        }

        try {
            // 查询工单基本信息
            const task = await db.tecdo_third_party_tasks.findFirst({
                where: {
                    taskId,
                    userId
                }
            })

            if (!task) {
                return { code: '404', success: false, message: '找不到工单' }
            }

            // 根据工单类型查询详细信息
            let detailData = null

            switch (task.workOrderType) {
                case WorkOrderType.ACCOUNT_APPLICATION:
                    detailData = await db.tecdo_third_party_tasks.findUnique({
                        where: { id: task.id },
                        include: {
                            registrationDetail: true,
                            promotionLink: true
                        }
                    })
                    break

                case WorkOrderType.ACCOUNT_MANAGEMENT:
                    detailData = await db.tecdo_third_party_tasks.findUnique({
                        where: { id: task.id },
                        include: {
                            accountManagementDetail: true,
                            paymentRecord:
                                task.workOrderSubtype ===
                                WorkOrderSubtype.DEPOSIT
                        }
                    })
                    break

                case WorkOrderType.ATTACHMENT_MANAGEMENT:
                    detailData = await db.tecdo_third_party_tasks.findUnique({
                        where: { id: task.id },
                        include: {
                            attachmentRecords: true
                        }
                    })
                    break

                case WorkOrderType.PAYMENT:
                    detailData = await db.tecdo_third_party_tasks.findUnique({
                        where: { id: task.id },
                        include: {
                            paymentRecord: true
                        }
                    })
                    break

                default:
                    detailData = task
            }

            return {
                code: '0',
                success: true,
                data: detailData
            }
        } catch (error) {
            Logger.error(
                `获取工单详情失败: ${error instanceof Error ? error.message : String(error)}`
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
 * 查询所有工单列表（支持多条件筛选）
 */
export async function getWorkOrders(params: {
    page?: number
    pageSize?: number
    userId?: string
    workOrderType?: WorkOrderType
    workOrderSubtype?: WorkOrderSubtype
    status?: string
    dateRange?: { start: Date; end: Date }
    taskNumber?: string
    taskId?: string
}): Promise<ApiResponse<{ total: number; items: any[] }>> {
    return withAuth(async () => {
        try {
            const {
                page = 1,
                pageSize = 10,
                userId,
                workOrderType,
                workOrderSubtype,
                status,
                dateRange,
                taskNumber,
                taskId
            } = params

            // 构建查询条件
            const where = {
                ...(userId && { userId }),
                ...(workOrderType && { workOrderType }),
                ...(workOrderSubtype && { workOrderSubtype }),
                ...(status && { status }),
                ...(dateRange && {
                    createdAt: {
                        gte: dateRange.start,
                        lte: dateRange.end
                    }
                }),
                ...(taskNumber && { taskNumber: { contains: taskNumber } }),
                ...(taskId && { taskId: { contains: taskId } })
            }

            // 查询总数
            const total = await db.tecdo_third_party_tasks.count({ where })

            // 查询数据
            const items = await db.tecdo_third_party_tasks.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    promotionLink: true,
                    registrationDetail:
                        workOrderType === WorkOrderType.ACCOUNT_APPLICATION,
                    accountManagementDetail:
                        workOrderType === WorkOrderType.ACCOUNT_MANAGEMENT,
                    attachmentRecords:
                        workOrderType === WorkOrderType.ATTACHMENT_MANAGEMENT,
                    paymentRecord: true
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
                `查询工单列表失败: ${error instanceof Error ? error.message : String(error)}`
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
 * 取消工单（软删除）
 */
export async function cancelWorkOrder(
    taskId: string,
    userId: string | undefined
): Promise<ApiResponse<void>> {
    return withAuth(async () => {
        if (!userId) {
            return { code: '401', success: false, message: '用户ID不能为空' }
        }

        try {
            // 1. 查找工单
            const task = await db.tecdo_third_party_tasks.findFirst({
                where: {
                    taskId,
                    userId,
                    status: {
                        notIn: ['SUCCESS', 'CANCELLED'] // 只有未完成的工单才能取消
                    }
                },
                include: {
                    paymentRecord: true
                }
            })

            if (!task) {
                return {
                    code: '404',
                    success: false,
                    message: '找不到可取消的工单'
                }
            }

            // 2. 事务处理
            await db.$transaction(async (tx) => {
                // 更新工单状态
                await tx.tecdo_third_party_tasks.update({
                    where: { id: task.id },
                    data: {
                        status: 'CANCELLED',
                        failureReason: '用户取消'
                    }
                })

                // 如果有关联的支付记录，也一并取消
                if (task.paymentRecord) {
                    await tx.paymentRecord.update({
                        where: { id: task.paymentRecord.id },
                        data: {
                            paymentStatus: 'CANCELLED',
                            failureReason: '用户取消关联工单'
                        }
                    })
                }
            })

            return {
                code: '0',
                success: true,
                message: '工单已取消'
            }
        } catch (error) {
            Logger.error(
                `取消工单失败: ${error instanceof Error ? error.message : String(error)}`
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
 * 统计工单数据
 */
export async function getWorkOrderStatistics(
    userId: string | undefined
): Promise<
    ApiResponse<{
        totalOrders: number
        pendingOrders: number
        successOrders: number
        failedOrders: number
        byType: Record<WorkOrderType, number>
        recentActivity: any[]
    }>
> {
    return withAuth(async () => {
        if (!userId) {
            return { code: '401', success: false, message: '用户ID不能为空' }
        }

        try {
            // 构建基础查询条件
            const baseWhere = { userId }

            // 总工单数
            const totalOrders = await db.tecdo_third_party_tasks.count({
                where: baseWhere
            })

            // 各状态工单数
            const pendingOrders = await db.tecdo_third_party_tasks.count({
                where: {
                    ...baseWhere,
                    status: {
                        in: ['INIT', 'PENDING']
                    }
                }
            })

            const successOrders = await db.tecdo_third_party_tasks.count({
                where: {
                    ...baseWhere,
                    status: 'SUCCESS'
                }
            })

            const failedOrders = await db.tecdo_third_party_tasks.count({
                where: {
                    ...baseWhere,
                    status: {
                        in: ['FAILED', 'CANCELLED']
                    }
                }
            })

            // 按类型统计工单数
            const byType: Partial<Record<WorkOrderType, number>> = {}

            for (const type of Object.values(WorkOrderType)) {
                byType[type] = await db.tecdo_third_party_tasks.count({
                    where: {
                        ...baseWhere,
                        workOrderType: type
                    }
                })
            }

            // 最近活动
            const recentActivity = await db.tecdo_third_party_tasks.findMany({
                where: baseWhere,
                take: 10,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    taskNumber: true,
                    workOrderType: true,
                    workOrderSubtype: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true
                }
            })

            return {
                code: '0',
                success: true,
                data: {
                    totalOrders,
                    pendingOrders,
                    successOrders,
                    failedOrders,
                    byType: byType as Record<WorkOrderType, number>,
                    recentActivity
                }
            }
        } catch (error) {
            Logger.error(
                `获取工单统计数据失败: ${error instanceof Error ? error.message : String(error)}`
            )
            return {
                code: '1',
                success: false,
                message: error instanceof Error ? error.message : '未知错误'
            }
        }
    })
}
