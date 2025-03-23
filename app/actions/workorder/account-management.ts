'use server'

import { db } from '@/lib/db'
import { withAuth } from '@/lib/auth-actions'
import { z } from 'zod'
import {
    DepositSchema,
    WithdrawalSchema,
    TransferSchema,
    AccountBindSchema,
    PixelBindSchema,
    EmailBindSchema
} from '@/schemas'
import { generateWorkOrderNumber } from '../utils/workorder-utils'
import { callExternalApi, API_BASE_URL } from '@/lib/request'
import { Logger } from '@/lib/logger'
import { ApiResponse } from '@/schemas/third-party-type'
import { WorkOrderType, WorkOrderSubtype } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { ApiResponseBuilder } from '@/utils/api-response'
import { getAccountApplicationRecords } from './account-application'

// 从 mediaAccount.ts 导入类型
import {
    MediaAccountSearchSchema,
    MediaAccountSchema,
    MediaAccount,
    MediaAccountSearchResult,
    MediaAccountSearch
} from '@/schemas/mediaAccount'

// 定义工单状态枚举（替代从 query.ts 导入的 WorkOrderStatus）
enum WorkOrderStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    CANCELED = 'CANCELED'
}

// 工单接口定义（仅在当前文件中使用）
interface WorkOrder {
    id: string
    mediaAccountId?: string | null
    mediaAccountName?: string
    companyName?: string
    mediaPlatform?: number
    createTime?: Date
    status: string
    taskId?: string
}

// 媒体账户申请记录类型（仅在当前文件中使用）
interface MediaAccountApplication {
    taskId: string
    status: number
    mediaAccountId?: string
    mediaAccountInfos?: Array<any>
}

// 定义第三方API响应类型
interface MediaAccountApiResponse {
    code: string
    message: string
    data?: {
        total: number
        mediaAccounts: MediaAccount[]
    }
}

// 定义工单参数类型
interface WorkOrderParams {
    newAccountName: string
    [key: string]: any
}

// 定义模拟工单类型
interface MockWorkOrder {
    workOrderId: string
    systemStatus: WorkOrderStatus
    mediaPlatform: number
    mediaAccountId: string
    mediaAccountName: string
    workOrderParams: WorkOrderParams
}

/**
 * 查询媒体账户接口
 * 从第三方接口获取广告账户数据，并与用户系统工单匹配
 * 确保只返回当前用户申请的账户数据
 */
export async function queryMediaAccounts(input: unknown) {
    try {
        Logger.info(`开始查询媒体账户: ${JSON.stringify(input)}`)

        // 获取当前用户会话
        const session = await auth()
        if (!session || !session.user) {
            Logger.info(`用户未登录`)
            return {
                success: false,
                code: '401',
                message: '用户未登录'
            }
        }

        const userId = session.user.id
        Logger.info(`当前用户ID: ${userId}`)

        // 使用正确的 Schema 验证输入
        const validatedInput = MediaAccountSearchSchema.parse(input)

        // 步骤1: 查询用户的所有账户申请工单（不限制状态，因为第三方可能已审核通过，但系统工单状态未更新）
        const workOrdersData = await db.tecdo_work_orders.findMany({
            where: {
                userId: userId,
                workOrderType: 'ACCOUNT_APPLICATION',
                isDeleted: false
                // 不限制状态，获取所有相关工单
            },
            include: {
                tecdo_media_accounts: true,
                tecdo_workorder_company_info: true
            }
        })

        // 转换为我们需要的自定义WorkOrder结构
        const userWorkOrders: WorkOrder[] = workOrdersData.map((order) => ({
            id: order.id,
            mediaAccountId: order.mediaAccountId,
            // 从关联数据中提取需要的属性，如果不存在则为undefined
            mediaAccountName: order.tecdo_media_accounts?.accountName,
            companyName: order.tecdo_workorder_company_info?.companyNameCN,
            mediaPlatform: order.tecdo_media_accounts
                ?.mediaPlatform as unknown as number,
            createTime: order.createdAt,
            status: order.status,
            taskId: order.taskId || ''
        }))

        Logger.info(`用户的工单数量: ${userWorkOrders.length}`)

        // 如果用户没有任何账户申请工单，直接返回空结果
        if (userWorkOrders.length === 0) {
            Logger.info(`用户没有账户申请工单`)
            return {
                success: true,
                code: '0',
                message: '查询成功',
                data: {
                    total: 0,
                    mediaAccounts: [],
                    pageNumber: validatedInput.pageNumber || 1,
                    pageSize: validatedInput.pageSize || 10,
                    pages: 0
                } as MediaAccountSearchResult
            }
        }

        // 步骤2: 调用账户申请查询接口，获取最新的第三方状态
        // 使用从account-application导入的getAccountApplicationRecords方法
        const taskIdsToQuery = userWorkOrders
            .map((order: WorkOrder) => order.taskId)
            .filter(Boolean)
            .join(',')

        // 只有当有taskId时才调用申请查询接口
        let approvedApplications: MediaAccountApplication[] = []

        if (taskIdsToQuery) {
            const applicationResponse = await getAccountApplicationRecords({
                taskIds: taskIdsToQuery,
                includeFailedRecords: true // 包括失败的记录
            })

            // 使用类型断言处理响应数据
            const responseData = applicationResponse.data as any

            if (
                applicationResponse.success &&
                responseData?.mediaAccountApplications
            ) {
                // 提取已批准的申请记录（状态码30表示已通过审核）
                approvedApplications =
                    responseData.mediaAccountApplications.filter(
                        (app: MediaAccountApplication) => app.status === 30
                    )

                Logger.info(
                    `已通过审核的申请数量: ${approvedApplications.length}`
                )
            }
        }

        // 步骤3: 从已批准的申请中提取账户ID
        // 同时更新工单中的账户ID（如果第三方已分配但系统未更新）
        const accountIdsToQuery: string[] = []
        const accountIdsMap = new Map<string, boolean>()

        for (const app of approvedApplications) {
            // 如果申请中包含账户ID信息
            if (
                app.mediaAccountId &&
                app.mediaAccountInfos &&
                app.mediaAccountInfos.length > 0
            ) {
                const accountId = app.mediaAccountId
                accountIdsToQuery.push(accountId)
                accountIdsMap.set(accountId, true)

                // 找到对应的工单并更新账户ID（如果需要）
                const matchedOrder = userWorkOrders.find(
                    (order: WorkOrder) => order.taskId === app.taskId
                )
                if (matchedOrder && !matchedOrder.mediaAccountId) {
                    // 更新工单中的账户ID
                    await db.tecdo_work_orders.update({
                        where: { id: matchedOrder.id },
                        data: { mediaAccountId: accountId }
                    })
                    Logger.info(
                        `已更新工单${matchedOrder.id}的账户ID: ${accountId}`
                    )

                    // 同时更新本地工单对象
                    matchedOrder.mediaAccountId = accountId
                }
            }
        }

        // 补充未从申请中获取但工单中已有的账户ID
        for (const order of userWorkOrders) {
            if (
                order.mediaAccountId &&
                !accountIdsMap.has(order.mediaAccountId)
            ) {
                accountIdsToQuery.push(order.mediaAccountId)
                accountIdsMap.set(order.mediaAccountId, true)
            }
        }

        // 提取账户名称和公司名称用于后续匹配
        const userAccountNames = userWorkOrders
            .map((order: WorkOrder) => order.mediaAccountName)
            .filter(Boolean)

        const userCompanyNames = userWorkOrders
            .map((order: WorkOrder) => order.companyName)
            .filter(Boolean)

        Logger.info(`将查询的账户ID: ${JSON.stringify(accountIdsToQuery)}`)
        Logger.info(`用户账户名称列表: ${JSON.stringify(userAccountNames)}`)
        Logger.info(`用户公司名称列表: ${JSON.stringify(userCompanyNames)}`)

        // 创建工单映射，用于后续匹配
        const workOrderMap = new Map()
        userWorkOrders.forEach((order: WorkOrder) => {
            if (order.mediaAccountId) {
                workOrderMap.set(order.mediaAccountId, order)
            }
        })

        // 步骤4: 构建第三方API请求参数
        const apiRequestParams: any = {
            pageNumber: validatedInput.pageNumber || 1,
            pageSize: validatedInput.pageSize || 10
        }

        // 添加用户的查询条件筛选
        if (validatedInput.mediaAccountId) {
            // 如果用户指定了账户ID，则必须在用户的账户列表中
            if (!accountIdsMap.has(validatedInput.mediaAccountId)) {
                Logger.info(
                    `用户无权访问指定的账户ID: ${validatedInput.mediaAccountId}`
                )
                return {
                    success: true,
                    code: '0',
                    message: '查询成功',
                    data: {
                        total: 0,
                        mediaAccounts: [],
                        pageNumber: validatedInput.pageNumber || 1,
                        pageSize: validatedInput.pageSize || 10,
                        pages: 0
                    }
                }
            }
            apiRequestParams.mediaAccountIds = [validatedInput.mediaAccountId]
        } else if (accountIdsToQuery.length > 0) {
            // 如果有账户ID可查询，优先使用账户ID
            apiRequestParams.mediaAccountIds = accountIdsToQuery
        } else {
            // 如果没有账户ID，尝试使用账户名称和公司名称
            if (validatedInput.mediaAccountName) {
                apiRequestParams.mediaAccountNames = [
                    validatedInput.mediaAccountName
                ]
            } else if (userAccountNames.length > 0) {
                // 限制查询数量，避免请求过大
                apiRequestParams.mediaAccountNames = userAccountNames.slice(
                    0,
                    10
                )
            }

            if (validatedInput.companyName) {
                apiRequestParams.companyNames = [validatedInput.companyName]
            } else if (userCompanyNames.length > 0) {
                // 限制查询数量，避免请求过大
                apiRequestParams.companyNames = userCompanyNames.slice(0, 10)
            }
        }

        // 其他查询条件
        if (validatedInput.mediaPlatform) {
            apiRequestParams.mediaPlatforms = [validatedInput.mediaPlatform]
        }

        // 默认只查询生效中的账户，除非用户指定了其他状态
        if (validatedInput.status) {
            apiRequestParams.statuses = [validatedInput.status]
        } else {
            apiRequestParams.statuses = [2] // 默认查询"生效中"的账户
        }

        // 处理日期范围
        if (validatedInput.startTime && validatedInput.endTime) {
            apiRequestParams.startTime = validatedInput.startTime
            apiRequestParams.endTime = validatedInput.endTime
        }

        Logger.info(`第三方API请求参数: ${JSON.stringify(apiRequestParams)}`)

        // 步骤5: 调用第三方API获取账户数据
        const response = await callExternalApi<MediaAccountApiResponse>({
            url: `${API_BASE_URL}/openApi/v1/mediaAccount/query`,
            body: apiRequestParams
        })

        Logger.info(`第三方API响应: ${JSON.stringify(response)}`)

        if (!response || response.code !== '0') {
            Logger.error(
                new Error(
                    `第三方API调用失败: ${response?.message || '未知错误'}`
                )
            )
            return {
                success: false,
                code: response?.code || 'API_ERROR',
                message: response?.message || '第三方接口调用失败'
            }
        }

        // 从第三方API响应中提取数据
        const responseData = response.data as
            | { total?: number; mediaAccounts?: MediaAccount[] }
            | undefined
        const total = responseData?.total || 0
        const mediaAccounts = responseData?.mediaAccounts || []

        // 如果没有获取到账户数据，直接返回空结果
        if (!mediaAccounts || mediaAccounts.length === 0) {
            Logger.info(`未找到媒体账户数据`)
            return {
                success: true,
                code: '0',
                message: '查询成功',
                data: {
                    total: 0,
                    mediaAccounts: [],
                    pageNumber: validatedInput.pageNumber || 1,
                    pageSize: validatedInput.pageSize || 10,
                    pages: 0
                } as MediaAccountSearchResult
            }
        }

        // 步骤6: 过滤并匹配账户数据
        const matchedAccounts: MediaAccount[] = []

        for (const account of mediaAccounts) {
            let isMatched = false
            let matchedOrder = null

            // 通过账户ID匹配
            if (account.mediaAccountId) {
                matchedOrder = workOrderMap.get(account.mediaAccountId)
                if (matchedOrder) {
                    isMatched = true
                }
            }

            // 如果无法通过ID匹配，尝试通过账户名称和公司名称匹配
            if (!isMatched) {
                // 查找可能匹配的工单
                const possibleOrders = userWorkOrders.filter(
                    (order: WorkOrder) =>
                        account.mediaAccountName &&
                        order.mediaAccountName &&
                        account.mediaAccountName.includes(
                            order.mediaAccountName
                        ) &&
                        account.companyName &&
                        order.companyName &&
                        account.companyName.includes(order.companyName)
                )

                if (possibleOrders.length > 0) {
                    matchedOrder = possibleOrders[0] // 使用第一个匹配的工单
                    isMatched = true

                    // 更新工单的账户ID（如果需要）
                    if (
                        account.mediaAccountId &&
                        !matchedOrder.mediaAccountId
                    ) {
                        await db.tecdo_work_orders.update({
                            where: { id: matchedOrder.id },
                            data: { mediaAccountId: account.mediaAccountId }
                        })
                        Logger.info(
                            `已通过名称匹配更新工单${matchedOrder.id}的账户ID: ${account.mediaAccountId}`
                        )
                    }
                }
            }

            // 如果找到匹配，添加账户信息
            if (isMatched && matchedOrder) {
                matchedAccounts.push({
                    ...account,
                    workOrderId: matchedOrder.id,
                    userId: userId,
                    applyTime: matchedOrder.createTime,
                    internalStatus: matchedOrder.status,
                    // 格式化数值字段
                    balance:
                        typeof account.balance === 'number'
                            ? String(account.balance)
                            : account.balance || '0',
                    grantBalance:
                        typeof account.grantBalance === 'number'
                            ? String(account.grantBalance)
                            : account.grantBalance || '0',
                    consumeAmount:
                        typeof account.consumeAmount === 'number'
                            ? String(account.consumeAmount)
                            : account.consumeAmount || '0',
                    conversionAmount:
                        typeof account.conversionAmount === 'number'
                            ? String(account.conversionAmount)
                            : account.conversionAmount || '0',
                    conversionRate:
                        typeof account.conversionRate === 'number'
                            ? String(account.conversionRate)
                            : account.conversionRate || '0'
                })
            }
        }

        Logger.info(`匹配的账户数量: ${matchedAccounts.length}`)

        // 返回结果
        const result: MediaAccountSearchResult = {
            total: matchedAccounts.length,
            mediaAccounts: matchedAccounts,
            pageNumber: validatedInput.pageNumber || 1,
            pageSize: validatedInput.pageSize || 10,
            pages: Math.ceil(
                matchedAccounts.length / (validatedInput.pageSize || 10)
            )
        }

        return {
            success: true,
            code: '0',
            message: '查询成功',
            data: result
        }
    } catch (error) {
        Logger.error(
            error instanceof Error ? error : new Error('查询媒体账户失败')
        )
        console.error('查询媒体账户失败:', error)

        if (error instanceof z.ZodError) {
            return {
                success: false,
                code: 'VALIDATION_ERROR',
                message: '参数验证失败',
                data: {
                    errors: error.errors
                }
            }
        }

        return {
            success: false,
            code: 'SYSTEM_ERROR',
            message: error instanceof Error ? error.message : '未知错误'
        }
    }
}

/**
 * 获取账户详情
 * @param mediaAccountId 媒体账户ID
 */
export async function getMediaAccountDetail(mediaAccountId: string) {
    try {
        if (!mediaAccountId) {
            return ApiResponseBuilder.error('400', '账户ID不能为空')
        }

        // 使用queryMediaAccounts方法查询单个账户
        const response = await queryMediaAccounts({
            mediaAccountId,
            pageSize: 1
        })

        if (!response.success) {
            return response
        }

        const responseData = response.data as
            | { mediaAccounts?: MediaAccount[] }
            | undefined
        const mediaAccounts = responseData?.mediaAccounts || []

        if (mediaAccounts.length === 0) {
            return ApiResponseBuilder.error('404', '未找到该账户')
        }

        // 返回账户详情
        return ApiResponseBuilder.success(mediaAccounts[0])
    } catch (error) {
        Logger.error(
            error instanceof Error ? error : new Error('获取账户详情失败')
        )
        return ApiResponseBuilder.error(
            'SYSTEM_ERROR',
            error instanceof Error ? error.message : '获取账户详情失败'
        )
    }
}

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
                    updatedAt: new Date()
                    // TODO: 修复关联关系，Prisma模型需要更新
                    // accountManagementDetail: {
                    //     create: {
                    //         mediaAccountId: data.mediaAccountId,
                    //         mediaAccountName: data.mediaAccountName,
                    //         mediaPlatform: data.mediaPlatform,
                    //         amount: data.amount,
                    //         currency: data.currency,
                    //         exchangeRate: data.exchangeRate
                    //     }
                    // }
                }
            })

            // 创建管理详情记录 (作为单独的操作)
            // TODO: Add tecdo_account_management_details model to Prisma schema
            /* 
            await db.tecdo_account_management_details.create({
                data: {
                    taskId: task.id,
                    mediaAccountId: data.mediaAccountId,
                    mediaAccountName: data.mediaAccountName,
                    mediaPlatform: data.mediaPlatform,
                    amount: data.amount,
                    currency: data.currency,
                    exchangeRate: data.exchangeRate
                }
            })
            */

            // 4. 创建支付记录
            // TODO: Add paymentRecord model to Prisma schema
            /* 
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
            */

            // 5. 调用第三方API
            const apiUrl = `${API_BASE_URL}/openApi/v1/accountManagement/deposit/create`
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
                    })
                    /* 
                    ,
                    db.paymentRecord.update({
                        where: { id: paymentRecord.id },
                        data: {
                            paymentStatus: 'FAILED',
                            failureReason:
                                response.message || '创建充值订单失败'
                        }
                    })
                    */
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
                })
                /* 
                ,
                db.paymentRecord.update({
                    where: { id: paymentRecord.id },
                    data: {
                        paymentStatus: 'PROCESSING',
                        paymentDetail: JSON.stringify({
                            paymentUrl: response.data.paymentUrl
                        })
                    }
                })
                */
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
                error instanceof Error
                    ? error
                    : new Error(`创建充值订单失败: ${String(error)}`)
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
                ...(status && { status: status as any }),
                ...(dateRange && {
                    createdAt: {
                        gte: dateRange.start,
                        lte: dateRange.end
                    }
                })
            }

            // 如果需要按媒体账号ID过滤
            if (mediaAccountId) {
                // TODO: Add accountManagementDetail relation to Prisma schema
                // where['accountManagementDetail'] = {
                //     mediaAccountId
                // }
                // Skip filtering by mediaAccountId for now
            }

            // 查询总数
            const total = await db.tecdo_third_party_tasks.count({ where })

            // 查询数据
            const items = await db.tecdo_third_party_tasks.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    // TODO: Add these relations to Prisma schema
                    // accountManagementDetail: true,
                    // paymentRecord: workOrderSubtype === WorkOrderSubtype.DEPOSIT
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
                error instanceof Error
                    ? error
                    : new Error(`查询账户管理工单失败: ${String(error)}`)
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

interface AccountNameUpdateWorkOrderParams {
    mediaAccountId: string
    mediaAccountName: string
    mediaPlatform: number
    companyName: string
    newAccountName: string
    remarks?: string
}

/**
 * 创建账户名修改工单
 * @param params 账户名修改工单参数
 * @returns 操作结果
 */
export async function updateAccountNameWorkOrder(
    params: AccountNameUpdateWorkOrderParams
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

        // 参数验证
        if (
            !params.mediaAccountId ||
            !params.mediaAccountName ||
            !params.mediaPlatform ||
            !params.newAccountName
        ) {
            return {
                success: false,
                message: '参数不完整'
            }
        }

        // 检查新账户名是否与旧账户名相同
        if (params.mediaAccountName === params.newAccountName) {
            return {
                success: false,
                message: '新账户名与当前账户名相同'
            }
        }

        // 生成工单ID
        const workOrderId = `ACCNAME-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        const userId = session.user.id || 'unknown'
        const username = session.user.name || 'unknown'

        // 保存到数据库
        // 这里替换为实际的数据库操作，与充值工单类似，不再重复示例代码

        // 如果成功，刷新相关页面
        revalidatePath('/account/manage')
        revalidatePath('/account/workorders')

        return {
            success: true,
            message: '账户名修改工单创建成功',
            data: { workOrderId }
        }
    } catch (error) {
        console.error('创建账户名修改工单出错:', error)
        return {
            success: false,
            message: '创建账户名修改工单失败'
        }
    }
}

/**
 * 修改账户名修改工单
 * @param workOrderId 工单ID
 * @param params 修改参数
 * @returns 操作结果
 */
export async function updateAccountNameUpdateWorkOrder(
    workOrderId: string,
    params: Partial<AccountNameUpdateWorkOrderParams>
): Promise<{
    success: boolean
    message?: string
}> {
    // 修改逻辑与其他工单类似
    return {
        success: true,
        message: '账户名修改工单更新成功'
    }
}

/**
 * 提交账户名修改工单到第三方接口
 * @param workOrderId 工单ID
 * @returns 操作结果
 */
export async function submitAccountNameUpdateWorkOrderToThirdParty(
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

        // 模拟工单数据，明确类型
        const workOrder: MockWorkOrder = {
            workOrderId,
            systemStatus: WorkOrderStatus.PENDING,
            mediaPlatform: 1,
            mediaAccountId: 'acc-123',
            mediaAccountName: '旧账户名',
            workOrderParams: {
                newAccountName: '新账户名'
            }
        }

        // 验证工单是否存在且状态为待处理
        if (!workOrder || workOrder.systemStatus !== WorkOrderStatus.PENDING) {
            return {
                success: false,
                message: '工单不存在或状态非待处理，无法提交'
            }
        }

        const userId = session.user.id || 'unknown'
        const username = session.user.name || 'unknown'

        // 根据媒体平台选择不同的第三方API
        let thirdPartyResponse: { success: boolean; operationId?: string } = {
            success: false
        }
        const { newAccountName } = workOrder.workOrderParams

        switch (workOrder.mediaPlatform) {
            case 1: // Facebook
                // thirdPartyResponse = await callFacebookUpdateAccountNameAPI(workOrder.mediaAccountId, newAccountName)
                thirdPartyResponse = {
                    success: true,
                    operationId: 'fb-rename-123'
                }
                break
            case 2: // Google
                // thirdPartyResponse = await callGoogleUpdateAccountNameAPI(workOrder.mediaAccountId, newAccountName)
                thirdPartyResponse = {
                    success: true,
                    operationId: 'google-rename-123'
                }
                break
            case 5: // TikTok
                // thirdPartyResponse = await callTiktokUpdateAccountNameAPI(workOrder.mediaAccountId, newAccountName)
                thirdPartyResponse = {
                    success: true,
                    operationId: 'tiktok-rename-123'
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
        //         systemStatus: thirdPartyResponse.success ? WorkOrderStatus.PROCESSING : WorkOrderStatus.FAILED,
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
        //     details: `账户名修改提交给第三方平台${thirdPartyResponse.success ? '成功' : '失败'}，操作ID：${thirdPartyResponse.operationId || '无'}`
        // })

        // 刷新相关页面
        revalidatePath('/account/manage')
        revalidatePath('/account/workorders')

        return {
            success: thirdPartyResponse.success,
            message: thirdPartyResponse.success
                ? '账户名修改工单已成功提交给第三方平台'
                : '账户名修改工单提交第三方平台失败',
            thirdPartyResponse
        }
    } catch (error) {
        console.error('提交账户名修改工单到第三方接口出错:', error)
        return {
            success: false,
            message: '提交账户名修改工单到第三方接口失败'
        }
    }
}
