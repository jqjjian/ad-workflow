import { z } from 'zod'
import { UserRole } from '@prisma/client'

// 用户查询参数的schema
export const UserQuerySchema = z.object({
    username: z.string().optional(),
    role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'DELETED']).optional(),
    page: z.number().int().positive().optional().default(1),
    pageSize: z.number().int().positive().optional().default(10)
})

// 用户角色更新的schema
export const UserRoleUpdateSchema = z.object({
    userId: z.string().uuid(),
    role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN'])
})

// 用户状态更新的schema
export const UserStatusUpdateSchema = z.object({
    userId: z.string().uuid(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'DELETED'])
})

// 用户密码更新的schema
export const UserPasswordUpdateSchema = z.object({
    userId: z.string().uuid(),
    newPassword: z.string().min(6, '密码长度至少为6位')
})

// 用户删除的schema
export const UserDeleteSchema = z.object({
    userId: z.string().uuid()
})

// 用户模型的schema（用于前端展示）
export const UserSchema = z.object({
    id: z.string().uuid(),
    username: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    email: z.string().email().nullable().optional(),
    role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']),
    status: z.string(),
    createdAt: z.date(),
    lastLoginAt: z.date().nullable().optional(),
    updatedAt: z.date().optional()
})

// 响应数据的schema
export const ActionResponseSchema = z.object({
    success: z.boolean(),
    error: z.string().optional(),
    data: z.any().optional(),
    total: z.number().optional()
})

// 类型定义导出
export type UserQuery = z.infer<typeof UserQuerySchema>
export type UserRoleUpdate = z.infer<typeof UserRoleUpdateSchema>
export type UserStatusUpdate = z.infer<typeof UserStatusUpdateSchema>
export type UserPasswordUpdate = z.infer<typeof UserPasswordUpdateSchema>
export type UserDelete = z.infer<typeof UserDeleteSchema>
export type UserData = z.infer<typeof UserSchema>
export type ActionResponse = z.infer<typeof ActionResponseSchema>
