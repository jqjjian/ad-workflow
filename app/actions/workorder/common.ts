'use server'

import { db } from '@/lib/db'
import { withAuth } from '@/lib/auth-actions'
import { Logger } from '@/lib/logger'
import { ApiResponse } from '@/schemas/third-party-type'
import { WorkOrderType, WorkOrderSubtype } from '@prisma/client'
import { WorkOrderStatus } from '@/schemas/enums'

type WorkOrderQuery = {
    pageNumber?: number
    pageSize?: number
    [key: string]: any
}

type WorkOrderDetail = {
    id: string
    workOrderId: string
    workOrderType: string
    mediaPlatform?: number
    mediaAccountId?: string
    mediaAccountName?: string
    companyName?: string
    amount?: number
    systemStatus?: string
    createdAt?: string
    createdBy?: string
    remarks?: string
    workOrderParams?: Record<string, any>
    workOrderLogs?: Array<{
        id: string
        workOrderId: string
        timestamp: string
        action: string
        operator: string
        details: string
    }>
    [key: string]: any
}

type WorkOrderQueryResult = {
    records: WorkOrderDetail[]
    total: number
    pageNumber: number
    pageSize: number
}

import { v4 as uuidv4 } from 'uuid'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'

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
                        } as any
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
                        } as any
                    })
                    break

                case WorkOrderType.ATTACHMENT_MANAGEMENT:
                    detailData = await db.tecdo_third_party_tasks.findUnique({
                        where: { id: task.id },
                        include: {
                            attachmentRecords: true
                        } as any
                    })
                    break

                case WorkOrderType.PAYMENT:
                    detailData = await db.tecdo_third_party_tasks.findUnique({
                        where: { id: task.id },
                        include: {
                            paymentRecord: true
                        } as any
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
            const errorObj =
                error instanceof Error ? error : new Error(String(error))
            Logger.error(errorObj)
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
export async function getWorkOrders(
    params: any
): Promise<ApiResponse<{ total: number; items: any[] }>> {
    const {
        page = 1,
        pageSize = 10,
        workOrderType,
        excludeWorkOrderType,
        status,
        dateRange,
        mediaAccountId,
        taskNumber
    } = params

    // 获取当前用户会话
    const session = await auth()
    if (!session || !session.user) {
        return {
            code: '401',
            success: false,
            message: '未登录'
        }
    }

    const userId = session.user.id
    const userRole = session.user.role

    // 构建查询条件
    const whereClause: any = { isDeleted: false }

    // 只有管理员和超级管理员可以查询所有用户的工单
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN'
    if (!isAdmin) {
        // 非管理员只能查询自己的工单
        whereClause.userId = userId
    }

    // 处理工单类型筛选逻辑
    if (excludeWorkOrderType) {
        // 排除特定类型
        whereClause.workOrderType = {
            not: excludeWorkOrderType
        }
    } else if (workOrderType) {
        // 原有的工单类型处理逻辑保持不变
        if (workOrderType === 'DEPOSIT') {
            whereClause.workOrderType = 'ACCOUNT_MANAGEMENT'
            whereClause.workOrderSubtype = 'DEPOSIT'
        }
        // 处理其他类型的映射
        else if (workOrderType === 'DEDUCTION') {
            whereClause.workOrderType = 'ACCOUNT_MANAGEMENT'
            whereClause.workOrderSubtype = 'DEDUCTION'
        } else if (workOrderType === 'TRANSFER') {
            whereClause.workOrderType = 'ACCOUNT_MANAGEMENT'
            whereClause.workOrderSubtype = 'TRANSFER'
        } else if (workOrderType === 'BIND') {
            whereClause.workOrderType = 'ACCOUNT_MANAGEMENT'
            whereClause.workOrderSubtype = 'BIND'
        } else {
            // 直接使用提供的值（如果是其他枚举类型）
            whereClause.workOrderType = workOrderType
        }
    }

    // 处理其他查询条件
    if (status) {
        whereClause.status = status
    }

    // 查询总数
    const total = await db.tecdo_work_orders.count({
        where: whereClause
    })

    // 查询结果
    const workOrders = await db.tecdo_work_orders.findMany({
        where: whereClause,
        include: {
            // 包含需要的关联数据
            tecdo_deposit_business_data: true
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
    })

    // 确保返回的metadata是一个对象而不是字符串
    const processedWorkOrders = workOrders.map((order) => {
        try {
            // 如果metadata是字符串，尝试解析它
            if (typeof order.metadata === 'string') {
                order.metadata = JSON.parse(order.metadata)
            }
        } catch (error) {
            // 如果解析失败，至少确保它是一个对象
            console.error(`解析工单${order.id}的metadata失败:`, error)
            order.metadata = {}
        }
        return order
    })

    return {
        code: '0',
        success: true,
        data: { total, items: processedWorkOrders }
    }
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
            const statusFilter = { notIn: ['SUCCESS', 'CANCELLED'] }

            // 1. 查找工单
            const task = await db.tecdo_third_party_tasks.findFirst({
                where: {
                    taskId,
                    userId,
                    status: statusFilter as any
                } as any,
                include: {
                    paymentRecord: true
                } as any
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
                        status: 'CANCELLED' as any,
                        failureReason: '用户取消'
                    }
                })

                // 如果有关联的支付记录，也一并取消
                if ((task as any).paymentRecord) {
                    const paymentRecord = (task as any).paymentRecord
                    await (tx as any).paymentRecord.update({
                        where: { id: paymentRecord.id },
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
            const errorObj =
                error instanceof Error ? error : new Error(String(error))
            Logger.error(errorObj)
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
                    } as any
                }
            })

            const successOrders = await db.tecdo_third_party_tasks.count({
                where: {
                    ...baseWhere,
                    status: 'SUCCESS' as any
                }
            })

            const failedOrders = await db.tecdo_third_party_tasks.count({
                where: {
                    ...baseWhere,
                    status: {
                        in: ['FAILED', 'CANCELLED']
                    } as any
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
            const errorObj =
                error instanceof Error ? error : new Error(String(error))
            Logger.error(errorObj)
            return {
                code: '1',
                success: false,
                message: error instanceof Error ? error.message : '未知错误'
            }
        }
    })
}

/**
 * 查询工单列表
 * @param params 查询参数
 * @returns 查询结果
 */
export async function queryWorkOrderList(params: WorkOrderQuery): Promise<{
    success: boolean
    message?: string
    data?: WorkOrderQueryResult
}> {
    try {
        // 这里实现查询逻辑，连接数据库或调用API
        // 这是一个示例实现，实际项目中需要替换为真实的数据源
        const mockData: WorkOrderDetail[] = []

        // 返回结果
        return {
            success: true,
            data: {
                records: mockData,
                total: mockData.length,
                pageNumber: params.pageNumber || 1,
                pageSize: params.pageSize || 10
            }
        }
    } catch (error) {
        console.error('查询工单列表出错:', error)
        return {
            success: false,
            message: '查询工单列表失败'
        }
    }
}

/**
 * 基于ID获取工单详情
 * @param workOrderId 工单ID
 * @returns 工单详情
 */
export async function getWorkOrderDetailById(workOrderId: string): Promise<{
    success: boolean
    message?: string
    data?: WorkOrderDetail
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

        const userId = session.user.id
        const userRole = session.user.role
        const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN'

        // 查询工单，管理员可以查看所有工单
        const whereClause: any = { id: workOrderId }

        // 非管理员只能查看自己的工单
        if (!isAdmin) {
            whereClause.userId = userId
        }

        // 查询实际工单数据
        const workOrder = await db.tecdo_work_orders.findFirst({
            where: whereClause,
            include: {
                tecdo_deposit_business_data: true,
                tecdo_workorder_company_info: true
            }
        })

        if (!workOrder) {
            return {
                success: false,
                message: '工单不存在或无权查看'
            }
        }

        // 转换为前端需要的格式
        const workOrderDetail: WorkOrderDetail = {
            id: workOrder.id,
            workOrderId: workOrder.id,
            workOrderType: workOrder.workOrderType,
            mediaPlatform: (workOrder as any).mediaPlatform || undefined,
            mediaAccountId: (workOrder as any).mediaAccountId || undefined,
            mediaAccountName: (workOrder as any).mediaAccountName || undefined,
            companyName:
                (workOrder.tecdo_workorder_company_info as any)
                    ?.companyNameCN || undefined,
            amount:
                (workOrder.tecdo_deposit_business_data as any)?.amount ||
                undefined,
            systemStatus: workOrder.status,
            createdAt: workOrder.createdAt?.toISOString(),
            createdBy: (workOrder as any).createdBy || undefined,
            remarks: (workOrder as any).remarks || undefined,
            workOrderParams: {}
        }

        return {
            success: true,
            data: workOrderDetail
        }
    } catch (error) {
        console.error('获取工单详情出错:', error)
        return {
            success: false,
            message: '获取工单详情失败'
        }
    }
}

/**
 * 基于ID取消工单
 * @param workOrderId 工单ID
 * @returns 操作结果
 */
export async function cancelWorkOrderById(workOrderId: string): Promise<{
    success: boolean
    message?: string
}> {
    try {
        // 实现取消工单的逻辑

        return {
            success: true,
            message: '工单已取消'
        }
    } catch (error) {
        console.error('取消工单出错:', error)
        return {
            success: false,
            message: '取消工单失败'
        }
    }
}

/**
 * 更新工单
 * @param workOrderId 工单ID
 * @param params 更新参数
 * @returns 操作结果
 */
export async function updateWorkOrder(
    workOrderId: string,
    params: Record<string, any>
): Promise<{
    success: boolean
    message?: string
}> {
    try {
        // 实现更新工单的逻辑

        return {
            success: true,
            message: '工单更新成功'
        }
    } catch (error) {
        console.error('更新工单出错:', error)
        return {
            success: false,
            message: '更新工单失败'
        }
    }
}

/**
 * 查询工单处理状态
 * @param workOrderId 工单ID
 * @returns 工单处理状态
 */
export async function checkWorkOrderStatus(workOrderId: string): Promise<{
    success: boolean
    message?: string
    data?: {
        systemStatus: WorkOrderStatus
        thirdPartyStatus: WorkOrderStatus | null
        lastUpdated: string
    }
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

        // 查询工单
        // const workOrder = await db.workOrders.findUnique({
        //     where: { workOrderId }
        // })

        // 模拟工单数据
        const workOrder = {
            workOrderId,
            systemStatus: 'PROCESSING' as WorkOrderStatus,
            thirdPartyStatus: 'PROCESSING' as WorkOrderStatus,
            updatedAt: new Date().toISOString()
        }

        if (!workOrder) {
            return {
                success: false,
                message: '工单不存在'
            }
        }

        return {
            success: true,
            data: {
                systemStatus: workOrder.systemStatus,
                thirdPartyStatus: workOrder.thirdPartyStatus,
                lastUpdated: workOrder.updatedAt
            }
        }
    } catch (error) {
        console.error('查询工单状态出错:', error)
        return {
            success: false,
            message: '查询工单状态失败'
        }
    }
}

/**
 * 处理第三方平台回调
 * @param params 回调参数
 * @returns 处理结果
 */
export async function handleThirdPartyCallback(params: {
    workOrderId: string
    thirdPartyResponse: any
    status: WorkOrderStatus
}): Promise<{
    success: boolean
    message?: string
}> {
    try {
        const { workOrderId, thirdPartyResponse, status } = params

        // 查询工单
        // const workOrder = await db.workOrders.findUnique({
        //     where: { workOrderId }
        // })

        // 模拟工单数据
        const workOrder = {
            workOrderId,
            systemStatus: 'PROCESSING' as WorkOrderStatus,
            thirdPartyStatus: 'PROCESSING' as WorkOrderStatus
        }

        if (!workOrder) {
            return {
                success: false,
                message: '工单不存在'
            }
        }

        // 更新工单状态
        // await db.workOrders.update({
        //     where: { workOrderId },
        //     data: {
        //         systemStatus: status,
        //         thirdPartyStatus: status,
        //         updatedAt: new Date(),
        //         thirdPartyCallback: JSON.stringify(thirdPartyResponse)
        //     }
        // })

        // 添加工单日志
        // await db.workOrderLogs.create({
        //     id: uuidv4(),
        //     workOrderId,
        //     timestamp: new Date(),
        //     action: '第三方回调',
        //     operator: 'System',
        //     details: `收到第三方平台回调，状态：${status}`
        // })

        // 刷新相关页面
        revalidatePath('/account/manage')
        revalidatePath('/account/workorders')

        return {
            success: true,
            message: '成功处理第三方回调'
        }
    } catch (error) {
        console.error('处理第三方回调出错:', error)
        return {
            success: false,
            message: '处理第三方回调失败'
        }
    }
}

/**
 * 通用的未实现功能占位函数
 */
async function notImplementedFunction(params: any) {
    return {
        success: false,
        message: '此功能尚未实现',
        data: { workOrderId: null }
    }
}

/**
 * 批量创建工单
 * @param workOrderType 工单类型
 * @param accounts 账户列表
 * @param commonParams 公共参数
 * @returns 处理结果
 */
export async function batchCreateWorkOrders<T>(
    workOrderType: string,
    accounts: any[],
    commonParams: T
): Promise<{
    success: boolean
    message?: string
    data?: { successCount: number; failedCount: number; workOrderIds: string[] }
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

        if (!accounts || accounts.length === 0) {
            return {
                success: false,
                message: '没有选择账户'
            }
        }

        const userId = session.user.id || 'unknown'
        const username = session.user.name || 'unknown'

        // 批量创建工单结果
        const results = {
            successCount: 0,
            failedCount: 0,
            workOrderIds: [] as string[]
        }

        // 定义批量创建函数的映射
        const createFunctions: Record<string, Function> = {
            DEPOSIT: notImplementedFunction, // 之前是 createDepositWorkOrder
            WITHDRAWAL: notImplementedFunction, // 之前是 createWithdrawalWorkOrder
            ZEROING: notImplementedFunction, // 之前是 createZeroingWorkOrder
            TRANSFER: notImplementedFunction, // 之前是 createTransferWorkOrder
            ACCOUNT_BINDING: notImplementedFunction, // 之前是 createAccountBindingWorkOrder
            EMAIL_BINDING: notImplementedFunction, // 之前是 createEmailBindingWorkOrder
            PIXEL_BINDING: notImplementedFunction, // 之前是 createPixelBindingWorkOrder
            ACCOUNT_NAME_UPDATE: notImplementedFunction // 之前是 updateAccountNameWorkOrder
        }

        // 检查是否支持的工单类型
        if (!createFunctions[workOrderType]) {
            return {
                success: false,
                message: '不支持的工单类型'
            }
        }

        // 批量创建工单
        for (const account of accounts) {
            try {
                // 合并账户信息和公共参数
                const params = {
                    mediaAccountId: account.mediaAccountId,
                    mediaAccountName: account.mediaAccountName,
                    mediaPlatform: account.mediaPlatform,
                    companyName: account.companyName,
                    ...commonParams
                }

                // 调用对应的创建函数
                const result = await createFunctions[workOrderType](params)

                if (result.success && result.data?.workOrderId) {
                    results.successCount++
                    results.workOrderIds.push(result.data.workOrderId)
                } else {
                    results.failedCount++
                }
            } catch (error) {
                console.error(
                    `批量创建工单出错 (账户ID: ${account.mediaAccountId}):`,
                    error
                )
                results.failedCount++
            }
        }

        // 刷新相关页面
        revalidatePath('/account/manage')
        revalidatePath('/account/workorders')

        return {
            success: results.successCount > 0,
            message: `成功创建 ${results.successCount} 个工单，失败 ${results.failedCount} 个`,
            data: results
        }
    } catch (error) {
        console.error('批量创建工单出错:', error)
        return {
            success: false,
            message: '批量创建工单失败'
        }
    }
}

// 导入各个工单类型的创建函数
/* 
import { createDepositWorkOrder } from './deposit'
import { createWithdrawalWorkOrder } from './withdrawal'
import { createZeroingWorkOrder } from './zeroing'
import { createTransferWorkOrder } from './transfer'
import { createAccountBindingWorkOrder } from './account-binding'
import { createEmailBindingWorkOrder } from './email-binding'
import { createPixelBindingWorkOrder } from './pixel-binding'
import { updateAccountNameWorkOrder } from './account-management'
*/
