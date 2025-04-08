'use client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button, Typography } from 'antd'
import logo from '@/public/images/web_logo.png'
import ForgotPasswordForm from './forgot-password-form'

const { Title } = Typography

export default function ForgotPasswordView() {
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
                        记起密码了？
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
            <div style={{ width: '488px' }}>
                <div
                    style={{
                        height: 37,
                        width: '100%',
                        paddingBottom: '70px'
                    }}
                >
                    <Image src={logo} alt="logo" width={100} height={100} />
                </div>
                <Title level={1} style={{ margin: '48px 0 24px' }}>
                    找回密码
                </Title>
            </div>
            <ForgotPasswordForm />
        </>
    )
} 