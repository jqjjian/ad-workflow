'use client'

import { Avatar, Dropdown, Modal } from 'antd'
import { UserOutlined, LogoutOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { signOut } from 'next-auth/react'
import { useState } from 'react'

export default function UserAvatar() {
    const [confirmLogoutVisible, setConfirmLogoutVisible] = useState(false)
    const [isLoggingOut, setIsLoggingOut] = useState(false)

    const handleLogout = () => {
        setConfirmLogoutVisible(true)
    }

    const confirmLogout = async () => {
        try {
            setIsLoggingOut(true)
            // 清除所有导致重定向问题的会话存储
            sessionStorage.removeItem('justLoggedIn')
            sessionStorage.removeItem('redirectSource')
            sessionStorage.removeItem('lastRedirectTime')

            // 清除加载状态相关的标记
            sessionStorage.removeItem('loadingState')

            // 设置登出标记，让AuthCheck知道用户刚刚登出
            sessionStorage.setItem('justLoggedOut', 'true')

            console.log('准备退出登录，已设置justLoggedOut标记')

            // 使用强制选项确保完全登出，并重定向到登录页面
            await signOut({
                callbackUrl: '/login',
                redirect: true
            })
        } catch (error) {
            console.error('登出失败:', error)
            // 登出失败也重置标记
            sessionStorage.removeItem('justLoggedOut')
            setIsLoggingOut(false)
        }
    }

    const cancelLogout = () => {
        setConfirmLogoutVisible(false)
    }

    const items: MenuProps['items'] = [
        {
            key: 'logout',
            label: '退出登录',
            icon: <LogoutOutlined />,
            onClick: handleLogout
        }
    ]

    return (
        <div>
            <Dropdown menu={{ items }} placement="bottomRight">
                <Avatar
                    style={{ cursor: 'pointer', backgroundColor: '#1677ff' }}
                    icon={<UserOutlined />}
                />
            </Dropdown>

            <Modal
                title="确认退出"
                open={confirmLogoutVisible}
                onOk={confirmLogout}
                onCancel={cancelLogout}
                okText="确认"
                cancelText="取消"
                confirmLoading={isLoggingOut}
            >
                <p>确定要退出登录吗？</p>
            </Modal>
        </div>
    )
}
