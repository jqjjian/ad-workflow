'use client'
import { Metadata } from 'next'
import { useRouter } from 'next/navigation'
// import Image from 'next/image'
import { Button, Typography } from 'antd'
// import { Content } from 'antd/es/layout/layout'
// import Paragraph from 'antd/es/typography/Paragraph'
import UserRegisterForm from '@/app/(auth)/_components/user-register-form'
const { Title } = Typography
export const metadata: Metadata = {
    title: 'Ad-Workflow | Sign In',
    description: 'Sign In page for Ad-Workflow.'
}

export default function Page() {
    const router = useRouter()
    return (
        <>
            <div
                style={{
                    width: '100%',
                    height: '166px',
                    display: 'flex',
                    justifyContent: 'end'
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        gap: 4,
                        padding: '50px 32px',
                        justifyContent: 'end',
                        alignItems: 'center',
                        height: '36px'
                    }}
                >
                    <Title level={5} style={{ color: '#1699ff', margin: 0 }}>
                        已有账号？
                    </Title>
                    <Button
                        shape="round"
                        style={{ width: '98px', height: '36px' }}
                        onClick={() => router.push('/login')}
                    >
                        登录
                    </Button>
                </div>
            </div>
            <div style={{ width: '620px' }}>
                {/* <div
                    style={{
                        height: 37,
                        width: '100%'
                    }}
                >
                    LOGO
                </div> */}
                <Title level={1} style={{ margin: '0 0  24px' }}>
                    立即注册
                </Title>
            </div>
            <UserRegisterForm />
        </>
    )
}
