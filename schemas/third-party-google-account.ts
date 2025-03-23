import * as z from 'zod'
import { GoogleAccountSchema } from './google-account'

// Google账户创建请求的验证Schema
export const GoogleAccountCreateRequestSchema = z.object({
    // 任务编号
    taskNumber: z.string().max(128),

    // 媒体账户信息数组，至少包含一个账户信息
    mediaAccountInfos: z
        .array(
            z.object({
                // 账户名称
                name: z.string().max(64, '账户名称不能超过64个字符'),

                // 货币代码
                currencyCode: z.string(),

                // 时区
                timezone: z.string(),

                // 产品类型（可选）
                productType: z.number().int().optional(),

                // 充值金额
                rechargeAmount: z
                    .string()
                    .regex(/^\d+(\.\d{1,2})?$/, '请输入有效的金额格式'),

                // 推广链接数组
                promotionLinks: z.array(z.string().url('请输入有效的链接')),

                // 授权信息数组（可选）
                auths: z
                    .array(
                        z
                            .object({
                                role: z.number().int().optional(),
                                value: z
                                    .string()
                                    .email('请输入有效的邮箱')
                                    .optional()
                            })
                            .nullable()
                    )
                    .optional()
            })
        )
        .min(1, '至少需要一个账户信息')
})

// Google账户创建响应的验证Schema
export const GoogleAccountCreateResponseSchema = z.object({
    code: z.string(),
    success: z.boolean(),
    message: z.string().optional(),
    data: z
        .object({
            taskId: z.number().or(z.string())
        })
        .nullable()
        .optional()
})

// 导出类型定义
export type GoogleAccountCreateRequest = z.infer<
    typeof GoogleAccountCreateRequestSchema
>
export type GoogleAccountCreateResponse = z.infer<
    typeof GoogleAccountCreateResponseSchema
>

// 创建验证函数
export function validateGoogleAccountCreateRequest(
    data: unknown
): GoogleAccountCreateRequest {
    return GoogleAccountCreateRequestSchema.parse(data)
}

// 创建构建请求体的辅助函数
export function buildGoogleAccountCreateRequest(
    taskNumber: string,
    accountData: z.infer<typeof GoogleAccountSchema>
): GoogleAccountCreateRequest {
    return {
        taskNumber,
        mediaAccountInfos: [
            {
                name: accountData.name,
                currencyCode: accountData.currencyCode,
                timezone: accountData.timezone,
                productType: accountData.productType,
                rechargeAmount: accountData.rechargeAmount || '0',
                promotionLinks: accountData.promotionLinks,
                auths: accountData.auths
            }
        ]
    }
}
