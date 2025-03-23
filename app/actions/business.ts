'use server'
// import { z } from 'zod'
import {
    GoogleAccount,
    TiktokBusiness,
    TiktokBusinessSchema,
    GoogleAccountSchema,
    QueryApplyRecordDto,
    QueryApplyRecordSchema,
    ApplyRecordData,
    MediaAccountsearch,
    MediaAccountsearchFormSchema
} from '@/schemas'
import { MediaAccountResponseType } from '@/schemas/third-party-type'
import { mediaAccountQueryApi } from '@/lib/third-party-api'
import { callExternalApi } from '@/lib/request'
import { Logger } from '@/lib/logger'
import { generateTicketId } from '@/lib/utils'
import { type ApiResponse } from '@/schemas/third-party-type'
import { db } from '@/lib/db'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import type { ThirdPartyTask, PromotionLink } from '@prisma/client'
import { withAuth } from '@/lib/auth-actions'
// google平台开户申请

const openApiUrl =
    process.env.NODE_ENV === 'production'
        ? process.env.OPEN_API_URL
        : process.env.OPEN_API_URL_TEST
// const accessToken =
//     process.env.NODE_ENV === 'production'
//         ? process.env.ACCESS_TOKEN_SECRET
//         : process.env.ACCESS_TOKEN_SECRET_TEST

const API_TIMEOUT = 30000
const TASK_TYPES = {
    FACEBOOK: 1,
    GOOGLE: 2,
    TIKTOK: 5
} as const
// const TASK_STATUS = {
//     INIT: 'INIT',
//     PENDING: 'PENDING',
//     SUCCESS: 'SUCCESS',
//     FAILED: 'FAILED',
//     CANCELLED: 'CANCELLED'
// } as const

//  TikTok企业信息创建建数据类型
export interface TaskDetails {
    companyName: string
    companyNameEN: string
    locationId?: number
    legalRepName: string
    idType: number
    idNumber: string
    legalRepPhone: string
    legalRepBankCard: string
}
// 本地任务数据
export interface TaskData {
    taskNumber: string
    taskId: string
    typeId: TaskType
    promotionLinks: string | string[]
    rawData: GoogleAccount | TiktokBusiness
    rawResponse: ApiResponse<unknown>
    details?: TaskDetails
}

// 首先扩展任务状态枚举
export type TaskStatus = 'INIT' | 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'

// First, let's define the type based on TASK_TYPES values
type TaskType = (typeof TASK_TYPES)[keyof typeof TASK_TYPES]

// 修改createLocalTask函数，增加初始状态
async function createLocalTask({
    taskNumber,
    typeId,
    userId,
    promotionLinks,
    rawData
}: {
    taskNumber: string
    typeId: TaskType
    userId: string
    promotionLinks: string | string[]
    rawData: GoogleAccount | TiktokBusiness
}) {
    // 使用 TASK_TYPES 常量进行验证
    const validTaskTypes = [
        TASK_TYPES.FACEBOOK,
        TASK_TYPES.GOOGLE,
        TASK_TYPES.TIKTOK
    ] as const
    if (!validTaskTypes.includes(typeId)) {
        throw new Error('无效的任务类型')
    }

    return await db.$transaction(async (tx) => {
        // 检查用户是否存在
        const user = await tx.tecdo_users.findUnique({ where: { id: userId } })
        if (!user) {
            throw new Error('用户不存在')
        }

        // 创建任务记录，使用 taskNumber 作为初始 taskId
        const task = await tx.tecdo_third_party_tasks.create({
            data: {
                taskNumber,
                taskId: taskNumber, // 使用 taskNumber 作为初始 taskId
                status: 'INIT',
                typeId,
                userId,
                rawData: JSON.stringify(rawData),
                createdAt: new Date()
            }
        })

        // 创建推广链接
        const linksArray = Array.isArray(promotionLinks)
            ? promotionLinks
            : [promotionLinks].filter(Boolean)

        const createdLinks = await Promise.all(
            linksArray.map((link) =>
                tx.promotionLink.create({
                    data: { link, userId }
                })
            )
        )

        // 关联第一个推广链接
        return await tx.tecdo_third_party_tasks.update({
            where: { id: task.id },
            data: {
                promotionLinkId: createdLinks[0]?.id
            },
            include: {
                promotionLink: true
            }
        })
    })
}

// 第三方接口响应数据类型
// interface ApiResponse<T = unknown> {
//     code: string
//     success: boolean
//     message?: string
//     data?: T | null
// }

// 错误响应数据类型
interface ApiErrorResponse {
    code: string
    message?: string
    success: boolean
}

// 错误处理函数
function handleError(
    error: Error | unknown,
    context: string
): ApiErrorResponse {
    Logger.error(
        new Error(
            `${context}失败: ${error instanceof Error ? error.message : String(error)}`
        )
    )
    return {
        code: '1',
        success: false,
        message: error instanceof Error ? error.message : '未知错误'
    }
}

// 添加统一的错误处理函数
function handleApiError(
    error: Error | unknown,
    task: ThirdPartyTask,
    errorMessage: string
) {
    const failureReason = error instanceof Error ? error.message : '未知错误'
    return db.tecdo_third_party_tasks.update({
        where: { id: task.id },
        data: {
            status: 'FAILED',
            failureReason,
            updatedAt: new Date()
        }
    })
}

// 创建Google开户申请
export async function googleApply(
    data: GoogleAccount,
    userId: string | undefined
): Promise<
    ApiResponse<{
        task: ThirdPartyTask & { promotionLink: PromotionLink | null }
    }>
> {
    return withAuth(async () => {
        if (!userId) {
            return {
                code: '401',
                success: false,
                message: '用户ID不能为空'
            }
        }

        const googleUrl = '/openApi/v1/mediaAccountApplication/google/create'

        const validatedData = GoogleAccountSchema.parse(data)
        if (!validatedData) {
            throw new Error('Google 开户申请数据验证失败')
        }

        const taskNumber = generateTicketId()

        try {
            // 1. 创建本地任务（状态为INIT）
            const localTask = await createLocalTask({
                taskNumber,
                typeId: 1,
                userId,
                promotionLinks: data.promotionLinks,
                rawData: data
            })

            Logger.info(
                `开始处理任务: ${taskNumber}, 用户: ${userId}, 类型: Google开户申请`
            )

            try {
                // 2. 调用第三方接口
                const url = `${openApiUrl}${googleUrl}`
                const response = await callExternalApi<{ taskId: string }>({
                    url,
                    body: {
                        taskNumber,
                        mediaAccountInfos: [{ ...data }]
                    }
                })
                console.log('response', response)
                if (
                    response.code !== '0' ||
                    !('data' in response) ||
                    !response.data?.taskId
                ) {
                    // 3a. 如果第三方接口调用失败，将状态更新为FAILED
                    await db.tecdo_third_party_tasks.update({
                        where: { id: localTask.id },
                        data: {
                            status: 'FAILED',
                            rawResponse: JSON.stringify(response),
                            failureReason: '第三方接口调用失败',
                            updatedAt: new Date()
                        }
                    })
                    return {
                        code: '1',
                        success: false,
                        message: '从第三方收到的taskId无效'
                    }
                }

                // 3b. 如果成功，更新状态为SUCCESS
                const updatedTask = await db.tecdo_third_party_tasks.update({
                    where: { id: localTask.id },
                    data: {
                        taskId: String(response.data.taskId),
                        status: 'SUCCESS',
                        rawResponse: JSON.stringify(response),
                        updatedAt: new Date()
                    },
                    include: {
                        promotionLink: true
                    }
                })

                Logger.info(`本地任务创建成功: ${localTask.id}`)

                return {
                    code: '0',
                    success: true,
                    data: {
                        task: updatedTask
                    }
                }
            } catch (apiError) {
                // 3c. 如果发生异常，更新状态为FAILED
                await db.tecdo_third_party_tasks.update({
                    where: { id: localTask.id },
                    data: {
                        status: 'FAILED',
                        failureReason:
                            apiError instanceof Error
                                ? apiError.message
                                : '未知错误',
                        updatedAt: new Date()
                    }
                })
                throw apiError
            }
        } catch (error) {
            return handleError(error, 'Google 开户申请处理')
        }
    })
}

// 修改Google开户申请
export async function updateGoogleApply(
    data: GoogleAccount,
    userId: string | undefined,
    originalTaskId: string
): Promise<ApiResponse<{ taskId: string }>> {
    return withAuth(async () => {
        if (!userId) {
            return {
                code: '401',
                success: false,
                message: '用户ID不能为空'
            }
        }

        const googleUpdateUrl =
            '/openApi/v1/mediaAccountApplication/google/update'

        const validatedData = GoogleAccountSchema.parse(data)
        console.log('validatedData', validatedData)
        if (!validatedData) {
            throw new Error('Google 修改申请数据验证失败')
        }

        let existingTask:
            | (ThirdPartyTask & { promotionLink: PromotionLink | null })
            | null = null

        try {
            existingTask = await db.tecdo_third_party_tasks.findFirst({
                where: { taskId: originalTaskId, userId },
                include: { promotionLink: true }
            })

            if (!existingTask) {
                return {
                    code: '1',
                    success: false,
                    message: '找不到对应的任务'
                }
            }

            if (!['SUCCESS', 'FAILED'].includes(existingTask.status)) {
                return {
                    code: '1',
                    success: false,
                    message: '当前任务状态不允许修改'
                }
            }

            const url = `${openApiUrl}${googleUpdateUrl}`

            const response = (await Promise.race([
                callExternalApi<{ taskId: string }>({
                    url,
                    body: {
                        taskId: originalTaskId,
                        mediaAccountInfos: [
                            {
                                ...data
                            }
                        ]
                    }
                }),
                new Promise<ApiResponse<{ taskId: string }>>((_, reject) =>
                    setTimeout(() => reject(new Error('请求超时')), API_TIMEOUT)
                )
            ])) as ApiResponse<{ taskId: string }>
            console.log('response', response)
            if (response.code !== '0') {
                await db.tecdo_third_party_tasks.update({
                    where: { id: existingTask.id },
                    data: {
                        status: 'FAILED',
                        failureReason: response.message || '修改失败',
                        rawResponse: JSON.stringify(response),
                        updatedAt: new Date()
                    }
                })
                return {
                    code: '1',
                    success: false,
                    message: response.message || '修改失败'
                }
            }

            const currentTaskId = existingTask.id
            const currentPromotionLinkId = existingTask.promotionLinkId

            await db.$transaction(async (tx) => {
                try {
                    if (currentPromotionLinkId) {
                        await tx.promotionLink.update({
                            where: { id: currentPromotionLinkId },
                            data: {
                                link: Array.isArray(data.promotionLinks)
                                    ? data.promotionLinks[0]
                                    : data.promotionLinks
                            }
                        })
                    }

                    await tx.tecdo_third_party_tasks.update({
                        where: { id: currentTaskId },
                        data: {
                            rawData: JSON.stringify(data),
                            rawResponse: JSON.stringify(response),
                            status: 'SUCCESS',
                            failureReason: null,
                            updatedAt: new Date()
                        }
                    })
                } catch (txError) {
                    // 记录事务失败
                    await tx.tecdo_third_party_tasks.update({
                        where: { id: currentTaskId },
                        data: {
                            status: 'FAILED',
                            failureReason: '事务处理失败',
                            updatedAt: new Date()
                        }
                    })
                    throw txError
                }
            })

            return {
                code: '0',
                success: true,
                data: response.data
            }
        } catch (error) {
            if (existingTask) {
                await db.tecdo_third_party_tasks.update({
                    where: { id: existingTask.id },
                    data: {
                        status: 'FAILED',
                        failureReason:
                            error instanceof Error ? error.message : '未知错误',
                        updatedAt: new Date()
                    }
                })
            }
            Logger.error(new Error('Google 修改申请处理失败'))
            Logger.error(
                error instanceof Error ? error : new Error(String(error))
            )
            return {
                code: '1',
                success: false,
                message: error instanceof Error ? error.message : '未知错误'
            }
        }
    })
}

// 创建TikTok开户申请
export async function tiktokApply(
    data: TiktokBusiness,
    userId: string | undefined
): Promise<
    ApiResponse<{
        task: ThirdPartyTask & { promotionLink: PromotionLink | null }
        details: TaskDetails
    }>
> {
    return withAuth(async () => {
        if (!userId) {
            return { code: '401', success: false, message: '用户ID不能为空' }
        }

        const tiktokUrl = '/openApi/v1/mediaAccountApplication/tt/create'

        const validatedData = TiktokBusinessSchema.parse(data)
        if (!validatedData) {
            return {
                code: '1',
                success: false,
                message: 'Tiktok 开户申请数据验证失败'
            }
        }

        const taskNumber = generateTicketId()

        try {
            // 先在事务中创建本地任务
            const localTask = await createLocalTask({
                taskNumber,
                typeId: 2,
                userId,
                promotionLinks: data.promotionLink,
                rawData: data
            })

            try {
                // 调用第三方接口
                const url = `${openApiUrl}${tiktokUrl}`
                const response = await callExternalApi<{ taskId: string }>({
                    url,
                    body: { taskNumber, ...data }
                })

                if (response.code !== '0' || !response?.data?.taskId) {
                    // 更新本地任务状态为失败
                    await db.tecdo_third_party_tasks.update({
                        where: { id: localTask.id },
                        data: {
                            status: 'FAILED',
                            rawResponse: JSON.stringify(response),
                            failureReason: '从第三方收到的taskId无效',
                            updatedAt: new Date()
                        }
                    })
                    return {
                        code: '1',
                        success: false,
                        message: '从第三方收到的taskId无效'
                    }
                }

                // 更新本地任务的 taskId 和状态
                const updatedTask = await db.tecdo_third_party_tasks.update({
                    where: { id: localTask.id },
                    data: {
                        taskId: String(response.data.taskId),
                        status: 'SUCCESS',
                        rawResponse: JSON.stringify(response),
                        updatedAt: new Date()
                    },
                    include: {
                        promotionLink: true
                    }
                })

                return {
                    code: '0',
                    success: true,
                    data: {
                        task: updatedTask,
                        details: data.registrationDetails as TaskDetails
                    }
                }
            } catch (apiError) {
                // 如果API调用失败，更新任务状态
                await db.tecdo_third_party_tasks.update({
                    where: { id: localTask.id },
                    data: {
                        status: 'FAILED',
                        failureReason:
                            apiError instanceof Error
                                ? apiError.message
                                : '未知错误',
                        updatedAt: new Date()
                    }
                })
                throw apiError
            }
        } catch (error) {
            return handleError(error, 'Tiktok 开户申请处理')
        }
    })
}

// 修改TikTok开户申请
export async function updateTiktokApply(
    data: TiktokBusiness,
    userId: string | undefined,
    originalTaskId: string
): Promise<
    ApiResponse<{
        task: ThirdPartyTask & { promotionLink: PromotionLink | null }
        details: TaskDetails
    }>
> {
    return withAuth(async () => {
        if (!userId) {
            return { code: '401', success: false, message: '用户ID不能为空' }
        }

        const tiktokUpdateUrl = '/openApi/v1/mediaAccountApplication/tt/update'

        const validatedData = TiktokBusinessSchema.parse(data)
        if (!validatedData) {
            return {
                code: '1',
                success: false,
                message: 'Tiktok 修改申请数据验证失败'
            }
        }

        let existingTask:
            | (ThirdPartyTask & { promotionLink: PromotionLink | null })
            | null = null

        try {
            existingTask = await db.tecdo_third_party_tasks.findFirst({
                where: { taskId: originalTaskId, userId },
                include: { promotionLink: true }
            })

            if (!existingTask) {
                return {
                    code: '1',
                    success: false,
                    message: '找不到对应的任务'
                }
            }

            if (!['SUCCESS', 'FAILED'].includes(existingTask.status)) {
                return {
                    code: '1',
                    success: false,
                    message: '当前任务状态不允许修改'
                }
            }

            const url = `${openApiUrl}${tiktokUpdateUrl}`

            const response = (await Promise.race([
                callExternalApi<{ taskId: string }>({
                    url,
                    body: { taskId: originalTaskId, ...data }
                }),
                new Promise<ApiResponse<{ taskId: string }>>((_, reject) =>
                    setTimeout(() => reject(new Error('请求超时')), API_TIMEOUT)
                )
            ])) as ApiResponse<{ taskId: string }>

            if (response.code !== '0') {
                await db.tecdo_third_party_tasks.update({
                    where: { id: existingTask.id },
                    data: {
                        status: 'FAILED',
                        failureReason: response.message || '修改失败',
                        rawResponse: JSON.stringify(response),
                        updatedAt: new Date()
                    }
                })
                return {
                    code: '1',
                    success: false,
                    message: response.message || '修改失败'
                }
            }

            const currentTaskId = existingTask.id
            const currentPromotionLinkId = existingTask.promotionLinkId

            await db.$transaction(async (tx) => {
                try {
                    if (currentPromotionLinkId) {
                        await tx.promotionLink.update({
                            where: { id: currentPromotionLinkId },
                            data: { link: data.promotionLink }
                        })
                    }

                    await tx.tecdo_third_party_tasks.update({
                        where: { id: currentTaskId },
                        data: {
                            rawData: JSON.stringify(data),
                            rawResponse: JSON.stringify(response),
                            status: 'SUCCESS',
                            failureReason: null,
                            updatedAt: new Date()
                        }
                    })
                } catch (txError) {
                    // 记录事务失败
                    await tx.tecdo_third_party_tasks.update({
                        where: { id: currentTaskId },
                        data: {
                            status: 'FAILED',
                            failureReason: '事务处理失败',
                            updatedAt: new Date()
                        }
                    })
                    throw txError
                }
            })

            return {
                code: '0',
                success: true,
                data: {
                    task: existingTask,
                    details: data.registrationDetails as TaskDetails
                }
            }
        } catch (error) {
            if (existingTask) {
                await db.tecdo_third_party_tasks.update({
                    where: { id: existingTask.id },
                    data: {
                        status: 'FAILED',
                        failureReason:
                            error instanceof Error ? error.message : '未知错误',
                        updatedAt: new Date()
                    }
                })
            }
            Logger.error(new Error('Tiktok 修改申请处理失败'))
            Logger.error(
                error instanceof Error ? error : new Error(String(error))
            )
            return {
                code: '1',
                success: false,
                message: error instanceof Error ? error.message : '未知错误'
            }
        }
    })
}
// 获取申请记录
export async function getApplyRecord(
    params: QueryApplyRecordDto
): Promise<ApiResponse<ApplyRecordData>> {
    return withAuth(async () => {
        const API_URL = '/openApi/v1/mediaAccountApplication/query'
        const validatedParams = QueryApplyRecordSchema.parse(params)
        if (!validatedParams) {
            return {
                code: '1',
                success: false,
                message: '查询申请记录数据验证失败'
            }
        }
        try {
            const response = await callExternalApi<ApplyRecordData>({
                url: `${openApiUrl}${API_URL}`,
                body: {
                    ...params,
                    page: params.page || 1,
                    pageSize: params.pageSize || 10,
                    mediaPlatforms: params.mediaPlatforms
                        ? [params.mediaPlatforms]
                        : [],
                    taskNumbers: params.taskNumbers ? [params.taskNumbers] : [],
                    taskIds: params.taskIds ? [params.taskIds] : [],
                    oeIds: params.oeIds ? [params.oeIds] : [],
                    statuses: params.statuses ? [params.statuses] : [],
                    company: (() => {
                        if (
                            !params.company ||
                            Object.keys(params.company).length === 0
                        )
                            return []

                        const filteredCompany = Object.fromEntries(
                            Object.entries(params.company).filter(
                                ([_, value]) =>
                                    value !== undefined &&
                                    value !== null &&
                                    value !== ''
                            )
                        )

                        return Object.keys(filteredCompany).length > 0
                            ? [filteredCompany]
                            : []
                    })()
                }
            })
            if (response.code !== '0') {
                return {
                    code: '1',
                    success: false,
                    message: response.message || '查询失败'
                }
            }

            return {
                code: '0',
                success: true,
                data: response.data || {
                    pageSize: 0,
                    total: 0,
                    pages: 0,
                    pageNumber: 0,
                    mediaAccountApplications: []
                }
            }
        } catch (error) {
            Logger.error(new Error('查询申请记录失败'))
            Logger.error(
                error instanceof Error ? error : new Error(String(error))
            )
            return {
                code: '1',
                success: false,
                message: error instanceof Error ? error.message : '未知错误'
            }
        }
    })
}

// 添加定时清理任务的函数
export async function cleanupStaleInitTasks(
    batchSize = 100
): Promise<ApiResponse<void>> {
    return withAuth(
        async () => {
            const staleTimeout = 1 * 60 * 60 * 1000 // 1小时，可根据需求调整

            try {
                const staleTasks = await db.tecdo_third_party_tasks.findMany({
                    where: {
                        status: 'INIT',
                        createdAt: {
                            lt: new Date(Date.now() - staleTimeout)
                        }
                    },
                    take: batchSize
                })

                await db.$transaction(async (tx) => {
                    for (const task of staleTasks) {
                        // 删除关联的推广链接
                        if (task.promotionLinkId) {
                            await tx.promotionLink.delete({
                                where: { id: task.promotionLinkId }
                            })
                        }

                        // 将任务状态更新为CANCELLED
                        await tx.tecdo_third_party_tasks.update({
                            where: { id: task.id },
                            data: {
                                status: 'CANCELLED',
                                failureReason: '任务超时未完成',
                                updatedAt: new Date()
                            }
                        })
                    }
                })

                return {
                    code: '0',
                    success: true,
                    message: `已清理 ${staleTasks.length} 个过期任务`
                }
            } catch (error) {
                Logger.error(new Error('清理过期任务失败'))
                Logger.error(
                    error instanceof Error ? error : new Error(String(error))
                )
                return {
                    code: '1',
                    success: false,
                    message: error instanceof Error ? error.message : '未知错误'
                }
            }
        },
        { requireAdmin: true } // 要求管理员权限
    )
}

// 查询媒体账号列表
export async function queryMediaAccounts(
    params: MediaAccountsearch
): Promise<ApiResponse<MediaAccountResponseType>> {
    return withAuth(async () => {
        try {
            // 1. 参数验证和转换提前
            const validatedParams = MediaAccountsearchFormSchema.parse(params)
            if (!params) {
                return {
                    code: '400',
                    success: false,
                    message: '查询参数不能为空',
                    data: null
                }
            }
            if (!validatedParams) {
                return {
                    code: '400',
                    success: false,
                    message: '查询参数验证失败',
                    data: null
                }
            }

            const convertedParams = {
                pageNumber: params.pageNumber || 1,
                pageSize: params.pageSize || 10,
                mediaPlatforms: params.mediaPlatform
                    ? [params.mediaPlatform]
                    : [],
                mediaAccountIds: params.mediaAccountId
                    ? [params.mediaAccountId]
                    : [],
                mediaAccountNames: params.mediaAccountName
                    ? [params.mediaAccountName]
                    : [],
                companyNames: params.companyName ? [params.companyName] : [],
                statuses: params.status ? [params.status] : []
            }

            // 2. 调用第三方接口
            const response = await mediaAccountQueryApi(convertedParams)

            // 3. 统一返回结果格式
            return {
                code: response.code,
                success: response.code === '0',
                message: response.message,
                data: response.code === '0' ? response.data : null
            }
        } catch (error) {
            Logger.error(new Error('查询媒体账号列表失败'))
            Logger.error(
                error instanceof Error ? error : new Error(String(error))
            )
            return {
                code: '400',
                success: false,
                message: error instanceof Error ? error.message : '查询失败',
                data: null
            }
        }
    })
}
