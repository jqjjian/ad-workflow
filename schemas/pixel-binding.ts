import { z } from 'zod'

// 定义枚举类型
export const PixelBindingTypeEnum = {
    AD_ACCOUNT: 0,
    BM: 1
} as const

export const MediaPlatformEnum = {
    FACEBOOK: 1
} as const

export const PixelBindingRoleEnum = {
    VIEWER: 1,
    ADMIN: 2
} as const

// Pixel绑定请求Schema
export const PixelBindingRequestSchema = z.object({
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
    pixelId: z.string().max(64, '像素ID长度不能超过64个字符'),
    type: z
        .number()
        .refine(
            (val) =>
                val === PixelBindingTypeEnum.AD_ACCOUNT ||
                val === PixelBindingTypeEnum.BM,
            { message: '无效的授权类型' }
        ),
    mediaPlatform: z
        .number()
        .refine((val) => val === MediaPlatformEnum.FACEBOOK, {
            message: '当前仅支持Facebook平台'
        }),
    value: z.string().max(64, '账号ID长度不能超过64个字符'),
    role: z
        .number()
        .refine(
            (val) =>
                val === PixelBindingRoleEnum.VIEWER ||
                val === PixelBindingRoleEnum.ADMIN,
            { message: '无效的角色权限' }
        )
})

// 第三方API响应Schema
export const ThirdPartyPixelBindingResponseSchema = z.object({
    code: z.string(),
    message: z.string(),
    data: z
        .object({
            taskId: z.string()
        })
        .optional()
})

export type PixelBindingRequest = z.infer<typeof PixelBindingRequestSchema>
export type ThirdPartyPixelBindingResponse = z.infer<
    typeof ThirdPartyPixelBindingResponseSchema
>

// 更新绑定pixel工单的请求Schema
export const UpdatePixelBindingRequestSchema = z.object({
    taskId: z.string().min(1, '工单ID不能为空'),
    pixelId: z.string().max(64, '像素ID长度不能超过64个字符'),
    type: z
        .number()
        .refine(
            (val) =>
                val === PixelBindingTypeEnum.AD_ACCOUNT ||
                val === PixelBindingTypeEnum.BM,
            { message: '无效的授权类型' }
        ),
    mediaPlatform: z
        .number()
        .refine((val) => val === MediaPlatformEnum.FACEBOOK, {
            message: '当前仅支持Facebook平台'
        }),
    value: z.string().max(64, '账号ID长度不能超过64个字符'),
    role: z
        .number()
        .refine(
            (val) =>
                val === PixelBindingRoleEnum.VIEWER ||
                val === PixelBindingRoleEnum.ADMIN,
            { message: '无效的角色权限' }
        )
})

export type UpdatePixelBindingRequest = z.infer<
    typeof UpdatePixelBindingRequestSchema
>
