import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export type ActionResult<T> = {
    code: string
    success: boolean
    message?: string
    data?: T
}

export async function withAuth<T>(
    action: () => Promise<ActionResult<T>>,
    options: {
        requireAdmin?: boolean
        redirectTo?: string
    } = {}
): Promise<ActionResult<T>> {
    const { requireAdmin = false, redirectTo = '/login' } = options
    const session = await auth()

    if (!session) {
        redirect(redirectTo)
    }

    if (requireAdmin && session.user?.role !== 'ADMIN') {
        return {
            code: '1',
            success: false,
            message: '需要管理员权限'
        }
    }

    return action()
}
