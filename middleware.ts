// Protecting routes with next-auth
// https://next-auth.js.org/configuration/nextjs#middleware
// https://nextjs.org/docs/app/building-your-application/routing/middleware

import NextAuth from 'next-auth'
import authConfig from '@/auth.config'
import { NextResponse } from 'next/server'
import {
    DEFAULT_LOGIN_REDIRECT,
    apiAuthPrefix,
    authRoutes,
    publicRoutes,
    adminRoutes
} from '@/routes'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
    const { nextUrl } = req
    const isLoggedIn = !!req.auth

    // 完善日志，帮助调试
    try {
        console.log('中间件环境信息:', {
            nodeEnv: process.env.NODE_ENV || 'unknown',
            nextAuthUrl: process.env.NEXTAUTH_URL || 'not-set',
            host: req.headers.get('host') || 'unknown',
            url: nextUrl.toString(),
            isLoggedIn
        })

        console.log(
            '请求cookies:',
            Object.fromEntries(
                req.cookies.getAll().map((c) => [c.name, c.value])
            )
        )
        console.log('认证状态:', JSON.stringify(req.auth, null, 2))
    } catch (error) {
        console.error('日志记录错误:', error)
    }

    // 检测重定向循环
    const redirectCount = parseInt(req.headers.get('x-redirect-count') || '0')
    if (redirectCount > 3) {
        console.error('检测到循环重定向，中止')
        return new NextResponse('检测到循环重定向', { status: 400 })
    }

    // 为所有响应添加缓存控制头
    const response = NextResponse.next()
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    // 设置公共函数用于准备重定向响应
    const prepareRedirect = (url: string) => {
        // 直接使用原始请求的主机和协议
        const host = req.headers.get('host') || '47.113.103.64:3000'
        const protocol = req.headers.get('x-forwarded-proto') || 'http'

        const fullUrl = `${protocol}://${host}${url.startsWith('/') ? url : `/${url}`}`
        console.log('准备重定向到:', fullUrl)

        const redirectResponse = NextResponse.redirect(fullUrl)
        redirectResponse.headers.set(
            'Cache-Control',
            'no-store, no-cache, must-revalidate'
        )
        redirectResponse.headers.set(
            'x-redirect-count',
            (redirectCount + 1).toString()
        )

        return redirectResponse
    }

    // 1. API路由处理
    if (nextUrl.pathname.startsWith(apiAuthPrefix)) {
        return response
    }

    // 2. 认证路由处理
    if (authRoutes.includes(nextUrl.pathname)) {
        if (isLoggedIn) {
            return prepareRedirect(DEFAULT_LOGIN_REDIRECT)
        }
        return response
    }

    // 3. 公开路由处理
    if (publicRoutes.includes(nextUrl.pathname)) {
        return response
    }

    // 4. 根路径重定向处理
    if (nextUrl.pathname === '/') {
        if (isLoggedIn) {
            return prepareRedirect(DEFAULT_LOGIN_REDIRECT)
        }
        return prepareRedirect('/login')
    }

    // 检查是否刚退出登录（通过cookie）- 确保这个检查在未登录检查之前
    const justLoggedOut = req.cookies.get('justLoggedOut')?.value === 'true'
    if (justLoggedOut) {
        console.log('检测到退出登录状态，重定向到登录页面并清除cookie')

        // 使用prepareRedirect函数构建URL
        const redirectResponse = prepareRedirect('/login')

        // 重要：清除justLoggedOut cookie，防止重定向循环
        redirectResponse.cookies.delete('justLoggedOut')

        // 同时清除其他可能导致问题的cookie
        redirectResponse.cookies.delete('userRole')
        // 可能需要清除的其他cookie...

        return redirectResponse
    }

    // 禁用旧会话检测，避免误判导致循环
    /*
    const isLegacySession = req.cookies
        .get('next-auth.session-token')
        ?.value?.startsWith('eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2Q0JDL')
    if (isLegacySession) {
        console.log('检测到旧会话格式，强制清除...')
        return prepareRedirect('/api/auth/clear-session?then=/login')
    }
    */

    // 仅在特殊情况下才清除会话
    const hasSessionTokenButNoAuth =
        !!req.cookies.get('next-auth.session-token')?.value &&
        !req.auth &&
        redirectCount === 0 // 严格限制只重定向一次

    if (hasSessionTokenButNoAuth) {
        console.log('检测到会话token但用户未认证，尝试清除会话...')
        return prepareRedirect('/api/auth/clear-session?then=/login')
    }

    // 8. 管理员路径权限控制
    if (adminRoutes.some((route) => nextUrl.pathname.startsWith(route))) {
        console.log('检查管理员权限:', nextUrl.pathname)

        const role = req.auth?.user?.role
        const sessionRole = req.cookies.get('userRole')?.value

        // 更严格的角色检查
        const isAdmin =
            ['ADMIN', 'SUPER_ADMIN'].includes(role?.toUpperCase() || '') ||
            ['ADMIN', 'SUPER_ADMIN'].includes(sessionRole?.toUpperCase() || '')

        console.log('角色检查:', { role, sessionRole, isAdmin })

        if (!isAdmin) {
            console.log('用户无管理员权限，重定向')
            return prepareRedirect('/application/apply')
        }
    }

    // 放行其他请求
    return response
})

export const config = {
    matcher: [
        '/',
        '/dashboard',
        '/dashboard/:path*',
        '/application',
        '/application/:path*',
        '/account',
        '/account/:path*',
        '/system',
        '/system/:path*',
        '/login',
        '/register',
        '/admin',
        '/admin/:path*'
    ]
}
