import { z } from 'zod'
import { db } from '@/lib/db'

// const prisma = new PrismaClient()

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

// Facebook角色枚举
export const FacebookRoleEnum = z
    .enum(['STANDARD', 'VIEWER'])
    .transform((val) => {
        const roleMap: Record<string, number> = {
            STANDARD: 10,
            VIEWER: 20
        }
        return roleMap[val]
    })

// Google角色枚举
export const GoogleRoleEnum = z.enum(['STANDARD']).transform(() => 10)

// 账号绑定请求Schema
export const AccountBindingRequestSchema = z.object({
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
    mediaPlatform: z.union([z.literal(1), z.literal(2), z.literal(7)]),
    mediaAccountId: z.string().min(1, '媒体账号ID不能为空'),
    value: z.string().min(1, '绑定ID不能为空'),
    role: z.number()
})

// 第三方API响应Schema
export const ThirdPartyBindingResponseSchema = z.object({
    code: z.string(),
    message: z.string(),
    data: z
        .object({
            taskId: z.string()
        })
        .optional()
})

// 修改绑定请求Schema
export const UpdateBindingRequestSchema = z.object({
    taskId: z.string().min(1, '工单ID不能为空'),
    value: z.string().min(1, '绑定ID不能为空'),
    role: z.number()
})

export type AccountBindingRequest = z.infer<typeof AccountBindingRequestSchema>
export type ThirdPartyBindingResponse = z.infer<
    typeof ThirdPartyBindingResponseSchema
>
export type UpdateBindingRequest = z.infer<typeof UpdateBindingRequestSchema>
