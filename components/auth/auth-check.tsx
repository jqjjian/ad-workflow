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

    // 增加一个锁，防止多次重定向
    const [isRedirecting, setIsRedirecting] = useState(false)

    // 标记登录状态是否已经变化
    const prevStatus = useRef(status)
    const isRelogin = useRef(false)

    // 添加强制超时计时器，避免永久卡在加载状态
    const loadingTimer = useRef<NodeJS.Timeout | null>(null)
    const forceTimeoutRef = useRef(false)

    // 跳过中间件已处理的路径
    const isAuthPath = pathname === '/login' || pathname === '/auth/signin'

    // 初始化时设置一个最大加载时间，避免永久卡在加载状态
    useEffect(() => {
        // 如果当前不是加载状态，清除计时器
        if (status !== 'loading' || isChecked) {
            if (loadingTimer.current) {
                clearTimeout(loadingTimer.current)
                loadingTimer.current = null
            }
            return
        }

        // 最多等待5秒，之后强制显示内容
        loadingTimer.current = setTimeout(() => {
            if (status === 'loading' && !isChecked) {
                console.warn('认证检查强制超时，允许渲染页面内容')
                forceTimeoutRef.current = true
                setIsChecked(true)
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
            }

            // 当直接进入authenticated状态，且justLoggedIn为true时，可能是登录后刷新页面
            if (
                status === 'authenticated' &&
                sessionStorage.getItem('justLoggedIn') === 'true'
            ) {
                console.log('检测到登录后刷新状态')
                // 此时应该直接显示内容，不做任何重定向
                setIsChecked(true)
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
            return
        }

        // 检查是否刚退出登录
        const justLoggedOut = sessionStorage.getItem('justLoggedOut') === 'true'
        if (justLoggedOut && !isAuthPath) {
            console.log('检测到刚退出登录，强制重定向到登录页')
            sessionStorage.removeItem('justLoggedOut')
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
            return
        }

        // 避免在登录页面上检查认证状态
        if (isAuthPath) {
            setIsChecked(true)
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
        } else if (status !== 'loading' && !isChecked) {
            // 其他非加载状态也设置检查完成
            setIsChecked(true)
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
        return <>{children}</>
    }

    // 显示加载状态
    if (status === 'loading' || !isChecked) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <div className="text-center">
                    <div className="text-lg">加载中...</div>
                    <div className="text-sm text-gray-500">
                        正在验证登录信息
                    </div>
                    <div className="mt-2 text-xs text-gray-400">
                        如果长时间未加载，请尝试
                        <button
                            onClick={() => {
                                forceTimeoutRef.current = true
                                setIsChecked(true)
                            }}
                            className="ml-1 text-blue-500 underline"
                        >
                            点击继续
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // 已认证或在登录页面，正常显示内容
    return <>{children}</>
}
