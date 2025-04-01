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

// 充值金额验证
const amountRegex = /^\d+(\.\d{1,2})?$/
export const AmountSchema = z
    .string()
    .regex(amountRegex, '金额格式不正确，最多支持两位小数')
    .refine((val) => parseFloat(val) > 0, '金额必须大于0')

// 充值请求Schema
export const DepositRequestSchema = z.object({
    taskNumber: z.string().max(128).optional(),
    mediaAccountId: z.string().min(1, '媒体账号ID不能为空'),
    mediaPlatform: MediaPlatformId,
    amount: AmountSchema,
    dailyBudget: z.number().int().positive('每日预算必须大于0')
})

// 充值业务数据Schema
export const DepositBusinessDataSchema = z.object({
    id: z.string().uuid(),
    workOrderId: z.string().uuid(),
    mediaAccountId: z.string(),
    mediaPlatform: MediaPlatformEnum,
    amount: AmountSchema,
    currency: CurrencyEnum,
    dailyBudget: z.number(),
    externalTaskNumber: z.string().max(128).optional(),
    depositStatus: PaymentStatusEnum,
    depositTime: z.date().optional(),
    completedTime: z.date().optional(),
    failureReason: z.string().optional(),
    createdAt: z.date(),
    updatedAt: z.date()
})

// 第三方API响应Schema
export const ThirdPartyDepositResponseSchema = z.object({
    code: z.string(),
    message: z.string(),
    data: z
        .object({
            taskId: z.string()
        })
        .optional()
})

// 更新充值响应Schema
export const DepositResponseSchema = z.object({
    success: z.boolean(),
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
        .optional()
})

// 修改充值工单请求Schema
export const UpdateDepositRequestSchema = z.object({
    taskId: z.string().min(1, '工单ID不能为空'),
    amount: z
        .string()
        .regex(/^\d+(\.\d{1,2})?$/, '金额格式不正确，最多支持两位小数')
        .refine((val) => parseFloat(val) > 0, '金额必须大于0'),
    dailyBudget: z.number().int().positive('每日预算必须大于0')
})

// 修改充值工单响应Schema
export const UpdateDepositResponseSchema = z.object({
    code: z.string(),
    message: z.string(),
    data: z.record(z.unknown()).optional()
})

export type DepositRequest = z.infer<typeof DepositRequestSchema>
export type DepositBusinessData = z.infer<typeof DepositBusinessDataSchema>
export type ThirdPartyDepositResponse = z.infer<
    typeof ThirdPartyDepositResponseSchema
>
export type DepositResponse = z.infer<typeof DepositResponseSchema>
export type UpdateDepositRequest = z.infer<typeof UpdateDepositRequestSchema>
export type UpdateDepositResponse = z.infer<typeof UpdateDepositResponseSchema>
