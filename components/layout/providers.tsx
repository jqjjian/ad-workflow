'use client'
import React from 'react'
// import ThemeProvider from './ThemeToggle/theme-provider';
import { SessionProvider, SessionProviderProps } from 'next-auth/react'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

export default function Providers({
    session,
    children
}: {
    session: SessionProviderProps['session']
    children: React.ReactNode
}) {
    return (
        <>
            <NuqsAdapter>
                {/* <ThemeProvider attribute="class" defaultTheme="system" enableSystem> */}
                <SessionProvider
                    session={session}
                    refetchInterval={5 * 60} // 每5分钟刷新会话
                    refetchOnWindowFocus={true} // 窗口聚焦时刷新会话
                    refetchWhenOffline={false} // 离线时不刷新会话
                >
                    {children}
                </SessionProvider>
                {/* </ThemeProvider> */}
            </NuqsAdapter>
        </>
    )
}
