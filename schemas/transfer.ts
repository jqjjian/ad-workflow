import { z } from 'zod'
import { MediaPlatformEnum } from './enums'

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

// 转账请求Schema
export const TransferRequestSchema = z
    .object({
        taskNumber: z.string().max(128).optional(),
        mediaPlatform: MediaPlatformId,
        mediaAccountId: z.string().min(1, '源媒体账号ID不能为空'),
        targetMediaAccountId: z.string().min(1, '目标媒体账号ID不能为空'),
        amount: z.string().optional(),
        isMoveAllBalance: z.boolean()
    })
    .refine(
        (data) => {
            // 当isMoveAllBalance为false时，amount必须传入
            if (!data.isMoveAllBalance && !data.amount) {
                return false
            }
            // 当isMoveAllBalance为true时，amount不能传入
            if (data.isMoveAllBalance && data.amount) {
                return false
            }
            return true
        },
        {
            message:
                '当isMoveAllBalance为false时amount必传，为true时amount不能传'
        }
    )

// 第三方API响应Schema
export const ThirdPartyTransferResponseSchema = z.object({
    code: z.string(),
    message: z.string(),
    data: z
        .object({
            taskId: z.string()
        })
        .optional()
})

// 转账响应Schema
export const TransferResponseSchema = z.object({
    code: z.string(),
    message: z.string(),
    data: z
        .object({
            workOrderId: z.string(),
            taskId: z.string(),
            externalTaskId: z.string().optional(),
            status: z.string(),
            mediaPlatform: MediaPlatformEnum,
            sourceAccountId: z.string(),
            targetAccountId: z.string(),
            amount: z.string().optional(),
            isMoveAllBalance: z.boolean(),
            createdAt: z.date()
        })
        .optional(),
    traceId: z.string()
})

// 修改转账请求Schema
export const UpdateTransferRequestSchema = z
    .object({
        taskId: z.string().min(1, '工单ID不能为空'),
        targetMediaAccountId: z.string().min(1, '转入媒体账号ID不能为空'),
        amount: z.string().optional(),
        isMoveAllBalance: z.boolean()
    })
    .refine(
        (data) => {
            // 当isMoveAllBalance为false时，amount必须传入
            if (!data.isMoveAllBalance && !data.amount) {
                return false
            }
            // 当isMoveAllBalance为true时，amount不能传入
            if (data.isMoveAllBalance && data.amount) {
                return false
            }
            return true
        },
        {
            message:
                '当isMoveAllBalance为false时amount必传，为true时amount不能传'
        }
    )

export type TransferRequest = z.infer<typeof TransferRequestSchema>
export type ThirdPartyTransferResponse = z.infer<
    typeof ThirdPartyTransferResponseSchema
>
export type TransferResponse = z.infer<typeof TransferResponseSchema>
export type UpdateTransferRequest = z.infer<typeof UpdateTransferRequestSchema>
