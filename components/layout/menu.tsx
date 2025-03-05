'use client'

import { Menu, type MenuProps } from 'antd'
import { useRouter, usePathname } from 'next/navigation'
import { menuItems } from '@/constants'
import { useState, useEffect } from 'react'

export default function MenuComponent() {
    const router = useRouter()
    const pathname = usePathname()
    const [openKeys, setOpenKeys] = useState<string[]>([])
    const [selectedKeys, setSelectedKeys] = useState<string[]>([])

    useEffect(() => {
        // 获取当前路由并设置初始的 openKeys 和 selectedKeys
        const currentPath = pathname.split('/').filter(Boolean)
        setOpenKeys(currentPath)
        setSelectedKeys(currentPath)
    }, [pathname])

    const handleMenuClick = (e: { key: string; keyPath: string[] }) => {
        const path = e.keyPath.reverse().join('/')
        router.push(`/${path}`)
        setOpenKeys(e.keyPath) // 更新 openKeys
        setSelectedKeys([e.key]) // 更新 selectedKeys
    }

    const items: MenuProps['items'] = menuItems.map((nav, index) => {
        const { key, label, icon, children } = nav

        return {
            key,
            icon,
            label,
            children: children?.map((child, j) => {
                return {
                    key: child.key,
                    label: child.label
                }
            })
        }
    })

    return (
        <Menu
            items={items}
            onClick={handleMenuClick}
            mode="inline"
            defaultSelectedKeys={selectedKeys}
            selectedKeys={selectedKeys} // 使用动态 selectedKeys
            openKeys={openKeys} // 使用动态 openKeys
            onOpenChange={(keys) => setOpenKeys(keys)} // 更新 openKeys
            style={{
                height: '100%',
                borderRight: 0
            }}
        />
    )
}
