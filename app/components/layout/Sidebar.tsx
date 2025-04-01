'use client'

import { useState, useEffect } from 'react'
import { Layout, Menu, Typography } from 'antd'
import {
    DashboardOutlined,
    BankOutlined,
    SettingOutlined,
    FileOutlined,
    CreditCardOutlined,
    ProfileOutlined
} from '@ant-design/icons'
import { usePathname, useRouter } from 'next/navigation'

const { Sider } = Layout
const { Title } = Typography

export default function Sidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const [collapsed, setCollapsed] = useState(false)
    const [selectedKey, setSelectedKey] = useState('dashboard')

    useEffect(() => {
        if (pathname.startsWith('/dashboard')) setSelectedKey('dashboard')
        else if (pathname.startsWith('/account-application'))
            setSelectedKey('account-application')
        else if (pathname.startsWith('/account-management'))
            setSelectedKey('account-management')
        else if (pathname.startsWith('/attachment'))
            setSelectedKey('attachment')
        else if (pathname.startsWith('/payment')) setSelectedKey('payment')
        else if (pathname.startsWith('/workorder')) setSelectedKey('workorder')
    }, [pathname])

    const handleMenuClick = (key: string) => {
        router.push(`/${key}`)
    }

    return (
        <Sider
            collapsible
            collapsed={collapsed}
            onCollapse={(value) => setCollapsed(value)}
            style={{ overflow: 'auto', height: '100vh' }}
        >
            <div style={{ padding: '16px', textAlign: 'center' }}>
                <Title level={4} style={{ color: 'white', margin: '8px 0' }}>
                    {collapsed ? 'WO' : '工单系统'}
                </Title>
            </div>

            <Menu
                theme="dark"
                mode="inline"
                selectedKeys={[selectedKey]}
                items={[
                    {
                        key: 'dashboard',
                        icon: <DashboardOutlined />,
                        label: '仪表盘',
                        onClick: () => handleMenuClick('dashboard')
                    },
                    {
                        key: 'business',
                        icon: <SettingOutlined />,
                        label: '业务功能',
                        children: [
                            {
                                key: 'account-application',
                                label: '开户申请',
                                icon: <BankOutlined />,
                                onClick: () =>
                                    handleMenuClick('account-application')
                            },
                            {
                                key: 'account-management',
                                label: '账户管理',
                                icon: <SettingOutlined />,
                                onClick: () =>
                                    handleMenuClick('account-management')
                            },
                            {
                                key: 'attachment',
                                label: '附件管理',
                                icon: <FileOutlined />,
                                onClick: () => handleMenuClick('attachment')
                            },
                            {
                                key: 'payment',
                                label: '支付账单',
                                icon: <CreditCardOutlined />,
                                onClick: () => handleMenuClick('payment')
                            },
                            {
                                key: 'workorder',
                                label: '工单管理',
                                icon: <ProfileOutlined />,
                                onClick: () => handleMenuClick('workorder')
                            }
                        ]
                    }
                ]}
            />
        </Sider>
    )
}
