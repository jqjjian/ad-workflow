import type { Metadata } from 'next'
import React from 'react'
import { Layout, ConfigProvider } from 'antd'
import { Content } from 'antd/es/layout/layout'
import { Header } from 'antd/es/layout/layout'
import Sider from 'antd/es/layout/Sider'
import MenuComponent from '@/components/layout/menu'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'

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
    // const {
    //     token: { colorBgContainer, borderRadiusLG }
    // } = theme.useToken()
    return (
        <ConfigProvider locale={zhCN}>
            <Layout className="h-screen">
                <Header
                    style={{
                        display: 'flex',
                        alignItems: 'center'
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
        </ConfigProvider>
    )
}
