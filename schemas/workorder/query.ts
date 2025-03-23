import * as z from 'zod'
import {
    AuthItemSchema,
    MediaAccountInfoBaseSchema,
    CompanyBaseSchema,
    WorkOrderStatusEnum
} from '../account-common'

// 用于查询的工单状态校验
export const QueryApplyRecordSchema = z.object({
    taskNumbers: z.union([z.string(), z.array(z.string())]).optional(),
    taskIds: z
        .union([
            z.number().int(),
            z.string(),
            z.array(z.string()),
            z.array(z.number().int())
        ])
        .optional(),
    mediaPlatforms: z
        .union([z.number().int(), z.array(z.number().int())])
        .optional(),
    company: z
        .union([CompanyBaseSchema, z.array(CompanyBaseSchema)])
        .optional(),
    statuses: z.union([z.number().int(), z.array(z.number().int())]).optional(),
    oeIds: z.union([z.string(), z.array(z.string())]).optional(),
    startCreatedAt: z.number().optional(),
    endCreatedAt: z.number().optional(),
    startUpdatedAt: z.number().optional(),
    endUpdatedAt: z.number().optional(),
    page: z.number().optional(),
    pageSize: z.number().optional()
})

export type QueryApplyRecordDto = z.infer<typeof QueryApplyRecordSchema>

// 媒体账户信息schema
const MediaAccountInfoSchema = z.array(MediaAccountInfoBaseSchema)

type MediaAccountInfo = z.infer<typeof MediaAccountInfoSchema>

export { MediaAccountInfoSchema, type MediaAccountInfo }

// 单条申请记录类型
const ApplicationRecordSchema = z.array(
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

// 分页返回数据结构
const ApplyRecordDataSchema = z.object({
    total: z.number().int(),
    pages: z.number().int(),
    pageNumber: z.number().int(),
    pageSize: z.number().int(),
    mediaAccountApplications: ApplicationRecordSchema
})

// 完整的API响应类型
const ApplyRecordResponseSchema = z.object({
    code: z.string(),
    message: z.string().optional(),
    data: ApplyRecordDataSchema
})

export type ApplyRecordData = z.infer<typeof ApplyRecordDataSchema>
export type ApplicationRecord = z.infer<typeof ApplicationRecordSchema>
export type ApplyRecordResponse = z.infer<typeof ApplyRecordResponseSchema>
