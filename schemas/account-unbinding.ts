import { z } from 'zod'
import { db } from '@/lib/db'
// 媒体平台枚举
export const MediaPlatformId = z.enum(['1', '2', '7']).transform((val) => {
    const map: Record<string, 'FACEBOOK' | 'GOOGLE' | 'MICROSOFT_ADVERTISING'> =
        {
            '1': 'FACEBOOK',
            '2': 'GOOGLE',
            '7': 'MICROSOFT_ADVERTISING'
        }
    return map[val]
})

// 解绑请求Schema
export const AccountUnbindingRequestSchema = z.object({
    taskNumber: z
        .string()
        .max(128)
        .optional()
        .refine(
            async (val) => {
                if (!val) return true
                // 检查taskNumber唯一性
                const exists = await db.tecdo_work_orders.findFirst({
                    where: { taskNumber: val }
                })
                return !exists
            },
            { message: '工单编号已存在' }
        ),
    mediaPlatform: z.number().refine((val) => [1, 2, 7].includes(val), {
        message: '无效的媒体平台'
    }),
    mediaAccountId: z.string().min(1, '媒体账号ID不能为空'),
    value: z.string().min(1, '解绑ID不能为空')
})

// 第三方API响应Schema
export const ThirdPartyUnbindingResponseSchema = z.object({
    code: z.string(),
    message: z.string(),
    data: z
        .object({
            taskId: z.string()
        })
        .optional()
})

// 修改解绑请求Schema
export const UpdateUnbindingRequestSchema = z.object({
    taskId: z.string().min(1, '工单ID不能为空'),
    value: z.string().min(1, '解绑ID不能为空')
})

export type AccountUnbindingRequest = z.infer<
    typeof AccountUnbindingRequestSchema
>
export type ThirdPartyUnbindingResponse = z.infer<
    typeof ThirdPartyUnbindingResponseSchema
>
export type UpdateUnbindingRequest = z.infer<
    typeof UpdateUnbindingRequestSchema
>
