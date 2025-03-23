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

// 清零请求Schema
export const ZeroingRequestSchema = z.object({
    taskNumber: z.string().max(128).optional(),
    mediaAccountId: z.string().optional(),
    mediaPlatform: MediaPlatformId
})

// 第三方API响应Schema
export const ThirdPartyZeroingResponseSchema = z.object({
    code: z.string(),
    message: z.string(),
    data: z
        .object({
            taskId: z.string()
        })
        .optional()
})

// 清零响应Schema
export const ZeroingResponseSchema = z.object({
    code: z.string(),
    message: z.string(),
    data: z
        .object({
            workOrderId: z.string(),
            taskId: z.string(),
            externalTaskId: z.string().optional(),
            status: z.string(),
            mediaPlatform: MediaPlatformEnum,
            mediaAccountId: z.string().optional(),
            createdAt: z.date()
        })
        .optional(),
    traceId: z.string()
})

export type ZeroingRequest = z.infer<typeof ZeroingRequestSchema>
export type ThirdPartyZeroingResponse = z.infer<
    typeof ThirdPartyZeroingResponseSchema
>
export type ZeroingResponse = z.infer<typeof ZeroingResponseSchema>
