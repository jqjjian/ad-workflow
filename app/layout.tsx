import type { Metadata } from 'next'
import localFont from 'next/font/local'
const geistSans = localFont({
    src: './fonts/GeistVF.woff',
    variable: '--font-geist-sans',
    weight: '100 900'
})
const geistMono = localFont({
    src: './fonts/GeistMonoVF.woff',
    variable: '--font-geist-mono',
    weight: '100 900'
})

import { auth } from '@/auth'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import Providers from '@/components/layout/providers'
import NextTopLoader from 'nextjs-toploader'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/es/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import './globals.css'

if (typeof window !== 'undefined') {
    dayjs.locale('zh-cn')
} else {
    require('dayjs/locale/zh-cn')
}
export const metadata: Metadata = {
    title: 'Ad-Workflow',
    description: 'Ad-Workflow'
}

export default async function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode
}>) {
    const session = await auth()
    return (
        <html
            lang="en"
            className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
            <body style={{ overflow: 'hidden', margin: 0 }}>
                <NextTopLoader showSpinner={false} />
                <AntdRegistry>
                    <ConfigProvider locale={zhCN}>
                        <Providers session={session}>{children}</Providers>
                    </ConfigProvider>
                </AntdRegistry>
            </body>
        </html>
    )
}
