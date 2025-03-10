import * as z from 'zod'

export type ApiResponse<T = unknown> = {
    code: string
    success: boolean
    message?: string
    data?: T | null
}
// 基础分页响应格式
const BasePaginationSchema = z.object({
    total: z.number().int(),
    pageNumber: z.number().int(),
    pageSize: z.number().int(),
    pages: z.number().int()
})

// 第三方API的响应类工具函数
export const createPaginationResponseSchema = <T extends z.ZodTypeAny>(
    dataSchema: T,
    dataFieldName: string = 'data' // 默认字段名为 'data'
) => {
    return BasePaginationSchema.extend({
        [dataFieldName]: dataSchema
    })
}

// 第三方API的基础响应格式
export const ThirdPartyResponseSchema = z.object({
    code: z.string(),
    message: z.string().optional(),
    data: z.unknown()
})

// 第三方API的查询参数
export const ThirdPartyQuerySchema = z.object({
    taskId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.number().optional(),
    page: z.number().optional(),
    pageSize: z.number().optional()
})

// 第三方API的业务数据结构
export const ThirdPartyBusinessDataSchema = z.object({
    taskId: z.string(),
    status: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
    businessData: z.object({
        accountId: z.string(),
        accountName: z.string(),
        amount: z.number().optional(),
        currency: z.string().optional()
    })
})

// 导出类型
export type ThirdPartyResponse = z.infer<typeof ThirdPartyResponseSchema>
export type ThirdPartyQuery = z.infer<typeof ThirdPartyQuerySchema>
export type ThirdPartyBusinessData = z.infer<
    typeof ThirdPartyBusinessDataSchema
>

const mediaPlatform = z.number().int().optional()
const mediaAccountId = z.string().optional()
const mediaAccountName = z.string().optional()
const companyName = z.string().optional()
const status = z.number().int().optional()
const pageNumber = z.number().int().optional()
const pageSize = z.number().int().optional()
// const MediaAccounts = z.array(
//     z.object({
//         mediaPlatform: mediaPlatform,
//         mediaAccountId: mediaAccountId,
//         mediaAccountName: mediaAccountName,
//         companyName: companyName,
//         status: status
//     })
// )
const MediaAccountsearchFormSchema = z.object({
    mediaPlatforms: z.array(mediaPlatform).optional().default([]),
    mediaAccountIds: z.array(mediaAccountId).optional().default([]),
    mediaAccountNames: z.array(mediaAccountName).optional().default([]),
    companyNames: z.array(companyName).optional().default([]),
    statuses: z.array(status).optional().default([]),
    pageNumber: pageNumber.optional().default(1),
    pageSize: pageSize.optional().default(50)
})

export type MediaAccountsearch = z.infer<typeof MediaAccountsearchFormSchema>

// export const MediaAccountnResponseSchema = createPaginationResponseSchema(
//     MediaAccounts,
//     'mediaAccounts' // 自定义数据字段名
// )
// export type MediaAccountResponseType = z.infer<
//     typeof MediaAccountnResponseSchema
// >

// 创建媒体账号响应的schema
export const MediaAccountResponseSchema = z.object({
    total: z.number().int().optional().default(0),
    pageNumber: z.number().int().optional().default(1),
    pageSize: z.number().int().optional().default(10),
    pages: z.number().int().optional().default(0),
    mediaAccounts: z
        .array(
            z.object({
                mediaAccountId: z.string().nullable(),
                mediaAccountName: z.string().nullable(),
                companyName: z.string().nullable(),
                mediaPlatform: z.number().nullable(),
                status: z.number().nullable(),
                balance: z.string().nullable(),
                currency: z.string().nullable(),
                deductibleAmount: z.string().nullable(),
                disableReason: z.string().nullable(),
                grantBalance: z.string().nullable(),
                minDailyBudget: z.string().nullable(),
                validGrantBalance: z.string().nullable()
            })
        )
        .optional()
        .default([])
})

export type MediaAccountResponseType = z.infer<
    typeof MediaAccountResponseSchema
>

export const RechargeCreateSchema = z.object({
    taskNumber: z.string(),
    mediaAccountId: z.string(),
    mediaPlatform: z.number().int(),
    amount: z.string(),
    dailyBudget: z.number().int()
})

export type RechargeCreateType = z.infer<typeof RechargeCreateSchema>
