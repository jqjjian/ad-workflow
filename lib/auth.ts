import { auth } from '@/auth'
import { UserRole } from '@prisma/client'

export interface CurrentUser {
    id: string
    name?: string | null
    email?: string | null
    role?: UserRole
}

// 获取当前登录用户
export async function currentUser(): Promise<CurrentUser | null> {
    const session = await auth()

    if (!session || !session.user) {
        return null
    }

    return {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role
    }
}

// 检查用户是否为管理员
export async function isAdmin(): Promise<boolean> {
    const user = await currentUser()
    return user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN'
}

// 检查用户是否为超级管理员
export async function isSuperAdmin(): Promise<boolean> {
    const user = await currentUser()
    return user?.role === 'SUPER_ADMIN'
}
