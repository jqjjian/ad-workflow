import type { Metadata } from 'next'
import React from 'react'
import { Layout, ConfigProvider } from 'antd'
import { Header, Content } from 'antd/es/layout/layout'
import Sider from 'antd/es/layout/Sider'
import MenuComponent from '@/components/layout/menu'
import UserAvatar from '@/components/layout/user-avatar'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import AuthCheck from '@/components/auth/auth-check'

if (typeof window !== 'undefined') {
    dayjs.locale('zh-cn')
} else {
    require('dayjs/locale/zh-cn')
}

export const metadata: Metadata = {
    title: 'Ad-Workflow',
    description: 'Ad-Workflow'
}

export default function RootLayout({
    children
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <ConfigProvider locale={zhCN}>
            <AuthCheck>
                <Layout className="h-screen">
                    <Header
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}
                    >
                        <div className="text-white">logo</div>
                        {/* <Menu
                                    theme="dark"
                                    mode="horizontal"
                                    defaultSelectedKeys={['2']}
                                    items={items1}
                                    style={{ flex: 1, minWidth: 0 }}
                                /> */}
                        <div>
                            <UserAvatar />
                        </div>
                    </Header>
                    <Layout className="p-0" hasSider>
                        <Sider width={200} style={{ background: '#001529' }}>
                            <MenuComponent />
                            {/* <Menu
                                        mode="inline"
                                        defaultSelectedKeys={['dashboard']}
                                        defaultOpenKeys={['dashboard']}
                                        style={{
                                            height: '100%',
                                            borderRight: 0
                                        }}
                                        items={items}
                                        onClick={handleMenuClick}
                                    /> */}
                        </Sider>
                        <Layout>
                            {/* <Breadcrumb
                                        items={[
                                            { title: 'Home' },
                                            { title: 'List' },
                                            { title: 'App' }
                                        ]}
                                        style={{ margin: '16px 0' }}
                                    /> */}
                            <Content
                                style={{
                                    padding: '24px 24px',
                                    margin: 0,
                                    minHeight: 280,
                                    height: '100%',
                                    // background: '#fff',
                                    borderRadius: '10px',
                                    overflow: 'scroll'
                                }}
                            >
                                {children}
                            </Content>
                        </Layout>
                    </Layout>
                </Layout>
            </AuthCheck>
        </ConfigProvider>
    )
}
