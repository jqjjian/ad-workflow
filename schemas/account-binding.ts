import { z } from 'zod'

// 媒体平台枚举
export const MediaPlatformId = z.enum(['1', '2', '7']).transform((val) => {
    const map: Record<string, z.infer<typeof MediaPlatformEnum>> = {
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
                const exists = await prisma.workOrder.findFirst({
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
    value: z.string().min(1, '绑定ID不能为空'),
    role: z.number().refine(
        (val, ctx) => {
            const platform = ctx.parent.mediaPlatform
            if (platform === 1) {
                // Facebook
                return [10, 20].includes(val)
            } else if (platform === 2) {
                // Google
                return val === 10
            }
            return true
        },
        { message: '无效的角色权限' }
    )
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
    role: z.number().refine(
        (val, ctx) => {
            // 从工单中获取平台信息后验证角色权限
            const platform = ctx.parent.mediaPlatform
            if (platform === 1) {
                // Facebook
                return [10, 20].includes(val)
            } else if (platform === 2) {
                // Google
                return val === 10
            }
            return true
        },
        { message: '无效的角色权限' }
    )
})

export type AccountBindingRequest = z.infer<typeof AccountBindingRequestSchema>
export type ThirdPartyBindingResponse = z.infer<
    typeof ThirdPartyBindingResponseSchema
>
export type UpdateBindingRequest = z.infer<typeof UpdateBindingRequestSchema>
