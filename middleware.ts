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

    // 中间件最开始添加
    console.log(
        '所有请求cookies:',
        Object.fromEntries(req.cookies.getAll().map((c) => [c.name, c.value]))
    )
    console.log('AUTH对象完整内容:', JSON.stringify(req.auth, null, 2))

    // 添加详细日志
    console.log('中间件处理请求:', {
        url: nextUrl.pathname,
        isLoggedIn,
        sessionData: req.auth ? '有效' : '无效',
        headers: Object.fromEntries(req.headers)
    })

    // 检测是否可能存在重定向循环
    const redirectCount = parseInt(req.headers.get('x-redirect-count') || '0')
    if (redirectCount > 3) {
        console.error('检测到可能的重定向循环，返回400错误')
        return new NextResponse('检测到循环重定向', { status: 400 })
    }

    // 添加缓存控制头
    const response = NextResponse.next()
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    // 设置公共函数用于准备重定向响应
    const prepareRedirect = (url: string) => {
        const redirectResponse = NextResponse.redirect(new URL(url, nextUrl))
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

    // 1. API 认证路由直接放行
    if (nextUrl.pathname.startsWith(apiAuthPrefix)) {
        return response
    }

    // 2. 如果是认证相关路由（登录、注册等）
    if (authRoutes.includes(nextUrl.pathname)) {
        if (isLoggedIn) {
            return prepareRedirect(DEFAULT_LOGIN_REDIRECT)
        }
        return response
    }

    // 3. 如果是公开路由
    if (publicRoutes.includes(nextUrl.pathname)) {
        return response
    }

    // 处理根路径 - App Router模式下无页面
    if (nextUrl.pathname === '/') {
        return prepareRedirect('/login')
    }

    // 4. 未登录用户重定向到登录页
    if (!isLoggedIn) {
        const returnUrl = encodeURIComponent(nextUrl.pathname)
        return prepareRedirect(`/login?returnUrl=${returnUrl}`)
    }

    // 5. 管理员路由权限判断
    console.log('检查是否管理员路由:', {
        path: nextUrl.pathname,
        adminRoutes,
        isMatched: adminRoutes.some((route) =>
            nextUrl.pathname.startsWith(route)
        )
    })

    // 使用前缀匹配而不是精确匹配
    if (adminRoutes.some((route) => nextUrl.pathname.startsWith(route))) {
        console.log('触发管理员权限检查:', nextUrl.pathname)

        // 访问管理员路由，完整认证信息
        console.log(
            '认证信息:',
            JSON.stringify(
                {
                    auth: req.auth,
                    role: req.auth?.user?.role
                },
                null,
                2
            )
        )

        const role = req.auth?.user?.role
        const sessionRole = req.cookies.get('userRole')?.value

        const isAdmin =
            role === 'ADMIN' ||
            role === 'SUPER_ADMIN' ||
            String(role).toUpperCase() === 'ADMIN' ||
            String(role).toUpperCase() === 'SUPER_ADMIN' ||
            sessionRole === 'ADMIN' ||
            sessionRole === 'SUPER_ADMIN'

        console.log('角色检查结果:', { role, sessionRole, isAdmin })

        if (!isAdmin) {
            console.log('拒绝访问管理员路由')
            return prepareRedirect('/dashboard')
        }
    }

    // 5. 特殊处理会话请求
    if (nextUrl.pathname === '/api/auth/session') {
        console.log('处理会话请求:', {
            cookies: req.cookies,
            headers: Object.fromEntries(req.headers)
        })
    }

    // 其他情况放行
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
        '/register'
    ]
}
