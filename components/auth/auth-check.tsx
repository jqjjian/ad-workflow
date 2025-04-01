'use client'
import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'

// 客户端组件用于验证用户会话
export default function AuthCheck({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession()
    const router = useRouter()
    const pathname = usePathname()
    const [isRedirecting, setIsRedirecting] = useState(false)

    useEffect(() => {
        // 避免在登录页面上检查认证状态，防止重定向循环
        if (pathname === '/login' || pathname === '/auth/signin') {
            return
        }

        // 如果未登录，则重定向到登录页面
        if (status === 'unauthenticated' && !isRedirecting) {
            console.log('未登录，重定向到登录页面')
            setIsRedirecting(true)

            // 使用window.location直接跳转，而不是router.push
            setTimeout(() => {
                window.location.href = '/login'
            }, 100)
        }
    }, [status, pathname, isRedirecting])

    // 在登录页面不执行验证
    if (pathname === '/login' || pathname === '/auth/signin') {
        return <>{children}</>
    }

    // 显示加载状态
    if (status === 'loading') {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <div className="text-center">
                    <div className="text-lg">加载中...</div>
                    <div className="text-sm text-gray-500">
                        正在验证登录信息
                    </div>
                </div>
            </div>
        )
    }

    // 未认证状态不渲染子组件，防止闪现
    if (
        (status === 'unauthenticated' || isRedirecting) &&
        pathname !== '/login'
    ) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <div className="text-center">
                    <div className="text-lg">正在重定向到登录页...</div>
                    <div className="mt-2 text-sm text-gray-500">
                        <button
                            onClick={() => (window.location.href = '/login')}
                            className="text-blue-500 underline"
                        >
                            点击此处立即跳转
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return <>{children}</>
}
