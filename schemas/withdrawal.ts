import { z } from 'zod'
import { MediaPlatformEnum, CurrencyEnum, PaymentStatusEnum } from './enums'

// 媒体平台ID映射
export const MediaPlatformId = z.enum(['1', '2', '7']).transform((val) => {
    const map: Record<string, z.infer<typeof MediaPlatformEnum>> = {
        '1': 'FACEBOOK',
        '2': 'GOOGLE',
        '7': 'MICROSOFT_ADVERTISING'
    }
    return map[val]
})

// 金额验证Schema
export const AmountSchema = z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, '金额格式不正确，最多支持两位小数')
    .refine((val) => parseFloat(val) > 0, '金额必须大于0')

// 减款请求Schema
export const WithdrawalRequestSchema = z.object({
    taskNumber: z.string().max(128).optional(),
    mediaAccountId: z.string().min(1, '媒体账号ID不能为空'),
    mediaPlatform: MediaPlatformId,
    amount: AmountSchema
})

// 第三方API响应Schema
export const ThirdPartyWithdrawalResponseSchema = z.object({
    code: z.string(),
    message: z.string(),
    data: z
        .object({
            taskId: z.string()
        })
        .optional()
})

// 减款响应Schema
export const WithdrawalResponseSchema = z.object({
    code: z.string(),
    message: z.string(),
    data: z
        .object({
            workOrderId: z.string(),
            taskId: z.string(),
            externalTaskId: z.string().optional(),
            status: PaymentStatusEnum,
            amount: AmountSchema,
            currency: CurrencyEnum,
            createdAt: z.date()
        })
        .optional(),
    traceId: z.string()
})

// 修改减款请求Schema
export const UpdateWithdrawalRequestSchema = z.object({
    taskId: z.string().min(1, '工单ID不能为空'),
    amount: AmountSchema
})

// 修改减款响应Schema
export const UpdateWithdrawalResponseSchema = z.object({
    code: z.string(),
    message: z.string(),
    data: z.record(z.unknown()).optional()
})

export type WithdrawalRequest = z.infer<typeof WithdrawalRequestSchema>
export type ThirdPartyWithdrawalResponse = z.infer<
    typeof ThirdPartyWithdrawalResponseSchema
>
export type WithdrawalResponse = z.infer<typeof WithdrawalResponseSchema>
export type UpdateWithdrawalRequest = z.infer<
    typeof UpdateWithdrawalRequestSchema
>
export type UpdateWithdrawalResponse = z.infer<
    typeof UpdateWithdrawalResponseSchema
>
