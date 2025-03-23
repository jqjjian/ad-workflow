import * as z from 'zod'
import { MediaAccountInfoBaseSchema, CompanyBaseSchema } from './account-common'

/**
 * 媒体账户查询参数Schema
 * 用于查询广告账户列表的API请求参数
 */
export const MediaAccountSearchSchema = z.object({
    mediaAccountId: z.string().optional(),
    mediaAccountName: z.string().optional(),
    mediaPlatform: z.number().optional(),
    companyName: z.string().optional(),
    status: z.number().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    pageNumber: z.number().default(1),
    pageSize: z.number().int().max(250).default(10),
    createTimeRange: z.array(z.any()).optional() // 用于前端日期范围选择器
})

// 导出查询参数类型
export type MediaAccountSearch = z.infer<typeof MediaAccountSearchSchema>

// 媒体账户信息schema
export const MediaAccountInfoSchema = z.array(MediaAccountInfoBaseSchema)
export type MediaAccountInfo = z.infer<typeof MediaAccountInfoSchema>

// 单条申请记录类型
export const ApplicationRecordSchema = z.array(
    z.object({
        taskNumber: z.string(), // 外部工单ID
        taskId: z.string(), // 工单ID
        oeId: z.string(), // FB的oe ID
        mediaAccountInfos: MediaAccountInfoSchema, // 媒体账户信息
        mediaPlatform: z
            .number()
            .int() // 媒体平台：1(Facebook)、2(Google)、5(TikTok)
            .refine((v) => [1, 2, 5].includes(v)),
        status: z
            .number()
            .int() // 工单状态使用数值表示: 10, 20, 30, 40
            .refine((v) => [10, 20, 30, 40].includes(v)),
        feedback: z.string().optional(), // 反馈信息
        company: CompanyBaseSchema, // 公司信息
        createdAt: z.number().int(), // 创建时间
        updatedAt: z.number().int() // 更新时间
    })
)
export type ApplicationRecord = z.infer<typeof ApplicationRecordSchema>

// 分页返回数据结构
export const ApplyRecordDataSchema = z.object({
    total: z.number().int(),
    pages: z.number().int(),
    pageNumber: z.number().int(),
    pageSize: z.number().int(),
    mediaAccountApplications: ApplicationRecordSchema
})
export type ApplyRecordData = z.infer<typeof ApplyRecordDataSchema>

// 完整的API响应类型
export const ApplyRecordResponseSchema = z.object({
    code: z.string(),
    message: z.string().optional(),
    data: ApplyRecordDataSchema
})
export type ApplyRecordResponse = z.infer<typeof ApplyRecordResponseSchema>

// 查询媒体账户申请记录的参数
export const QueryApplyRecordSchema = z.object({
    taskIds: z.string().optional(), // 逗号分隔的任务ID列表
    includeFailedRecords: z.boolean().optional().default(false) // 是否包含失败的记录
})
export type QueryApplyRecordDto = z.infer<typeof QueryApplyRecordSchema>

// 媒体账户Schema定义
export const MediaAccountSchema = z.object({
    // 基本信息
    mediaAccountId: z.string(), // 媒体广告账号id
    mediaAccountName: z.string(), // 媒体广告账号名称
    mediaPlatform: z.number(), // 媒体平台 (1=Facebook, 7=Microsoft Advertising)
    companyName: z.string(), // 公司名称
    status: z.number(), // 状态 (1=审核中, 2=生效中, 3=封户, 4=失效)

    // 资金相关
    balance: z.string().or(z.number()), // 余额
    grantBalance: z.string().or(z.number()).optional(), // 赠送余额
    consumeAmount: z.string().or(z.number()).optional(), // 消耗金额
    conversionAmount: z.string().or(z.number()).optional(), // 转化金额
    conversionRate: z.string().or(z.number()).optional(), // 转化率
    currency: z.string().optional(), // 币种

    // 附加字段 - 在匹配过程中添加
    workOrderId: z.string().optional(), // 工单ID
    userId: z.string().optional(), // 用户ID
    applyTime: z.date().optional(), // 申请时间
    internalStatus: z.string().optional() // 内部工单状态
})

// 媒体账户类型
export type MediaAccount = z.infer<typeof MediaAccountSchema>

// 媒体账户搜索结果Schema
export const MediaAccountSearchResultSchema = z.object({
    total: z.number(),
    mediaAccounts: z.array(MediaAccountSchema),
    pageNumber: z.number(),
    pageSize: z.number(),
    pages: z.number()
})

// 媒体账户搜索结果类型
export type MediaAccountSearchResult = z.infer<
    typeof MediaAccountSearchResultSchema
>

// 媒体账户搜索API响应Schema
export const MediaAccountResponseSchema = z.object({
    success: z.boolean(),
    code: z.string(),
    message: z.string(),
    data: MediaAccountSearchResultSchema.optional()
})

// 媒体账户搜索API响应类型
export type MediaAccountResponse = z.infer<typeof MediaAccountResponseSchema>
