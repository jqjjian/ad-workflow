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

    // 添加缓存控制头
    const response = NextResponse.next()
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    // 1. API 认证路由直接放行
    if (nextUrl.pathname.startsWith(apiAuthPrefix)) {
        return response
    }

    // 2. 如果是登录页或根路径
    if (nextUrl.pathname === '/login' || nextUrl.pathname === '/') {
        if (isLoggedIn) {
            const redirectResponse = NextResponse.redirect(
                new URL(DEFAULT_LOGIN_REDIRECT, nextUrl)
            )
            // 同样为重定向添加缓存控制
            redirectResponse.headers.set(
                'Cache-Control',
                'no-store, no-cache, must-revalidate'
            )
            return redirectResponse
        }
        return response
    }

    // 3. 未登录用户重定向到登录页
    if (!isLoggedIn) {
        const returnUrl = encodeURIComponent(nextUrl.pathname)
        const redirectResponse = NextResponse.redirect(
            new URL(`/login?returnUrl=${returnUrl}`, nextUrl)
        )
        // 同样为重定向添加缓存控制
        redirectResponse.headers.set(
            'Cache-Control',
            'no-store, no-cache, must-revalidate'
        )
        return redirectResponse
    }

    // 4. 管理员路由权限判断
    if (adminRoutes.includes(nextUrl.pathname)) {
        const role = req.auth?.user?.role
        if (role !== 'ADMIN') {
            return NextResponse.redirect(new URL('/dashboard', nextUrl))
        }
    }

    // 5. 其他情况放行
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
        '/login'
    ]
}
