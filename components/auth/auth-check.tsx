'use client'
import React, { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'

// 客户端组件用于验证用户会话 - 已优化防止重定向循环
export default function AuthCheck({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession()
    const router = useRouter()
    const pathname = usePathname()
    const [isChecked, setIsChecked] = useState(false)
    // 添加淡入淡出控制状态
    const [showLoading, setShowLoading] = useState(false)
    const [contentOpacity, setContentOpacity] = useState(0)

    // 增加一个锁，防止多次重定向
    const [isRedirecting, setIsRedirecting] = useState(false)

    // 标记登录状态是否已经变化
    const prevStatus = useRef(status)
    const isRelogin = useRef(false)

    // 添加强制超时计时器，避免永久卡在加载状态
    const loadingTimer = useRef<NodeJS.Timeout | null>(null)
    const loadingDelayTimer = useRef<NodeJS.Timeout | null>(null)
    const forceTimeoutRef = useRef(false)

    // 跳过中间件已处理的路径
    const isAuthPath = pathname === '/login' || pathname === '/auth/signin'

    // 延迟显示加载状态，避免闪烁
    useEffect(() => {
        if (status === 'loading' && !isChecked) {
            // 清除之前的延迟计时器
            if (loadingDelayTimer.current) {
                clearTimeout(loadingDelayTimer.current)
            }

            // 延迟800ms后显示加载状态，避免短暂的加载过程显示加载界面
            loadingDelayTimer.current = setTimeout(() => {
                if (status === 'loading' && !isChecked) {
                    setShowLoading(true)
                }
            }, 800)
        } else {
            // 如果状态不是加载或已检查完成，则隐藏加载状态
            if (loadingDelayTimer.current) {
                clearTimeout(loadingDelayTimer.current)
            }

            // 使用淡出效果
            if (showLoading) {
                setShowLoading(false)
                // 内容以淡入方式显示
                setContentOpacity(1)
            }
        }

        return () => {
            if (loadingDelayTimer.current) {
                clearTimeout(loadingDelayTimer.current)
            }
        }
    }, [status, isChecked, showLoading])

    // 初始化时设置一个最大加载时间，避免永久卡在加载状态
    useEffect(() => {
        // 如果当前不是加载状态，清除计时器
        if (status !== 'loading' || isChecked) {
            if (loadingTimer.current) {
                clearTimeout(loadingTimer.current)
                loadingTimer.current = null
            }
            // 确保内容显示
            setContentOpacity(1)
            return
        }

        // 最多等待5秒，之后强制显示内容
        loadingTimer.current = setTimeout(() => {
            if (status === 'loading' && !isChecked) {
                console.warn('认证检查强制超时，允许渲染页面内容')
                forceTimeoutRef.current = true
                setIsChecked(true)
                setShowLoading(false)
                setContentOpacity(1)
            }
        }, 5000)

        return () => {
            if (loadingTimer.current) {
                clearTimeout(loadingTimer.current)
                loadingTimer.current = null
            }
        }
    }, [status, isChecked])

    useEffect(() => {
        // 检测登录状态变化 - 特别是检测从 unauthenticated 到 authenticated 的变化
        if (prevStatus.current !== status) {
            console.log(`登录状态变化: ${prevStatus.current} -> ${status}`)

            // 状态变化时，重置计时器
            if (loadingTimer.current) {
                clearTimeout(loadingTimer.current)
                loadingTimer.current = null
            }

            // 从未登录到登录中，可能是刚刚登录
            if (
                prevStatus.current === 'unauthenticated' &&
                status === 'loading'
            ) {
                isRelogin.current = true
            }

            // 从loading到已登录，并且之前标记为刚登录，清除所有旧状态
            if (isRelogin.current && status === 'authenticated') {
                console.log('检测到重新登录，重置所有状态')
                sessionStorage.removeItem('redirectSource')
                sessionStorage.removeItem('lastRedirectTime')
                sessionStorage.removeItem('justLoggedOut')
                sessionStorage.setItem('justLoggedIn', 'true')
                isRelogin.current = false
                setIsChecked(true)
                setIsRedirecting(false)
                forceTimeoutRef.current = false
                // 确保内容显示
                setShowLoading(false)
                setContentOpacity(1)
            }

            // 当直接进入authenticated状态，且justLoggedIn为true时，可能是登录后刷新页面
            if (
                status === 'authenticated' &&
                sessionStorage.getItem('justLoggedIn') === 'true'
            ) {
                console.log('检测到登录后刷新状态')
                // 此时应该直接显示内容，不做任何重定向
                setIsChecked(true)
                setShowLoading(false)
                setContentOpacity(1)
                // 但是保留标记，以便页面初始化时使用
            }

            prevStatus.current = status
        }

        // 添加调试信息
        console.log('AuthCheck状态:', {
            status,
            pathname,
            isAuthPath,
            session: session ? '有效' : '无效',
            isChecked,
            isRedirecting,
            isRelogin: isRelogin.current,
            forceTimeout: forceTimeoutRef.current,
            justLoggedIn: sessionStorage.getItem('justLoggedIn')
        })

        // 如果正在重定向，不再执行验证
        if (isRedirecting) return

        // 检查是否刚登录成功（通过sessionStorage标记）
        const justLoggedIn = sessionStorage.getItem('justLoggedIn')
        if (justLoggedIn === 'true') {
            console.log('检测到刚登录状态，跳过权限检查')
            // 清除标记，仅对当前导航有效
            sessionStorage.removeItem('justLoggedIn')
            setIsChecked(true)
            setShowLoading(false)
            setContentOpacity(1)
            return
        }

        // 检查是否刚退出登录
        const getCookie = (name: string) => {
            const value = `; ${document.cookie}`
            const parts = value.split(`; ${name}=`)
            if (parts.length === 2) return parts.pop()?.split(';').shift()
            return null
        }

        const justLoggedOutCookie = getCookie('justLoggedOut')
        const justLoggedOutSession =
            sessionStorage.getItem('justLoggedOut') === 'true'

        if (
            (justLoggedOutCookie === 'true' || justLoggedOutSession) &&
            !isAuthPath
        ) {
            console.log('检测到刚退出登录，强制重定向到登录页')
            // 清除所有标记
            sessionStorage.removeItem('justLoggedOut')
            document.cookie =
                'justLoggedOut=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'

            // 强制清除所有认证相关cookie
            document.cookie =
                'next-auth.session-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
            document.cookie =
                'next-auth.csrf-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
            document.cookie =
                'next-auth.callback-url=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
            document.cookie =
                'userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'

            setIsRedirecting(true)
            router.push('/login')
            return
        }

        // 页面加载时记录重定向来源，用于防止循环
        const redirectSource = sessionStorage.getItem('redirectSource')
        const currentTime = Date.now()
        const lastRedirectTime = parseInt(
            sessionStorage.getItem('lastRedirectTime') || '0'
        )

        // 重置过于频繁的重定向 (2秒内)
        if (
            currentTime - lastRedirectTime < 2000 &&
            redirectSource === pathname
        ) {
            console.warn('检测到可能的重定向循环，暂停重定向')
            sessionStorage.removeItem('redirectSource')
            sessionStorage.removeItem('lastRedirectTime')
            setIsChecked(true)
            setShowLoading(false)
            setContentOpacity(1)
            return
        }

        // 避免在登录页面上检查认证状态
        if (isAuthPath) {
            setIsChecked(true)
            setShowLoading(false)
            setContentOpacity(1)
            return
        }

        // 优先信任服务器端中间件的判断，减少客户端重定向
        // 仅在明确未认证或刚退出时才执行重定向
        if ((status === 'unauthenticated' || !session) && !isChecked) {
            console.log('客户端检测到未登录状态，准备重定向')
            setIsChecked(true)

            // 记录重定向信息防止循环
            sessionStorage.setItem('redirectSource', pathname)
            sessionStorage.setItem('lastRedirectTime', currentTime.toString())

            // 设置重定向锁，防止多次重定向
            setIsRedirecting(true)

            // 延迟执行重定向，给服务端足够时间处理
            setTimeout(() => {
                // 使用router.push，不强制刷新页面
                router.push('/login')
            }, 300)
        } else if (status === 'authenticated') {
            // 确认已登录，立即设置检查完成
            setIsChecked(true)
            setShowLoading(false)
            setContentOpacity(1)
        } else if (status !== 'loading' && !isChecked) {
            // 其他非加载状态也设置检查完成
            setIsChecked(true)
            setShowLoading(false)
            setContentOpacity(1)
        }
    }, [
        status,
        pathname,
        isChecked,
        router,
        isAuthPath,
        session,
        isRedirecting
    ])

    // 在登录页面不执行验证
    if (isAuthPath) {
        return <>{children}</>
    }

    // 如果强制超时或已检查完成且不再加载状态，显示内容
    if (forceTimeoutRef.current || (isChecked && status !== 'loading')) {
        return (
            <div
                style={{
                    transition: 'opacity 0.3s ease-in-out',
                    opacity: contentOpacity
                }}
                onTransitionEnd={() => {
                    // 确保过渡效果结束后完全可见
                    if (contentOpacity < 1) {
                        setContentOpacity(1)
                    }
                }}
            >
                {children}
            </div>
        )
    }

    // 显示加载状态 - 使用淡入淡出效果
    return (
        <>
            {/* 加载状态 - 带淡入淡出效果 */}
            <div
                className="fixed inset-0 flex items-center justify-center bg-white/90 z-50"
                style={{
                    opacity: showLoading ? 1 : 0,
                    visibility: showLoading ? 'visible' : 'hidden',
                    transition: 'opacity 0.3s ease-in-out, visibility 0.3s ease-in-out'
                }}
            >
                <div className="text-center">
                    <div className="flex flex-col items-center justify-center">
                        {/* 简单的加载动画 */}
                        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-blue-500 mb-3"></div>
                        <div className="text-sm text-gray-500 font-light animate-pulse">
                            验证权限中
                        </div>
                    </div>
                </div>
            </div>

            {/* 预加载内容，但不显示 */}
            <div
                style={{
                    opacity: contentOpacity,
                    transition: 'opacity 0.3s ease-in-out'
                }}
            >
                {children}
            </div>
        </>
    )
}
