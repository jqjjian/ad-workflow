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
        // Get current path segments
        const pathSegments = pathname.split('/').filter(Boolean)

        // Handle menu selection based on path
        if (pathSegments.length >= 1) {
            const mainSection = pathSegments[0]
            setOpenKeys([mainSection])

            // Special handling for record pages to avoid conflicts
            if (mainSection === 'account' && pathSegments[1] === 'record') {
                // For account record page
                setSelectedKeys(['record'])
            } else if (
                mainSection === 'application' &&
                pathSegments[1] === 'record'
            ) {
                // For application record page
                setSelectedKeys(['record'])
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
        const path = e.keyPath.reverse().join('/')
        router.push(`/${path}`)
        setOpenKeys(e.keyPath.slice(0, -1)) // Update openKeys (all except last)
        setSelectedKeys([e.key]) // Update selectedKeys with the clicked key
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
