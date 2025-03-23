import { z } from 'zod'

// Microsoft Advertising 角色枚举
export const MSARoleEnum = z
    .enum(['VIEWER', 'STANDARD', 'ADMIN'])
    .transform((val) => {
        const roleMap: Record<string, number> = {
            VIEWER: 10, // 查看权限
            STANDARD: 20, // 标准权限
            ADMIN: 30 // 管理员权限
        }
        return roleMap[val]
    })

// 邮箱验证正则
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

// 邮箱绑定请求Schema
export const EmailBindingRequestSchema = z.object({
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
    mediaPlatform: z.number().refine((val) => val === 7, {
        message: '当前仅支持Microsoft Advertising平台'
    }),
    mediaAccountId: z.string().min(1, '媒体账号ID不能为空'),
    value: z
        .string()
        .email('邮箱格式不正确')
        .regex(emailRegex, '邮箱格式不正确'),
    role: z.number().refine((val) => [10, 20, 30].includes(val), {
        message: '无效的角色权限'
    })
})

// 第三方API响应Schema
export const ThirdPartyEmailBindingResponseSchema = z.object({
    code: z.string(),
    message: z.string(),
    data: z
        .object({
            taskId: z.string()
        })
        .optional()
})

export type EmailBindingRequest = z.infer<typeof EmailBindingRequestSchema>
export type ThirdPartyEmailBindingResponse = z.infer<
    typeof ThirdPartyEmailBindingResponseSchema
>

// 更新邮箱绑定请求Schema
export const UpdateEmailBindingRequestSchema = z.object({
    taskId: z.string().min(1, '工单ID不能为空'),
    value: z.string().email('邮箱格式不正确'),
    role: z.number().refine((val) => [10, 20, 30].includes(val), {
        message: '无效的角色权限'
    })
})

export type UpdateEmailBindingRequest = z.infer<
    typeof UpdateEmailBindingRequestSchema
>
