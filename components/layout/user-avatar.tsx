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
            localStorage.removeItem('justLoggedIn')

            // 清除加载状态相关的标记
            sessionStorage.removeItem('loadingState')

            // 设置登出标记，让AuthCheck知道用户刚刚登出
            // 同时使用cookie和sessionStorage标记退出状态，确保服务器也能识别
            sessionStorage.setItem('justLoggedOut', 'true')

            // 添加cookie，确保服务器能识别退出状态
            document.cookie = `justLoggedOut=true; path=/; max-age=3600`

            // 强制清除所有认证相关的cookie
            document.cookie =
                'next-auth.session-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
            document.cookie =
                'next-auth.csrf-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
            document.cookie =
                'next-auth.callback-url=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
            document.cookie =
                'userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'

            console.log(
                '准备退出登录，已设置justLoggedOut标记和清除所有认证cookie'
            )

            // 使用强制选项确保完全登出，并强制跳转到登录页面
            await signOut({
                callbackUrl: '/login',
                redirect: true
            })

            // 确保重定向已完成，额外检查并强制重定向
            setTimeout(() => {
                if (window.location.pathname !== '/login') {
                    console.log('检测到退出后未正确重定向，强制跳转到登录页')
                    window.location.href = '/login'
                }
            }, 500)
        } catch (error) {
            console.error('登出失败:', error)
            // 登出失败也重置标记
            sessionStorage.removeItem('justLoggedOut')
            setIsLoggingOut(false)

            // 失败时也尝试强制重定向
            window.location.href = '/login'
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
