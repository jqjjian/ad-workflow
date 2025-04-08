import { Metadata } from 'next'
// import Image from 'next/image'
import { Layout } from 'antd'
import { Content } from 'antd/es/layout/layout'
import Title from 'antd/es/typography/Title'
import Paragraph from 'antd/es/typography/Paragraph'

// const { Content } = Layout

export const metadata: Metadata = {
    title: 'Ad-Workflow | Sign In',
    description: 'Sign In page for Ad-Workflow.'
}

export default function Page({
    children
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <Layout>
            {/* <Header>
                <Button type="link">注册</Button>
            </Header> */}
            <Content style={{ display: 'flex', height: '100vh' }}>
                <div
                    style={{
                        width: '40%',
                        padding: '64px',
                        // position: 'relative'
                        // background: '#f0f2f5'
                        backgroundImage:
                            'url(/images/06b4d3dd-3607-4bbc-b2ab-a1ac5405511e.jpeg)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                    }}
                >
                    {/* <Title level={2} style={{ color: '#fff' }}>
                        欢迎来到 Ad-Workflow
                    </Title> */}
                    <div style={{ maxWidth: '450px', marginTop: '100px', lineHeight: '21px' }}>
                        <Title
                            level={1}
                            style={{
                                color: '#fff',
                                fontSize: '48px',
                                letterSpacing: '2px'
                            }}
                        >
                            出海营销全栈式智能服务平台
                        </Title>
                        <Title
                            level={5}
                            style={{ color: '#fff', fontSize: '21px', fontWeight: 'normal' }}
                        >
                            出海跨媒体营销<span style={{ color: '#71a0fe' }}>一站式智能服务平台</span>
                            <br />
                            整合全球营销资源与商业智能赋能
                        </Title>
                    </div>
                    {/* <Paragraph style={{ color: '#fff' }}>
                        这里是平台的描述。您可以在这里管理广告工作流，提升工作效率。
                    </Paragraph> */}
                    {/* <Image
                        src="/images/ef9caf13-3e4a-44c6-a297-bf1dbd731bfa.png"
                        alt="Ad-Workflow"
                        width={100}
                        height={100}
                    /> */}
                    {/* <Image
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%'
                        }}
                        src="/images/ef9caf13-3e4a-44c6-a297-bf1dbd731bfa.jpeg"
                        alt="背景图"
                        fill
                        priority
                        className="object-cover"
                    /> */}
                </div>
                <div
                    style={{
                        width: '60%',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'start',
                        alignItems: 'center'
                    }}
                >
                    {children}
                </div>
            </Content>
        </Layout>
    )
}
