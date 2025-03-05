// import Title from 'antd/es/typography/Title'
'use client'
import { Card, Row, Col, Button, Flex, Typography } from 'antd'
import Image from 'next/image'
import { ConfigProvider } from 'antd'
import { StyleProvider } from '@ant-design/cssinjs'
import { FieldTimeOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import GoogleLogo from '@/public/images/Google.ee741aca.svg'
import TikTokLogo from '@/public/images/TikTok.f24a474a.svg'
import FacebookLogo from '@/public/images/Facebook.f8e447ad.svg'
const { Text, Title } = Typography
export default function Page() {
    const router = useRouter()
    return (
        <StyleProvider layer>
            <ConfigProvider>
                <Row gutter={24}>
                    <Col span={18}>
                        <Card
                            title="开户申请"
                            extra={
                                <Button
                                    type="link"
                                    icon={<FieldTimeOutlined />}
                                    onClick={() =>
                                        router.push('/application/record')
                                    }
                                >
                                    开户记录
                                </Button>
                            }
                            style={{ width: '100%' }}
                        >
                            {/* <Space
                                direction="horizontal"
                                size={16}
                                style={{ width: '100%' }}
                            > */}
                            <Flex gap={16} className="h-[300px] w-full">
                                <Card className="w-[256px]">
                                    <Flex
                                        vertical
                                        align="center"
                                        justify="space-between"
                                        className="h-[252px]"
                                    >
                                        <Flex
                                            align="center"
                                            gap="small"
                                            justify="start"
                                            style={{
                                                width: '100%',
                                                padding: 0
                                            }}
                                        >
                                            <Image
                                                src={FacebookLogo}
                                                alt="开户申请"
                                                width={40}
                                                height={40}
                                            />
                                            <Title level={3} className="m-0">
                                                Meta
                                                <small className="text-sm">
                                                    For Business
                                                </small>
                                            </Title>
                                        </Flex>
                                        <Text>
                                            全球最大的搜索引擎公司，拥有近30亿月活用户，在客户搜索您的产品或服务的那一刻，恰当其时展示广告。
                                        </Text>
                                        <Button
                                            type="primary"
                                            block
                                            onClick={() =>
                                                router.push(
                                                    '/application/apply/google'
                                                )
                                            }
                                        >
                                            开通申请
                                        </Button>
                                    </Flex>
                                </Card>
                                <Card className="w-[256px]">
                                    <Flex
                                        vertical
                                        align="center"
                                        justify="space-between"
                                        className="h-[252px]"
                                    >
                                        <Flex
                                            align="center"
                                            gap="small"
                                            justify="start"
                                            style={{
                                                width: '100%',
                                                padding: 0
                                            }}
                                        >
                                            <Image
                                                src={TikTokLogo}
                                                alt="开户申请"
                                                width={40}
                                                height={40}
                                            />
                                            <Title level={3} className="m-0">
                                                TikTok
                                                <small className="text-sm">
                                                    For Business
                                                </small>
                                            </Title>
                                        </Flex>
                                        <Text>
                                            全球最大的搜索引擎公司，拥有近30亿月活用户，在客户搜索您的产品或服务的那一刻，恰当其时展示广告。
                                        </Text>
                                        <Button
                                            type="primary"
                                            block
                                            onClick={() =>
                                                router.push(
                                                    '/application/apply/tiktok'
                                                )
                                            }
                                        >
                                            开通申请
                                        </Button>
                                    </Flex>
                                </Card>
                                <Card className="flex h-full w-[256px] flex-col justify-between">
                                    <Flex
                                        vertical
                                        align="center"
                                        justify="space-between"
                                        className="h-[252px]"
                                    >
                                        <Flex
                                            align="center"
                                            gap="small"
                                            justify="start"
                                            style={{
                                                width: '100%',
                                                padding: 0
                                            }}
                                        >
                                            <Image
                                                src={GoogleLogo}
                                                alt="开户申请"
                                                width={40}
                                                height={40}
                                            />
                                            <Title level={3} className="m-0">
                                                Google Ads
                                            </Title>
                                        </Flex>
                                        <Text>
                                            全球最大的搜索引擎公司，拥有近30亿月活用户，在客户搜索您的产品或服务的那一刻，恰当其时展示广告。
                                        </Text>
                                        <Button
                                            type="primary"
                                            block
                                            onClick={() =>
                                                router.push(
                                                    '/application/apply/google'
                                                )
                                            }
                                        >
                                            开通申请
                                        </Button>
                                    </Flex>
                                </Card>
                            </Flex>
                            {/* </Space> */}
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card title="常见问题">
                            {/* <Title level={3}>开户申请</Title> */}
                        </Card>
                    </Col>
                </Row>
            </ConfigProvider>
        </StyleProvider>
        // <div className="h-full overflow-y-auto">
        //     {/* <Title level={3}>开户申请</Title> */}
        // </div>
    )
}
