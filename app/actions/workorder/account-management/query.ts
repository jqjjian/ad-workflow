'use server'

import { db } from '@/lib/db'
import { Logger } from '@/lib/logger'
import { callExternalApi, API_BASE_URL } from '@/lib/request'
import { auth } from '@/auth'
import { ApiResponseBuilder } from '@/utils/api-response'
import { z } from 'zod'
import { getAccountApplicationRecords } from '../account-application'
import {
    MediaAccountSearchSchema,
    MediaAccount,
    MediaAccountSearchResult
} from '@/schemas/mediaAccount'

import {
    WorkOrder,
    MediaAccountApplication,
    MediaAccountApiResponse
} from './types'

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
