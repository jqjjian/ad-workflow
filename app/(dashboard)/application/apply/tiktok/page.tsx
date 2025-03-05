'use client'
import { useState } from 'react'
import {
    Card,
    Row,
    Col,
    Button,
    Space,
    Flex,
    Select,
    Typography,
    Breadcrumb,
    Form,
    Input,
    Upload
} from 'antd'
import { ConfigProvider } from 'antd'
import { StyleProvider } from '@ant-design/cssinjs'
import Link from 'next/link'
import { createSchemaFieldRule } from 'antd-zod'
import { TiktokBusinessSchema, TiktokBusiness } from '@/schemas'
import { tiktokApply } from '@/app/actions/business'
// import Image from 'next/image'
import {
    InfoCircleOutlined,
    PlusOutlined,
    DeleteOutlined,
    UploadOutlined
} from '@ant-design/icons'
// import { useRouter } from 'next/navigation'
// import Logo from '@/public/images/Google.ee741aca.svg'
const { Text, Title } = Typography
const { Item: FormItem } = Form
export default function Page() {
    const [form] = Form.useForm()
    const handleSubmit = (values: TiktokBusiness) => {
        console.log('Form values:', values)
    }
    const rule = createSchemaFieldRule(TiktokBusinessSchema)
    const [tiktokAccount, setTiktokAccount] = useState<TiktokBusiness>({
        companyNameEN: '公司1',
        businessLicenseNo: '123123',
        businessLicenseAttachment: '123123',
        type: 0,
        timezone: 'Asia/Shanghai',
        productType: 0,
        promotionLink: 'http://localhost:3000/application/apply/tiktok',
        name: '公司1',
        rechargeAmount: '100',
        advertisingCountries: ['CN', 'US'],
        auths: []
    })
    return (
        <StyleProvider layer>
            <ConfigProvider>
                <Breadcrumb
                    className="mb-4"
                    items={[
                        { title: '开户管理' },
                        {
                            title: (
                                <Link href="/application/apply">开户申请</Link>
                            )
                        },
                        {
                            title: 'TikTok 平台开户申请'
                        }
                    ]}
                />
                <Title level={3} className="m-0 mb-4">
                    TikTok 平台开户申请
                </Title>
                <Form
                    layout="horizontal"
                    form={form}
                    onFinish={handleSubmit}
                    initialValues={tiktokAccount}
                    onValuesChange={(changedValues, allValues) => {
                        console.log('Form values changed:', changedValues)
                        console.log('All form values:', allValues)
                    }}
                >
                    <Flex gap={20} vertical>
                        <Card>
                            <Title level={4} className="m-0">
                                企业信息
                            </Title>
                            <div className="max-w-[1000px] pt-10">
                                <Row>
                                    <Col
                                        span={18}
                                        offset={6}
                                        className="pr-[52px]"
                                    >
                                        <div className="mb-6 h-[110px] w-full rounded-md border-[#1e5eff] bg-[#dfe8fc] px-4 py-2 text-gray-600">
                                            <Flex vertical gap={2}>
                                                <Text className="text-gray-500">
                                                    <InfoCircleOutlined className="mr-2" />
                                                    营业执照要求：
                                                </Text>
                                                <Text>
                                                    1.
                                                    请尽量提供清晰且无水印的营业执照证件，且必须是真实最新的版本
                                                </Text>
                                                <Text>
                                                    2.
                                                    确保营业执照下方的二维码可识别
                                                </Text>
                                                <Text>
                                                    3.
                                                    提交的营业执照或组织机构代码证照片不清晰或不完整会导致不匹配，核对无误后再提交开户申请
                                                </Text>
                                            </Flex>
                                        </div>
                                    </Col>
                                </Row>
                                <FormItem
                                    label="营业执照"
                                    name="name"
                                    labelCol={{ span: 6 }}
                                >
                                    <Upload
                                        action="https://660d2bd96ddfa2943b33731c.mockapi.io/api/upload"
                                        listType="picture"
                                        defaultFileList={[]}
                                    >
                                        <Button
                                            type="primary"
                                            icon={<UploadOutlined />}
                                        >
                                            上传
                                        </Button>
                                    </Upload>
                                    <Text className="text-gray-400">
                                        如重新上传营业执照，营业执照中的“公司名称”与“营业执照统一社会信用代码"需与下方的信息一致。
                                        仅支持图片格式：JPG/JPEG/PNG；附件大小上限为10M；香港主体请提供BR
                                    </Text>
                                </FormItem>
                                {/* <Col
                                        span={18}
                                        offset={6}
                                        className="mt-[-20px] pr-[52px]"
                                    >
                                        <Text className="text-gray-400">
                                            如重新上传营业执照，营业执照中的“公司名称”与“营业执照统一社会信用代码"需与下方的信息一致。
                                            仅支持图片格式：JPG/JPEG/PNG；附件大小上限为10M；香港主体请提供BR
                                        </Text>
                                    </Col> */}
                                <FormItem
                                    label="开户公司名称（中文）"
                                    name="name"
                                    labelCol={{ span: 6 }}
                                >
                                    <div className="pr-[52px]">
                                        <Input placeholder="请输入开户公司名称（中文）" />
                                        <Text className="text-gray-400">
                                            开户公司名称中/英文请必填一项，中文必须与营业执照一致
                                        </Text>
                                    </div>
                                </FormItem>

                                <FormItem
                                    label="开户公司名称（英文）"
                                    name="name"
                                    labelCol={{ span: 6 }}
                                >
                                    <div className="pr-[52px]">
                                        <Input placeholder="请输入开户公司名称（英文）" />
                                    </div>
                                </FormItem>
                                <FormItem
                                    label="营业执照统一社会信用代码"
                                    name="name"
                                    labelCol={{ span: 6 }}
                                >
                                    <div className="pr-[52px]">
                                        <Input placeholder="请输入营业执照统一社会信用代码" />
                                        <Text className="text-gray-400">
                                            营业执照统一社会信用代码的大小写需要与营业执照一致
                                        </Text>
                                    </div>
                                </FormItem>
                                <FormItem
                                    label="开户公司所在地"
                                    name="name"
                                    labelCol={{ span: 6 }}
                                >
                                    <div className="pr-[52px]">
                                        <Select
                                            placeholder="请选务必选择营业执照公司主体的所在地"
                                            options={[
                                                {
                                                    label: '中国大陆',
                                                    value: '1'
                                                },
                                                {
                                                    label: '其他',
                                                    value: '2'
                                                }
                                            ]}
                                        />
                                    </div>
                                </FormItem>
                                {/* <Row>
                                    <Col span={18} offset={6}>
                                        <Flex gap={20}>
                                            <FormItem
                                                className="flex-1"
                                                label=""
                                                name="aaa"
                                                rules={[
                                                    {
                                                        required: true,
                                                        message:
                                                            '请输入推广链接'
                                                    }
                                                ]}
                                            >
                                                <Input />
                                            </FormItem>
                                            <Button
                                                type="text"
                                                color="danger"
                                                variant="filled"
                                                icon={<DeleteOutlined />}
                                            />
                                        </Flex>
                                    </Col>
                                    <Col span={18} offset={6}>
                                        <FormItem label="" name="name">
                                            <Button
                                                size="small"
                                                type="primary"
                                                icon={<PlusOutlined />}
                                            />
                                        </FormItem>
                                    </Col>
                                </Row> */}
                            </div>
                        </Card>
                        <Card>
                            <Title level={4} className="m-0">
                                账户信息
                            </Title>
                            <div className="max-w-[1000px] pt-10">
                                <Row>
                                    <Col span={12}>
                                        <FormItem
                                            label="账户类型"
                                            name="name"
                                            labelCol={{ span: 12 }}
                                        >
                                            <div className="pr-[52px]">
                                                <Select
                                                    placeholder="请选择账户类型"
                                                    options={[
                                                        {
                                                            label: '账户类型1',
                                                            value: '1'
                                                        },
                                                        {
                                                            label: '账户类型2',
                                                            value: '2'
                                                        }
                                                    ]}
                                                />
                                            </div>
                                        </FormItem>
                                    </Col>
                                    <Col span={12}>
                                        <FormItem
                                            label="行业"
                                            name="name"
                                            labelCol={{ span: 10 }}
                                        >
                                            <div className="pr-[52px]">
                                                <Select
                                                    placeholder="请选择行业"
                                                    options={[
                                                        {
                                                            label: '行业1',
                                                            value: '1'
                                                        },
                                                        {
                                                            label: '行业2',
                                                            value: '2'
                                                        }
                                                    ]}
                                                />
                                            </div>
                                        </FormItem>
                                    </Col>
                                </Row>
                                <FormItem
                                    label="账户时区"
                                    name="name"
                                    labelCol={{ span: 6 }}
                                >
                                    <div className="w-full pr-[52px]">
                                        <Select
                                            placeholder="请选择账户时区"
                                            options={[
                                                {
                                                    label: '时区1',
                                                    value: '1'
                                                },
                                                {
                                                    label: '时区2',
                                                    value: '2'
                                                }
                                            ]}
                                        />
                                    </div>
                                </FormItem>
                                <FormItem
                                    label="推荐广告"
                                    name="name"
                                    labelCol={{ span: 6 }}
                                >
                                    <div className="pr-[52px]">
                                        <Input placeholder="请输入推广链接" />
                                    </div>
                                    <Text className="text-gray-400">
                                        请确认推广链接是可打开而且是可正常跳转的状态，且链接包含https。
                                    </Text>
                                </FormItem>
                            </div>
                        </Card>
                        <Card>
                            <Title level={4} className="m-0">
                                账户命名
                            </Title>
                            <div className="max-w-[1000px] pt-10">
                                <FormItem
                                    label="账户"
                                    name="aaa"
                                    labelCol={{ span: 6 }}
                                    rules={[
                                        {
                                            required: true,
                                            message: '请输入推广链接'
                                        }
                                    ]}
                                >
                                    <div className="pr-[52px]">
                                        <Input />
                                    </div>
                                </FormItem>
                                <Flex vertical className="pl-[18px]">
                                    {/* <Flex gap={20}>
                                        <FormItem
                                            className="flex-1"
                                            label="账户2"
                                            name="aaa"
                                            labelCol={{ span: 6 }}
                                            rules={[
                                                {
                                                    required: true,
                                                    message: '请输入推广链接'
                                                }
                                            ]}
                                        >
                                            <Input />
                                        </FormItem>
                                        <Button
                                            type="text"
                                            color="danger"
                                            variant="filled"
                                            icon={<DeleteOutlined />}
                                        />
                                    </Flex>
                                    <Flex gap={20}>
                                        <FormItem
                                            className="flex-1"
                                            label="账户3"
                                            name="aaa"
                                            labelCol={{ span: 6 }}
                                            rules={[
                                                {
                                                    required: true,
                                                    message: '请输入推广链接'
                                                }
                                            ]}
                                        >
                                            <Input />
                                        </FormItem>
                                        <Button
                                            type="text"
                                            color="danger"
                                            variant="filled"
                                            icon={<DeleteOutlined />}
                                        />
                                    </Flex> */}
                                    <Row>
                                        <Col span={18} offset={5}>
                                            <FormItem
                                                label={null}
                                                name="name"
                                                labelCol={{ span: 6 }}
                                            >
                                                <div className="pl-[25px]">
                                                    <Button
                                                        size="small"
                                                        type="primary"
                                                        icon={<PlusOutlined />}
                                                    />
                                                </div>
                                            </FormItem>
                                        </Col>
                                    </Row>
                                </Flex>

                                {/* <Row>
                                    <Col span={18} offset={4}>
                                        <FormItem label="" name="name">
                                            <div className="pl-[5px]">
                                                <Button
                                                    size="small"
                                                    type="primary"
                                                    icon={<PlusOutlined />}
                                                />
                                            </div>
                                        </FormItem>
                                    </Col>
                                </Row> */}
                            </div>
                        </Card>
                    </Flex>
                </Form>
            </ConfigProvider>
        </StyleProvider>
    )
}
