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
            setIsLoggingOut(true);

            // 获取当前主机信息
            const currentHost = window.location.host;
            const protocol = window.location.protocol;

            // 设置登出标记
            document.cookie = "justLoggedOut=true; path=/; max-age=30";

            // 强制清除所有认证相关cookie
            document.cookie = "next-auth.csrf-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
            document.cookie = "next-auth.session-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
            document.cookie = "authjs.session-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
            document.cookie = "next-auth.callback-url=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
            document.cookie = "userRole=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";

            console.log("正在登出系统...");

            // 直接通过signOut函数退出并重定向
            await signOut({
                callbackUrl: `${protocol}//${currentHost}/login`,
                redirect: true
            });

            // 如果signOut的重定向失败，则使用备用方法
            setTimeout(() => {
                window.location.href = `${protocol}//${currentHost}/login`;
            }, 1000);
        } catch (error) {
            console.error('登出失败:', error);
            // 兜底方案
            window.location.href = '/login';
        } finally {
            setIsLoggingOut(false);
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
