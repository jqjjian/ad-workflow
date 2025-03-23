'use client'

import { useState } from 'react'
import { Layout, Input, Space, Badge, Avatar, Dropdown, Button } from 'antd'
import {
    BellOutlined,
    UserOutlined,
    SearchOutlined,
    LogoutOutlined,
    SettingOutlined
} from '@ant-design/icons'
import { useRouter } from 'next/navigation'

const { Header } = Layout
const { Search } = Input

export default function HeaderComponent() {
    const router = useRouter()

    // 用户下拉菜单项
    const userDropdownItems = {
        items: [
            {
                key: 'profile',
                label: '个人信息',
                icon: <UserOutlined />,
                onClick: () => router.push('/profile')
            },
            {
                key: 'settings',
                label: '系统设置',
                icon: <SettingOutlined />,
                onClick: () => router.push('/settings')
            },
            {
                type: 'divider'
            },
            {
                key: 'logout',
                label: '退出登录',
                icon: <LogoutOutlined />,
                onClick: () => {
                    /* 登出逻辑 */
                }
            }
        ]
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

                <Dropdown menu={userDropdownItems} placement="bottomRight">
                    <Space style={{ cursor: 'pointer' }}>
                        <Avatar icon={<UserOutlined />} />
                        <span style={{ display: 'inline-block' }}>管理员</span>
                    </Space>
                </Dropdown>
            </Space>
        </Header>
    )
}
