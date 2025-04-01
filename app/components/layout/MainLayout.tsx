import { ReactNode } from 'react'
import { Layout } from 'antd'
import Sidebar from './Sidebar'
import HeaderComponent from './Header'

const { Content } = Layout

type MainLayoutProps = {
    children: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sidebar />
            <Layout>
                <HeaderComponent />
                <Content
                    style={{
                        margin: '24px 16px',
                        padding: 24,
                        background: '#fff'
                    }}
                >
                    {children}
                </Content>
            </Layout>
        </Layout>
    )
}
