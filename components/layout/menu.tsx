'use client'

import { Menu, type MenuProps } from 'antd'
import { useRouter, usePathname } from 'next/navigation'
import { menuItems, MenuItem } from '@/constants'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

export default function MenuComponent() {
    const router = useRouter()
    const pathname = usePathname()
    const { data: session } = useSession()
    const [openKeys, setOpenKeys] = useState<string[]>([])
    const [selectedKeys, setSelectedKeys] = useState<string[]>([])

    // 增强的管理员判断逻辑
    const isAdmin = (() => {
        if (!session?.user) return false;

        // 详细的会话信息调试
        console.log('用户会话信息:', {
            user: session.user,
            role: session.user.role,
            name: session.user.name,
            email: session.user.email
        });

        // 检查各种可能的管理员标识
        const userObj = session.user as any;

        // 有多种可能的角色字段和值，全部检查
        const possibleRoles = [
            session.user.role === 'ADMIN',
            // session.user.role === 'admin',
            session.user.role?.toLowerCase() === 'admin',
            session.user.role === 'SUPER_ADMIN',  // 添加超级管理员角色
            session.user.role?.toLowerCase() === 'super_admin',
            userObj.isAdmin === true,
            userObj.role === 'ADMIN',
            userObj.role === 'admin',
            userObj.role === 'SUPER_ADMIN',  // 添加超级管理员角色
            userObj.userRole === 'ADMIN',
            userObj.userRole === 'admin',
            userObj.userRole === 'SUPER_ADMIN',  // 添加超级管理员角色
            userObj.permissions?.includes('admin'),
            userObj.permissions?.includes('super_admin')  // 添加权限检查
        ];

        const result = possibleRoles.some(Boolean);
        console.log('管理员检查结果:', result, '匹配条件:', possibleRoles);
        return result;
    })();

    // 构建菜单项，根据用户角色过滤
    const items: MenuProps['items'] = menuItems
        .filter(item => {
            // 过滤管理员菜单 - 使用isAdmin属性
            if (item.isAdmin && !isAdmin) {
                console.log(`过滤掉管理员菜单项: ${item.key}`);
                return false;
            }
            return true;
        })
        .map((nav) => {
            const { key, label, icon, children } = nav;

            // 如果有子菜单，过滤子菜单
            const filteredChildren = children ?
                children.filter(child => {
                    if (child.isAdmin && !isAdmin) {
                        console.log(`过滤掉管理员子菜单项: ${child.key}`);
                        return false;
                    }
                    return true;
                }) :
                undefined;

            // 返回处理后的菜单项
            return {
                key,
                icon,
                label,
                children: filteredChildren?.length ?
                    filteredChildren.map(child => ({
                        key: child.key,
                        label: child.label,
                        icon: child.icon
                    })) :
                    undefined
            };
        });

    // 强制添加管理菜单（仅用于调试）
    useEffect(() => {
        // 在控制台添加一个临时函数，方便手动启用管理员菜单进行测试
        (window as any).enableAdminMenu = () => {
            console.log('手动启用管理员菜单 - 仅用于测试');
            localStorage.setItem('debug_admin', 'true');
            window.location.reload();
        };

        // 在控制台添加一个临时函数，关闭管理员菜单
        (window as any).disableAdminMenu = () => {
            console.log('关闭管理员菜单测试模式');
            localStorage.removeItem('debug_admin');
            window.location.reload();
        };

        // 记录菜单项信息
        console.log('菜单项:', items);
    }, [items]);

    useEffect(() => {
        // Get current path segments
        const pathSegments = pathname.split('/').filter(Boolean)

        // Handle menu selection based on path
        if (pathSegments.length >= 1) {
            const mainSection = pathSegments[0]
            setOpenKeys([mainSection])

            // Special handling for record pages to avoid conflicts
            if (mainSection === 'account' && pathSegments[1] === 'record') {
                // For account record page
                setSelectedKeys(['account-record'])
            } else if (
                mainSection === 'application' &&
                pathSegments[1] === 'record'
            ) {
                // For application record page
                setSelectedKeys(['application-record'])
            } else if (pathSegments.length >= 2) {
                // For other pages with subsections
                setSelectedKeys([pathSegments[1]])
            } else {
                // For main pages
                setSelectedKeys([mainSection])
            }
        }
    }, [pathname])

    const handleMenuClick = (e: { key: string; keyPath: string[] }) => {
        // Special handling for record pages
        if (e.key === 'account-record') {
            router.push('/account/record')
        } else if (e.key === 'application-record') {
            router.push('/application/record')
        } else {
            const path = e.keyPath.reverse().join('/')
            router.push(`/${path}`)
        }

        setOpenKeys(e.keyPath.slice(0, -1)) // Update openKeys (all except last)
        setSelectedKeys([e.key]) // Update selectedKeys with the clicked key
    }

    // 调试日志
    useEffect(() => {
        console.log('当前用户角色:', isAdmin ? '管理员' : '普通用户');
        // 检查debug模式，允许强制显示管理员菜单
        if (typeof window !== 'undefined' && localStorage.getItem('debug_admin') === 'true') {
            console.log('DEBUG模式: 已启用管理员菜单测试');
            // 提示用户如何关闭测试模式
            console.log('使用 window.disableAdminMenu() 关闭测试模式');
        }
    }, [isAdmin])

    // 本地存储调试模式检查
    const debugAdminMode = typeof window !== 'undefined' && localStorage.getItem('debug_admin') === 'true';

    return (
        <Menu
            items={debugAdminMode ? menuItems.map(item => ({
                ...item,
                children: item.children?.map(child => ({
                    key: child.key,
                    label: child.label,
                    icon: child.icon
                }))
            })) : items}
            onClick={handleMenuClick}
            mode="inline"
            selectedKeys={selectedKeys}
            openKeys={openKeys}
            onOpenChange={(keys) => setOpenKeys(keys)}
            style={{
                height: '100%',
                borderRight: 0
            }}
        />
    )
}
