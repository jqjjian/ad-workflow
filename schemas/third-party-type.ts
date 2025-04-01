import * as z from 'zod'

// 基础API响应泛型
export type ApiResponse<T = unknown> = {
    code: string
    success: boolean
    message?: string
    data?: T | null
}

// 基础API请求泛型
export interface ApiRequest<T = unknown> {
    url: string
    body: T
    headers?: Record<string, string>
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

// 通用第三方API请求体基础结构
export const ThirdPartyBaseRequestSchema = z.object({
    taskNumber: z.string()
})

// 通用第三方API响应基础结构
export const ThirdPartyBaseResponseSchema = z.object({
    code: z.string(),
    message: z.string().optional(),
    data: z.unknown().optional()
})

// 创建特定业务的请求Schema生成器
export function createBusinessRequestSchema<T extends z.ZodTypeAny>(
    businessDataSchema: T,
    businessField: string = 'businessData'
) {
    return ThirdPartyBaseRequestSchema.extend({
        [businessField]: businessDataSchema
    })
}

// 创建特定业务的响应Schema生成器
export function createBusinessResponseSchema<T extends z.ZodTypeAny>(
    businessDataSchema: T
) {
    return ThirdPartyBaseResponseSchema.extend({
        data: businessDataSchema.optional().nullable()
    })
}

// 导出现有类型
export type ThirdPartyBaseRequest = z.infer<typeof ThirdPartyBaseRequestSchema>
export type ThirdPartyBaseResponse = z.infer<
    typeof ThirdPartyBaseResponseSchema
>

// ==== 以下是针对不同业务的具体类型 ====

// === Google账户应用相关类型 ===

// Google账户媒体信息Schema
export const GoogleMediaAccountInfoSchema = z.object({
    name: z.string().max(64, '账户名称不能超过64个字符'),
    currencyCode: z.string(),
    timezone: z.string(),
    productType: z.number().int(),
    rechargeAmount: z.string().optional(),
    promotionLinks: z.array(z.string().url('请输入有效的链接')),
    auths: z
        .array(
            z.object({
                role: z.number().int().default(1),
                value: z.string().email('请输入有效的邮箱').default('')
            })
        )
        .optional()
        .default([])
})

// Google账户创建请求Schema
export const GoogleAccountCreateRequestSchema = z.object({
    taskNumber: z.string(),
    mediaAccountInfos: z
        .array(GoogleMediaAccountInfoSchema)
        .min(1, '至少需要一个账户信息')
})

// Google账户创建响应Schema
export const GoogleAccountCreateResponseSchema = createBusinessResponseSchema(
    z.object({
        taskId: z.union([z.number(), z.string()])
    })
)

// === Meta(Facebook)账户应用相关类型 ===

// Meta账户媒体信息Schema
export const MetaMediaAccountInfoSchema = z.object({
    name: z.string().max(64, '账户名称不能超过64个字符'),
    currencyCode: z.string(),
    timezone: z.string(),
    businessType: z.number().int().optional(),
    initialBalance: z
        .string()
        .regex(/^\d+(\.\d{1,2})?$/, '请输入有效的金额格式'),
    businessUrls: z.array(z.string().url('请输入有效的链接')),
    permissions: z
        .array(
            z
                .object({
                    permissionLevel: z.number().int().optional(),
                    userEmail: z.string().email('请输入有效的邮箱').optional()
                })
                .nullable()
        )
        .optional()
})

// Meta账户创建请求Schema
export const MetaAccountCreateRequestSchema = z.object({
    taskNumber: z.string(),
    mediaAccountInfos: z
        .array(MetaMediaAccountInfoSchema)
        .min(1, '至少需要一个账户信息')
})

// Meta账户创建响应Schema
export const MetaAccountCreateResponseSchema = createBusinessResponseSchema(
    z.object({
        taskId: z.union([z.number(), z.string()])
    })
)

// === 导出业务相关类型 ===

export type GoogleMediaAccountInfo = z.infer<
    typeof GoogleMediaAccountInfoSchema
>
export type GoogleAccountCreateRequest = z.infer<
    typeof GoogleAccountCreateRequestSchema
>
export type GoogleAccountCreateResponse = z.infer<
    typeof GoogleAccountCreateResponseSchema
>

export type MetaMediaAccountInfo = z.infer<typeof MetaMediaAccountInfoSchema>
export type MetaAccountCreateRequest = z.infer<
    typeof MetaAccountCreateRequestSchema
>
export type MetaAccountCreateResponse = z.infer<
    typeof MetaAccountCreateResponseSchema
>

// === 工具函数 ===

// 创建Google账户请求数据
export function buildGoogleAccountCreateRequest(
    taskNumber: string,
    mediaAccountInfo: GoogleMediaAccountInfo | GoogleMediaAccountInfo[]
): GoogleAccountCreateRequest {
    return {
        taskNumber,
        mediaAccountInfos: Array.isArray(mediaAccountInfo)
            ? mediaAccountInfo
            : [mediaAccountInfo]
    }
}

// 创建Meta账户请求数据
export function buildMetaAccountCreateRequest(
    taskNumber: string,
    mediaAccountInfo: MetaMediaAccountInfo | MetaMediaAccountInfo[]
): MetaAccountCreateRequest {
    return {
        taskNumber,
        mediaAccountInfos: Array.isArray(mediaAccountInfo)
            ? mediaAccountInfo
            : [mediaAccountInfo]
    }
}

// 验证类型的通用函数
export function validateSchema<T extends z.ZodType>(
    schema: T,
    data: unknown
): z.infer<T> {
    return schema.parse(data)
}
