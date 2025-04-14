import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * 清除所有会话Cookie的API
 * 用于解决JWT解密错误
 */
export async function GET(request: NextRequest) {
    // 获取重定向URL
    const searchParams = request.nextUrl.searchParams
    const redirectTo = searchParams.get('then') || '/login'

    // 检查是否需要重定向
    const shouldRedirect = !!redirectTo

    // 创建响应
    let response

    if (shouldRedirect) {
        // 创建重定向响应
        const url = new URL(redirectTo, request.nextUrl.origin)
        response = NextResponse.redirect(url)
    } else {
        // 创建JSON响应
        response = NextResponse.json(
            {
                status: 'ok',
                message: '会话已清除',
                redirectTo: shouldRedirect ? redirectTo : null
            },
            { status: 200 }
        )
    }

    // 清除所有认证相关Cookie
    const cookiesToClear = [
        'next-auth.session-token',
        'next-auth.csrf-token',
        'next-auth.callback-url',
        'userRole',
        'justLoggedOut'
    ]

    cookiesToClear.forEach((cookieName) => {
        response.cookies.delete(cookieName)
    })

    return response
}
