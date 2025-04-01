'use server'

import { db } from '@/lib/db'
// import { withAuth } from '@/lib/auth-actions'
// import { GoogleAccount, TiktokBusiness } from '@/schemas'
import { ApiResponse } from '@/schemas/third-party-type'
import {
    WorkOrderType,
    WorkOrderSubtype,
    WorkOrderStatus
} from '@prisma/client'
import { ApiResponseBuilder } from '@/utils/api-response'
import { auth } from '@/auth'
import { Logger } from '@/lib/logger'
import {
    WorkOrderWithRelations,
    getBusinessData,
    getCompanyInfo,
    getAttachments,
    parseMetadata
} from '@/lib/prisma-helpers'
import { callExternalApi, API_BASE_URL } from '@/lib/request'

// 第三方API请求参数类型定义
export interface ThirdPartyApiRequestParams {
    taskNumbers?: string[]
    taskIds?: string[]
    mediaPlatforms?: number[]
    company?: {
        name?: string
        businessLicenseNo?: string
    }
    statuses?: number[]
    oeIds?: string[]
    startCreatedTimestamp?: number
    endCreatedTimestamp?: number
    startUpdatedTimestamp?: number
    endUpdatedTimestamp?: number
    pageNumber?: number
    pageSize?: number
}

// 第三方API响应数据类型定义
export interface ThirdPartyApiResponse {
    code: string
    message: string | null
    data?: {
        total: number
        pageNumber: number
        pageSize: number
        pages: number
        mediaAccountApplications: ThirdPartyMediaAccountApplication[]
    }
}

// 第三方媒体账户申请数据
export interface ThirdPartyMediaAccountApplication {
    taskNumber: string
    taskId: string
    oeId: string
    mediaPlatform: number
    status: number
    feedback: string
    company: {
        name: string
        companyNameCN: string
        companyNameEN: string
        businessLicenseNo: string
        legalRepName?: string
        idType?: number
        idNumber?: string
        legalRepPhone?: string
        legalRepBankCard?: string
        attachments?: Array<{
            fileName: string
            fileType: string
            fileSize: number
            filePath: string
            ossObjectKey: string
            fileUrl: string
            description?: string
        }>
    }
    mediaAccountInfos: {
        productType: number
        currencyCode: string
        timezone: string
        name: string
        rechargeAmount: number
        promotionLinks: string[]
        auths: any[]
    }[]
    createdTimestamp: number
    updatedAt: number
}

// 合并后的媒体账户申请数据
export interface MergedMediaAccountApplication
    extends ThirdPartyMediaAccountApplication {
    // 可以添加本地数据库特有的字段
    internalStatus?: string
    workOrderId?: string // 添加系统工单ID字段
}

// 添加 ApplyRecordData 接口定义
export interface ApplyRecordData {
    mediaAccountApplications: MergedMediaAccountApplication[]
    total: number
    pages: number
    pageNumber: number
    pageSize: number
}

// 查询参数定义
export interface QueryApplyRecordDto {
    page?: number
    pageSize?: number
    mediaPlatforms?: number | number[] // 媒体平台: 1-Facebook, 2-Google, 3-TikTok
    statuses?: number | number[] // 状态: 1-待处理, 2-处理中, 3-已完成, 4-已失败
    company?: {
        name?: string // 公司名称
        businessLicenseNo?: string // 营业执照号
    }
    taskIds?: string // 多个任务ID，逗号分隔
    oeIds?: string // 多个OE ID，逗号分隔
    promotionLinks?: string[] // 推广链接
    dateRange?: [string, string] // 申请时间范围
    includeFailedRecords?: boolean // 是否包含失败记录，默认不包含
}

// 调用第三方API获取媒体账户申请数据
async function callThirdPartyApi(
    params: ThirdPartyApiRequestParams
): Promise<ThirdPartyApiResponse> {
    try {
        const apiUrl = `${API_BASE_URL}/openApi/v1/mediaAccountApplication/query`

        Logger.info(`调用第三方API: ${apiUrl}`)
        Logger.info(`请求参数: ${JSON.stringify(params, null, 2)}`)

        // 使用正确的callExternalApi调用方式，并指定返回类型
        const response = await callExternalApi<any>({
            url: apiUrl,
            body: params
        })

        Logger.info(`第三方API响应: ${JSON.stringify(response, null, 2)}`)

        // 检查response的格式，并返回符合期望的数据结构
        const result: ThirdPartyApiResponse = {
            code: response.code || 'ERROR',
            message: response.message || null,
            data: response.data
        }

        return result
    } catch (error) {
        const errorObj =
            error instanceof Error
                ? error
                : new Error(`调用第三方API出错: ${String(error)}`)
        Logger.error(errorObj)
        // 返回一个带有错误信息的响应
        return {
            code: 'ERROR',
            message:
                error instanceof Error ? error.message : '调用第三方API失败'
        }
    }
}

// 将数字状态码转换为WorkOrderStatus枚举
function mapStatusToEnum(statusNum: number): WorkOrderStatus {
    switch (statusNum) {
        case 10:
            return WorkOrderStatus.PENDING // 审核中
        case 20:
            return WorkOrderStatus.PROCESSING // 待修改
        case 30:
            return WorkOrderStatus.COMPLETED // 已通过
        case 40:
            return WorkOrderStatus.FAILED // 已拒绝
        default:
            return WorkOrderStatus.PENDING
    }
}

// 将内部状态映射到第三方API的状态码
function mapInternalStatusToThirdParty(status: WorkOrderStatus): number {
    switch (status) {
        case WorkOrderStatus.PENDING:
            return 10 // 审核中
        case WorkOrderStatus.PROCESSING:
            return 20 // 待修改
        case WorkOrderStatus.COMPLETED:
            return 30 // 已通过
        case WorkOrderStatus.FAILED:
            return 40 // 已拒绝
        default:
            return 10
    }
}

// 获取账户申请记录列表
export async function getAccountApplicationRecords(
    query: QueryApplyRecordDto
): Promise<ApiResponse> {
    try {
        Logger.info(`接收查询参数: ${JSON.stringify(query, null, 2)}`)

        const session = await auth()
        if (!session || !session.user) {
            Logger.info(`用户未登录`)
            return ApiResponseBuilder.error('401', '未登录')
        }

        const userId = session.user.id
        Logger.info(`用户ID: ${userId}`)

        // 默认分页参数
        const page = query.page || 1
        const pageSize = query.pageSize || 10

        // 构建查询条件
        const where: any = {
            userId,
            isDeleted: false,
            workOrderType: WorkOrderType.ACCOUNT_APPLICATION
        }

        // 自动排除失败的工单（状态为4），除非明确要求包含它们
        if (!query.includeFailedRecords) {
            where.status = {
                notIn: [WorkOrderStatus.FAILED]
            }
        }

        // 过滤特定媒体平台的工单
        if (query.mediaPlatforms) {
            const platforms = Array.isArray(query.mediaPlatforms)
                ? query.mediaPlatforms
                : [query.mediaPlatforms]

            if (platforms.length > 0) {
                const subtypes: WorkOrderSubtype[] = []
                if (platforms.includes(1))
                    subtypes.push(WorkOrderSubtype.FACEBOOK_ACCOUNT)
                if (platforms.includes(2))
                    subtypes.push(WorkOrderSubtype.GOOGLE_ACCOUNT)
                if (platforms.includes(3))
                    subtypes.push(WorkOrderSubtype.TIKTOK_ACCOUNT)

                if (subtypes.length > 0) {
                    where.workOrderSubtype = { in: subtypes }
                }
            }
        }

        // 工单状态过滤
        if (query.statuses) {
            const statusValues = Array.isArray(query.statuses)
                ? query.statuses
                : [query.statuses]

            if (statusValues.length > 0) {
                // 将状态值映射到对应的WorkOrderStatus枚举
                const workOrderStatuses = statusValues.map((statusNum) =>
                    mapStatusToEnum(Number(statusNum))
                )

                // 如果已经设置了status.notIn（排除失败记录），需要合并筛选条件
                if (where.status && where.status.notIn) {
                    // 保存需要排除的状态
                    const excludedStatuses = where.status.notIn

                    // 更新为使用IN筛选，但确保排除已失败状态
                    const filteredStatuses = workOrderStatuses.filter(
                        (status) => !excludedStatuses.includes(status)
                    )

                    where.status = {
                        in: filteredStatuses
                    }
                } else {
                    where.status = {
                        in: workOrderStatuses
                    }
                }
            }
        }

        // 任务ID过滤
        if (query.taskIds) {
            const taskIdArray = query.taskIds
                .split(',')
                .map((id) => id.trim())
                .filter(Boolean)
            if (taskIdArray.length > 0) {
                where.taskId = { in: taskIdArray }
            }
        }

        // 日期范围过滤
        if (
            query.dateRange &&
            query.dateRange.length === 2 &&
            query.dateRange[0] &&
            query.dateRange[1]
        ) {
            try {
                where.createdAt = {
                    gte: new Date(query.dateRange[0]),
                    lte: new Date(query.dateRange[1])
                }
            } catch (e) {
                Logger.error(new Error(`日期范围解析失败: ${e}`))
                // 忽略无效的日期范围
            }
        }

        // 查询本地数据库工单总数和工单列表
        const total = await db.tecdo_work_orders.count({ where })

        const rawWorkOrders = await db.tecdo_work_orders.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: {
                tecdo_raw_data: true,
                tecdo_workorder_company_info: {
                    include: {
                        tecdo_workorder_company_attachments: true
                    }
                },
                tecdo_account_application_business_data: true
            }
        })

        // 如果本地数据库没有匹配的记录，直接返回空结果
        if (total === 0 || rawWorkOrders.length === 0) {
            return ApiResponseBuilder.success({
                mediaAccountApplications: [],
                total: 0,
                pages: 0,
                pageNumber: page,
                pageSize
            })
        }

        // 转换为类型安全的对象
        const workOrders = rawWorkOrders as unknown as WorkOrderWithRelations[]

        // 收集所有工单的taskId，用于调用第三方API
        const taskIds = workOrders.map((order) => order.taskId).filter(Boolean)
        Logger.info(`本地工单taskIds: ${JSON.stringify(taskIds)}`)

        // 准备第三方API请求参数
        const thirdPartyApiParams: ThirdPartyApiRequestParams = {
            taskIds: taskIds,
            pageNumber: page,
            pageSize: pageSize
        }

        // 添加其他筛选条件
        if (query.mediaPlatforms) {
            thirdPartyApiParams.mediaPlatforms = Array.isArray(
                query.mediaPlatforms
            )
                ? query.mediaPlatforms
                : [query.mediaPlatforms]
        }

        if (query.statuses) {
            thirdPartyApiParams.statuses = Array.isArray(query.statuses)
                ? query.statuses
                : [query.statuses]
        }

        if (query.company) {
            thirdPartyApiParams.company = query.company
        }

        if (query.oeIds) {
            thirdPartyApiParams.oeIds = query.oeIds
                .split(',')
                .map((id) => id.trim())
                .filter(Boolean)
        }

        if (query.dateRange && query.dateRange.length === 2) {
            if (query.dateRange[0]) {
                thirdPartyApiParams.startCreatedTimestamp = new Date(
                    query.dateRange[0]
                ).getTime()
            }
            if (query.dateRange[1]) {
                thirdPartyApiParams.endCreatedTimestamp = new Date(
                    query.dateRange[1]
                ).getTime()
            }
        }

        // 调用第三方API获取媒体账户申请数据
        const thirdPartyResponse = await callThirdPartyApi(thirdPartyApiParams)

        // 第三方API响应后立即添加调试日志
        Logger.info(`第三方API响应状态码: ${thirdPartyResponse.code}`)

        // 添加简单的数据检查日志
        Logger.info(
            `第三方API响应完整数据: ${JSON.stringify(thirdPartyResponse)}`
        )

        // 直接处理第三方数据，无需在此处检查mediaApplicationsFromApi变量
        let thirdPartyApplications: ThirdPartyMediaAccountApplication[] = []

        // 检查response是否实际包含了mediaAccountApplications数据
        // 因为这些位置/路径可能返回数据
        try {
            if (thirdPartyResponse.data?.mediaAccountApplications) {
                // 标准路径
                thirdPartyApplications =
                    thirdPartyResponse.data.mediaAccountApplications
                Logger.info(
                    `从标准路径获取到应用数据，数量: ${thirdPartyApplications.length}`
                )
            }
            // 跳过其他检查
        } catch (e) {
            console.error('解析第三方数据失败:', e)
        }

        // 处理第三方数据映射
        const thirdPartyDataMap = new Map<
            string,
            ThirdPartyMediaAccountApplication
        >()
        thirdPartyApplications.forEach((app) => {
            // 确保taskId被存储为字符串类型，以便后续查找
            const taskIdStr = String(app.taskId)
            thirdPartyDataMap.set(taskIdStr, app)
            console.log('添加映射:', taskIdStr, app.status)
        })

        console.log('第三方数据映射大小:', thirdPartyDataMap.size)
        console.log('本地工单taskIds:', taskIds)

        // 合并本地数据和第三方数据
        const mediaAccountApplications: MergedMediaAccountApplication[] = []

        for (const order of workOrders) {
            // 使用辅助函数安全地访问数据
            const businessData = getBusinessData(order)
            const companyInfo = getCompanyInfo(order)
            const attachments = getAttachments(order)
            const metadata = parseMetadata(order)

            // 获取媒体平台信息
            let mediaPlatform = 1 // 默认为Facebook
            if (order.workOrderSubtype === WorkOrderSubtype.GOOGLE_ACCOUNT)
                mediaPlatform = 2
            else if (order.workOrderSubtype === WorkOrderSubtype.TIKTOK_ACCOUNT)
                mediaPlatform = 5 // 从3改为5，匹配第三方API

            // 解析推广链接
            let promotionLinks: string[] = []
            try {
                if (businessData.promotionLinks) {
                    promotionLinks =
                        JSON.parse(businessData.promotionLinks) || []
                }
            } catch (e) {
                Logger.error(new Error(`解析推广链接失败: ${e}`))
            }

            // 尝试从第三方数据中获取对应的记录
            const thirdPartyData = thirdPartyDataMap.get(String(order.taskId))

            // 在构建每个记录时添加
            console.log(
                `处理工单 ${order.taskId}: 内部状态=${order.status}, 第三方状态=${thirdPartyData?.status || '未找到'}, taskId类型=${typeof order.taskId}`
            )

            // 构建基础应用记录对象
            const baseApplication: MergedMediaAccountApplication = {
                taskNumber: order.taskNumber || '',
                taskId: order.taskId || '',
                workOrderId: order.id || '', // 添加系统工单ID
                oeId: metadata.oeId || '',
                mediaPlatform,
                // 修改这里：不再尝试映射内部状态，而是使用一个特殊值表示未知第三方状态
                status: thirdPartyData?.status || -1, // 使用-1表示未知状态
                feedback: thirdPartyData?.feedback || metadata.feedback || '',
                company: {
                    name: companyInfo.companyNameCN || '',
                    companyNameCN: companyInfo.companyNameCN || '',
                    companyNameEN: companyInfo.companyNameEN || '',
                    businessLicenseNo: companyInfo.businessLicenseNo || '',
                    legalRepName: companyInfo.legalRepName || '',
                    idType: companyInfo.idType || 0,
                    idNumber: companyInfo.idNumber || '',
                    legalRepPhone: companyInfo.legalRepPhone || '',
                    legalRepBankCard: companyInfo.legalRepBankCard || '',
                    attachments: attachments.map((att: any) => ({
                        fileName: att.fileName || '',
                        fileType: att.fileType || '',
                        fileSize: att.fileSize || 0,
                        filePath: att.filePath || '',
                        ossObjectKey: att.ossObjectKey || '',
                        fileUrl: att.fileUrl || '',
                        description: att.description || ''
                    }))
                },
                mediaAccountInfos: [
                    {
                        productType: businessData.productType || 0,
                        currencyCode: businessData.currency || '',
                        timezone: businessData.timezone || '',
                        name: businessData.accountName || '',
                        rechargeAmount: Number(
                            businessData.rechargeAmount || 0
                        ),
                        promotionLinks: Array.isArray(promotionLinks)
                            ? promotionLinks
                            : [],
                        auths: []
                    }
                ],
                createdTimestamp: order.createdAt?.getTime() || 0,
                updatedAt: order.updatedAt?.getTime() || 0,
                internalStatus: order.status as string // 保留内部状态，但不用于前端显示
            }

            // 如果有第三方数据，合并它
            if (thirdPartyData) {
                // 使用第三方数据覆盖或补充本地数据，但处理可能为null的字段
                const mergedApplication: MergedMediaAccountApplication = {
                    ...thirdPartyData,
                    workOrderId: order.id || '', // 添加系统工单ID
                    internalStatus: order.status as string,
                    // 如果第三方数据中company为null，则使用本地数据
                    company: thirdPartyData.company || baseApplication.company,
                    // 确保mediaAccountInfos有效
                    mediaAccountInfos:
                        thirdPartyData.mediaAccountInfos ||
                        baseApplication.mediaAccountInfos
                }

                mediaAccountApplications.push(mergedApplication)
            } else {
                // 如果没有第三方数据，使用本地数据
                mediaAccountApplications.push(baseApplication)
            }
        }

        // 执行本地过滤
        const filteredApplications = mediaAccountApplications.filter((app) => {
            // OE ID过滤
            if (query.oeIds) {
                const oeIdArray = query.oeIds
                    .split(',')
                    .map((id) => id.trim())
                    .filter(Boolean)
                if (oeIdArray.length > 0 && !oeIdArray.includes(app.oeId)) {
                    return false
                }
            }

            // 推广链接过滤
            if (query.promotionLinks && query.promotionLinks.length > 0) {
                const appLinks = app.mediaAccountInfos[0]?.promotionLinks || []
                const hasMatchingLink = appLinks.some((link) =>
                    query.promotionLinks?.includes(link)
                )
                if (!hasMatchingLink) return false
            }

            // 公司名称过滤
            if (
                query.company?.name &&
                !app.company.name.includes(query.company.name)
            ) {
                return false
            }

            // 营业执照号过滤
            if (
                query.company?.businessLicenseNo &&
                !app.company.businessLicenseNo.includes(
                    query.company.businessLicenseNo
                )
            ) {
                return false
            }

            return true
        })

        // 在返回前添加
        console.log(
            '最终返回数据:',
            filteredApplications.map((app) => ({
                taskId: app.taskId,
                workOrderId: app.workOrderId,
                status: app.status,
                internalStatus: app.internalStatus
            }))
        )

        return ApiResponseBuilder.success({
            mediaAccountApplications: filteredApplications,
            total: total, // 使用本地数据库的总数
            pages: Math.ceil(total / pageSize),
            pageNumber: page,
            pageSize
        })
    } catch (error) {
        Logger.error(
            error instanceof Error ? error : new Error('获取账户申请记录失败')
        )
        console.error('获取账户申请记录失败:', error)
        return ApiResponseBuilder.error(
            '1',
            error instanceof Error ? error.message : '未知错误'
        )
    }
}

// 更新媒体账户申请（共用接口，支持所有平台）
export async function updateMediaAccountApplication(
    data: any,
    taskId: string,
    mediaPlatform: number
): Promise<ApiResponse> {
    try {
        const session = await auth()
        if (!session || !session.user) {
            return ApiResponseBuilder.error('401', '未登录')
        }

        const userId = session.user.id
        console.log('用户ID:', userId)
        console.log('更新应用数据:', data)
        console.log('任务ID:', taskId)
        console.log('媒体平台:', mediaPlatform)

        // 根据mediaPlatform确定API路径
        let apiPath = ''
        switch (mediaPlatform) {
            case 2:
                apiPath = '/openApi/v1/mediaAccountApplication/google/update'
                break
            case 1:
                apiPath = '/openApi/v1/mediaAccountApplication/facebook/update'
                break
            case 5:
                apiPath = '/openApi/v1/mediaAccountApplication/tiktok/update'
                break
            default:
                return ApiResponseBuilder.error('400', '不支持的媒体平台')
        }

        // 调用第三方API更新媒体账户申请
        const response = await callExternalApi<any>({
            url: `${API_BASE_URL}${apiPath}`,
            body: {
                taskId,
                userId,
                ...data
            }
        })

        console.log('第三方API更新响应:', response)

        if (response.success && response.code === '0') {
            // 更新本地数据库记录
            // 1. 查找对应的工单
            const workOrder = await db.tecdo_work_orders.findFirst({
                where: {
                    taskId,
                    userId,
                    isDeleted: false
                }
            })

            if (!workOrder) {
                return ApiResponseBuilder.error('404', '找不到对应的工单')
            }

            // 2. 更新工单状态为处理中
            await db.tecdo_work_orders.update({
                where: { id: workOrder.id },
                data: {
                    status: 'PROCESSING',
                    updatedAt: new Date()
                }
            })

            // 3. 记录原始数据
            await db.tecdo_raw_data.create({
                data: {
                    workOrderId: workOrder.id,
                    requestData: JSON.stringify(data),
                    responseData: JSON.stringify(response),
                    syncStatus: 'SUCCESS',
                    lastSyncTime: new Date()
                }
            })

            return ApiResponseBuilder.success({
                taskId,
                workOrderId: workOrder.id,
                message: '更新申请成功'
            })
        } else {
            return ApiResponseBuilder.error(
                response.code || '500',
                response.message || '更新申请失败'
            )
        }
    } catch (error) {
        console.error('更新媒体账户申请失败:', error)
        return ApiResponseBuilder.error(
            '500',
            error instanceof Error ? error.message : '更新申请过程中发生错误'
        )
    }
}

// 根据taskId获取单个账户申请记录
export async function getAccountApplicationRecord(
    taskId: string
): Promise<ApiResponse> {
    try {
        if (!taskId) {
            return ApiResponseBuilder.error('400', 'taskId不能为空')
        }

        // 利用现有的getAccountApplicationRecords方法
        // 使用taskId作为查询条件
        const response = await getAccountApplicationRecords({
            taskIds: taskId,
            pageSize: 1
        })

        if (!response.success) {
            return response
        }

        const data = response.data as ApplyRecordData

        // 如果没有找到记录
        if (
            !data.mediaAccountApplications ||
            data.mediaAccountApplications.length === 0
        ) {
            return ApiResponseBuilder.error('404', '未找到该记录')
        }

        // 返回第一条记录作为详情
        return ApiResponseBuilder.success(data.mediaAccountApplications[0])
    } catch (error) {
        Logger.error(
            error instanceof Error ? error : new Error('获取账户申请详情失败')
        )
        console.error('获取账户申请详情失败:', error)
        return ApiResponseBuilder.error(
            '1',
            error instanceof Error ? error.message : '未知错误'
        )
    }
}

/**
 * 绑定外部任务ID到工单 - 支持任何平台
 * @param workOrderId 工单ID
 * @param externalTaskId 外部任务ID
 * @param mediaPlatform 媒体平台 (1-Facebook, 2-Google, 5-TikTok)
 * @param userId 用户ID
 */
export async function bindExternalTaskIdToWorkOrder(
    workOrderId: string,
    externalTaskId: string,
    mediaPlatform: number,
    userId: string | undefined
): Promise<ApiResponse> {
    Logger.debug(
        `开始绑定外部任务ID: workOrderId=${workOrderId}, externalTaskId=${externalTaskId}, mediaPlatform=${mediaPlatform}, userId=${userId}`
    )

    // 验证登录状态
    const session = await auth()
    if (!session) {
        Logger.debug(`用户未登录`)
        return ApiResponseBuilder.error('401', '未登录')
    }

    if (!userId) {
        Logger.debug(`用户ID为空`)
        return ApiResponseBuilder.error('401', '用户ID不能为空')
    }

    if (!workOrderId) {
        return ApiResponseBuilder.error('400', '工单ID不能为空')
    }

    if (!externalTaskId) {
        return ApiResponseBuilder.error('400', '外部任务ID不能为空')
    }

    try {
        // 查找当前工单
        const workOrder = await db.tecdo_work_orders.findFirst({
            where: {
                id: workOrderId,
                userId,
                isDeleted: false
            }
        })

        if (!workOrder) {
            Logger.debug(`工单不存在: workOrderId=${workOrderId}`)
            return ApiResponseBuilder.error('404', '工单不存在')
        }

        // 检查工单状态是否为待处理
        if (workOrder.status !== WorkOrderStatus.PENDING) {
            Logger.debug(`工单状态不是待处理: status=${workOrder.status}`)
            return ApiResponseBuilder.error(
                '400',
                '只有待处理状态的工单才能绑定外部任务ID'
            )
        }

        // 检查该外部任务ID是否已被其他工单绑定
        const existingOrder = await db.tecdo_work_orders.findFirst({
            where: {
                taskId: externalTaskId,
                isDeleted: false,
                id: { not: workOrderId } // 排除当前工单
            }
        })

        if (existingOrder) {
            Logger.debug(
                `外部任务ID已被其他工单绑定: externalTaskId=${externalTaskId}, existingOrderId=${existingOrder.id}`
            )
            return ApiResponseBuilder.error(
                '400',
                '该申请ID已被其他工单绑定，不能重复绑定'
            )
        }

        // 使用事务处理
        return await db.$transaction(async (tx) => {
            // 更新工单的taskId和状态
            await tx.tecdo_work_orders.update({
                where: { id: workOrderId },
                data: {
                    taskId: externalTaskId,
                    status: WorkOrderStatus.PROCESSING, // 更新为处理中状态
                    updatedAt: new Date()
                }
            })
            Logger.debug(
                `工单taskId和状态更新成功: externalTaskId=${externalTaskId}`
            )

            // 获取最新的rawData
            const rawData = await tx.tecdo_raw_data.findFirst({
                where: { workOrderId },
                orderBy: { createdAt: 'desc' }
            })

            if (rawData) {
                // 更新原始数据状态
                await tx.tecdo_raw_data.update({
                    where: { id: rawData.id },
                    data: {
                        responseData: JSON.stringify({
                            externalTaskId,
                            updateTime: new Date().toISOString()
                        }),
                        syncStatus: 'SUCCESS',
                        lastSyncTime: new Date()
                    }
                })
                Logger.debug(`原始数据状态更新成功`)
            }

            // 更新业务数据状态
            const businessData =
                await tx.tecdo_account_application_business_data.findFirst({
                    where: { workOrderId }
                })

            if (businessData) {
                await tx.tecdo_account_application_business_data.update({
                    where: { id: businessData.id },
                    data: {
                        applicationStatus: 'PROCESSING',
                        metadata: JSON.stringify({ externalTaskId }),
                        updatedAt: new Date()
                    }
                })
                Logger.debug(`业务数据状态更新成功`)
            }

            // 记录审计日志
            await tx.tecdo_audit_logs.create({
                data: {
                    entityType: 'ACCOUNT_APPLICATION',
                    entityId: workOrder.id,
                    action: 'BIND_EXTERNAL_TASK_ID',
                    performedBy: userId,
                    newValue: JSON.stringify({
                        externalTaskId,
                        mediaPlatform,
                        previousStatus: workOrder.status,
                        newStatus: WorkOrderStatus.PROCESSING
                    }),
                    createdAt: new Date()
                }
            })
            Logger.debug(`审计日志记录成功`)

            return ApiResponseBuilder.success({
                workOrderId,
                externalTaskId,
                status: WorkOrderStatus.PROCESSING
            })
        })
    } catch (error) {
        const err =
            error instanceof Error
                ? error
                : new Error(`绑定外部任务ID过程中发生错误`)
        Logger.error(err)
        return ApiResponseBuilder.error(
            '1',
            error instanceof Error ? error.message : '未知错误'
        )
    }
}

// 为了保持向后兼容，保留原有方法，但内部调用新方法
export async function bindExternalTaskId(
    workOrderId: string,
    externalTaskId: string,
    userId: string | undefined
): Promise<ApiResponse> {
    // TikTok的mediaPlatform是5
    return bindExternalTaskIdToWorkOrder(workOrderId, externalTaskId, 5, userId)
}
