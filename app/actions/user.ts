'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import bcryptjs from 'bcryptjs'
import { isSuperAdmin } from '@/lib/auth'
import {
    UserQuery,
    UserRoleUpdate,
    UserStatusUpdate,
    UserPasswordUpdate,
    UserDelete,
    ActionResponse,
    UserQuerySchema,
    UserRoleUpdateSchema,
    UserStatusUpdateSchema,
    UserPasswordUpdateSchema,
    UserDeleteSchema
} from '@/schemas/user'

/**
 * 获取用户列表
 */
export async function getUsers(input: UserQuery): Promise<ActionResponse> {
    try {
        // 验证输入
        const validatedInput = UserQuerySchema.safeParse(input)
        if (!validatedInput.success) {
            return {
                success: false,
                error: '参数验证失败: ' + validatedInput.error.message
            }
        }

        // 检查权限
        const hasSuperAdmin = await isSuperAdmin()
        if (!hasSuperAdmin) {
            return {
                success: false,
                error: '无权限执行此操作'
            }
        }

        const { username, role, status, page, pageSize } = validatedInput.data

        // 构建查询条件
        const where: any = {}

        if (username) {
            where.username = {
                contains: username
            }
        }

        if (role) {
            where.role = role
        }

        if (status) {
            where.status = status
        }

        // 不包括已删除的用户（软删除标记为status='DELETED'）
        where.NOT = {
            status: 'DELETED'
        }

        // 执行查询
        const users = await db.tecdo_users.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: {
                createdAt: 'desc'
            }
        })

        // 获取总数
        const total = await db.tecdo_users.count({ where })

        return {
            success: true,
            data: users,
            total
        }
    } catch (error) {
        console.error('获取用户列表失败:', error)
        return {
            success: false,
            error: '获取用户列表失败'
        }
    }
}

/**
 * 更新用户角色
 */
export async function updateUserRole(
    input: UserRoleUpdate
): Promise<ActionResponse> {
    try {
        // 验证输入
        const validatedInput = UserRoleUpdateSchema.safeParse(input)
        if (!validatedInput.success) {
            return {
                success: false,
                error: '参数验证失败: ' + validatedInput.error.message
            }
        }

        // 检查权限
        const hasSuperAdmin = await isSuperAdmin()
        if (!hasSuperAdmin) {
            return {
                success: false,
                error: '无权限执行此操作'
            }
        }

        const { userId, role } = validatedInput.data

        // 更新用户角色
        await db.tecdo_users.update({
            where: { id: userId },
            data: {
                role,
                updatedAt: new Date()
            }
        })

        revalidatePath('/admin/users')

        return {
            success: true
        }
    } catch (error) {
        console.error('更新用户角色失败:', error)
        return {
            success: false,
            error: '更新用户角色失败'
        }
    }
}

/**
 * 更新用户状态（启用/禁用）
 */
export async function updateUserStatus(
    input: UserStatusUpdate
): Promise<ActionResponse> {
    try {
        // 验证输入
        const validatedInput = UserStatusUpdateSchema.safeParse(input)
        if (!validatedInput.success) {
            return {
                success: false,
                error: '参数验证失败: ' + validatedInput.error.message
            }
        }

        // 检查权限
        const hasSuperAdmin = await isSuperAdmin()
        if (!hasSuperAdmin) {
            return {
                success: false,
                error: '无权限执行此操作'
            }
        }

        const { userId, status } = validatedInput.data

        // 查找当前用户，确保不会禁用超级管理员
        const user = await db.tecdo_users.findUnique({
            where: { id: userId }
        })

        if (user?.role === 'SUPER_ADMIN' && status !== 'ACTIVE') {
            return {
                success: false,
                error: '不能禁用超级管理员账户'
            }
        }

        // 更新用户状态
        await db.tecdo_users.update({
            where: { id: userId },
            data: {
                status,
                updatedAt: new Date()
            }
        })

        revalidatePath('/admin/users')

        return {
            success: true
        }
    } catch (error) {
        console.error('更新用户状态失败:', error)
        return {
            success: false,
            error: '更新用户状态失败'
        }
    }
}

/**
 * 更新用户密码
 */
export async function updateUserPassword(
    input: UserPasswordUpdate
): Promise<ActionResponse> {
    try {
        // 验证输入
        const validatedInput = UserPasswordUpdateSchema.safeParse(input)
        if (!validatedInput.success) {
            return {
                success: false,
                error: '参数验证失败: ' + validatedInput.error.message
            }
        }

        // 检查权限
        const hasSuperAdmin = await isSuperAdmin()
        if (!hasSuperAdmin) {
            return {
                success: false,
                error: '无权限执行此操作'
            }
        }

        const { userId, newPassword } = validatedInput.data

        // 加密密码
        const hashedPassword = await bcryptjs.hash(newPassword, 10)

        // 更新用户密码
        await db.tecdo_users.update({
            where: { id: userId },
            data: {
                password: hashedPassword,
                updatedAt: new Date()
            }
        })

        return {
            success: true
        }
    } catch (error) {
        console.error('更新用户密码失败:', error)
        return {
            success: false,
            error: '更新用户密码失败'
        }
    }
}

/**
 * 删除用户（软删除）
 */
export async function deleteUser(input: UserDelete): Promise<ActionResponse> {
    try {
        // 验证输入
        const validatedInput = UserDeleteSchema.safeParse(input)
        if (!validatedInput.success) {
            return {
                success: false,
                error: '参数验证失败: ' + validatedInput.error.message
            }
        }

        // 检查权限
        const hasSuperAdmin = await isSuperAdmin()
        if (!hasSuperAdmin) {
            return {
                success: false,
                error: '无权限执行此操作'
            }
        }

        const { userId } = validatedInput.data

        // 查找当前用户，确保不会删除超级管理员
        const user = await db.tecdo_users.findUnique({
            where: { id: userId }
        })

        if (user?.role === 'SUPER_ADMIN') {
            return {
                success: false,
                error: '不能删除超级管理员账户'
            }
        }

        // 软删除用户
        await db.tecdo_users.update({
            where: { id: userId },
            data: {
                status: 'DELETED',
                updatedAt: new Date()
            }
        })

        revalidatePath('/admin/users')

        return {
            success: true
        }
    } catch (error) {
        console.error('删除用户失败:', error)
        return {
            success: false,
            error: '删除用户失败'
        }
    }
}
