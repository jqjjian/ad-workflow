'use client'

// import { useState } from 'react'
import { Space, Badge, Avatar, Dropdown, Button } from 'antd'
import { Header } from 'antd/es/layout/layout'
import Search from 'antd/es/input/Search'
import type { MenuProps } from 'antd'
import {
    BellOutlined,
    UserOutlined,
    SearchOutlined,
    LogoutOutlined,
    SettingOutlined
} from '@ant-design/icons'
import { useRouter } from 'next/navigation'

export default function HeaderComponent() {
    const router = useRouter()

    // 用户下拉菜单项
    const items: MenuProps['items'] = [
        {
            key: 'profile',
            label: '个人信息',
            icon: <UserOutlined />
        },
        {
            key: 'settings',
            label: '系统设置',
            icon: <SettingOutlined />
        },
        { type: 'divider' },
        {
            key: 'logout',
            label: '退出登录',
            icon: <LogoutOutlined />
        }
    ]

    const handleMenuClick = (e: { key: string }) => {
        switch (e.key) {
            case 'profile':
                router.push('/profile')
                break
            case 'settings':
                router.push('/settings')
                break
            case 'logout':
                // 登出逻辑
                break
        }
    }

    return (
        <Header
            style={{
                background: '#fff',
                padding: '0 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}
        >
            <div style={{ flex: 1 }}>
                <Search
                    placeholder="搜索工单..."
                    style={{ maxWidth: 300 }}
                    onSearch={(value) => console.log(value)}
                    prefix={<SearchOutlined />}
                />
            </div>

            <Space size="large">
                <Badge count={3}>
                    <Button
                        type="text"
                        icon={<BellOutlined style={{ fontSize: '18px' }} />}
                    />
                </Badge>

                <Dropdown
                    menu={{ items, onClick: handleMenuClick }}
                    placement="bottomRight"
                >
                    <Space style={{ cursor: 'pointer' }}>
                        <Avatar icon={<UserOutlined />} />
                        <span style={{ display: 'inline-block' }}>管理员</span>
                    </Space>
                </Dropdown>
            </Space>
        </Header>
    )
}
