'use client'
import { useState, useEffect } from 'react'
import { useTransition } from 'react'
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
    Upload,
    message,
    type FormProps
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
import { getDictionaryItems } from '@/app/actions/dictionary'
// import { useRouter } from 'next/navigation'
// import Logo from '@/public/images/Google.ee741aca.svg'
const { Text, Title } = Typography
const { Item: FormItem } = Form
export default function Page() {
    const [productTypeList, setProductTypeList] = useState<
        { label: string; value: number }[]
    >([])
    const [isPending, startTransition] = useTransition()
    const [form] = Form.useForm()
    const handleSubmit: FormProps['onFinish'] = (values: TiktokBusiness) => {
        startTransition(async () => {
            console.log('Success:', values)
            try {
                const res = await tiktokApply(values, '123')
                if (res.code === '0') {
                    message.success('开户成功')
                } else {
                    message.error('开户失败')
                }
                // const res = await test(values)
                console.log('res', res)
            } catch (error) {
                console.log('error', error)
            }
        })
    }
    const getDicData = async () => {
        const res = await getDictionaryItems('BUSINESS', 'productType')
        const list = res?.items.map((item) => ({
            label: item.itemName,
            value: Number(item.itemValue)
        }))
        setProductTypeList(list || [])
    }
    const [locationId, setLocationId] = useState(0)
    const rule = createSchemaFieldRule(TiktokBusinessSchema)
    const [tiktokAccount, setTiktokAccount] = useState<TiktokBusiness>({
        companyNameEN: '公司1',
        businessLicenseNo: '123123',
        businessLicenseAttachment: '123123',
        type: 10,
        timezone: 'Asia/Amman1',
        productType: 1,
        promotionLink: 'http://localhost:3000/application/apply/tiktok',
        name: '公司1',
        rechargeAmount: '100',
        advertisingCountries: ['CN', 'US'],
        auths: [],
        registrationDetails: {
            companyNameEN: '1',
            companyName: '2',
            locationId: 0,
            legalRepName: '张三',
            idType: 0,
            idNumber: '123123',
            legalRepPhone: '123123',
            legalRepBankCard: '123123'
        }
    })
    useEffect(() => {
        getDicData()
    }, [])
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
                                    name="businessLicenseAttachment"
                                    labelCol={{ span: 6 }}
                                    rules={[rule]}
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
                                    name="registrationDetails.companyName"
                                    labelCol={{ span: 6 }}
                                    rules={[rule]}
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
                                    name="companyNameEN"
                                    labelCol={{ span: 6 }}
                                    rules={[rule]}
                                >
                                    <div className="pr-[52px]">
                                        <Input placeholder="请输入开户公司名称（英文）" />
                                    </div>
                                </FormItem>
                                <FormItem
                                    label="营业执照统一社会信用代码"
                                    name="businessLicenseNo"
                                    labelCol={{ span: 6 }}
                                    rules={[rule]}
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
                                    labelCol={{ span: 6 }}
                                    // rules={[rule]}
                                >
                                    <div className="pr-[52px]">
                                        <Select
                                            onChange={(value) => {
                                                setLocationId(value)
                                            }}
                                            placeholder="请选务必选择营业执照公司主体的所在地"
                                            options={[
                                                {
                                                    label: '中国大陆',
                                                    value: 1
                                                },
                                                {
                                                    label: '其他',
                                                    value: 0
                                                }
                                            ]}
                                        />
                                    </div>
                                </FormItem>
                                {locationId === 1 && (
                                    <>
                                        <Row>
                                            <Col span={12}>
                                                <FormItem
                                                    label="开户公司法人姓名"
                                                    name={[
                                                        'registrationDetails',
                                                        'legalRepName'
                                                    ]}
                                                    rules={[rule]}
                                                    // initialValue="USD"
                                                    labelCol={{ span: 12 }}
                                                >
                                                    <Input placeholder="请输入开户公司法人姓名" />
                                                </FormItem>
                                            </Col>
                                            <Col
                                                span={12}
                                                className="pr-[52px]"
                                            >
                                                <FormItem
                                                    name={[
                                                        'registrationDetails',
                                                        'idType'
                                                    ]}
                                                    label="证件类型"
                                                    rules={[rule]}
                                                    labelCol={{ span: 10 }}
                                                >
                                                    <Select
                                                        allowClear
                                                        placeholder="请选择账户时区"
                                                        onChange={(value) => {
                                                            form.setFieldsValue(
                                                                {
                                                                    timezone:
                                                                        value
                                                                }
                                                            )
                                                        }}
                                                        options={[
                                                            {
                                                                label: 'Asia/Amman UTC+3',
                                                                value: 'Asia/Amman'
                                                            },
                                                            {
                                                                label: 'Asia/Amman UTC+4',
                                                                value: 'Asia/Amman1'
                                                            }
                                                        ]}
                                                    />
                                                </FormItem>
                                            </Col>
                                        </Row>
                                        <Row>
                                            <Col span={12}>
                                                <FormItem
                                                    label="证件号码"
                                                    name={[
                                                        'registrationDetails',
                                                        'idNumber'
                                                    ]}
                                                    rules={[rule]}
                                                    // initialValue="USD"
                                                    labelCol={{ span: 12 }}
                                                >
                                                    <Input placeholder="请输入证件号码" />
                                                </FormItem>
                                            </Col>
                                            <Col
                                                span={12}
                                                className="pr-[52px]"
                                            >
                                                <FormItem
                                                    name={[
                                                        'registrationDetails',
                                                        'legalRepBankCard'
                                                    ]}
                                                    label="法人银行卡号"
                                                    rules={[rule]}
                                                    labelCol={{ span: 10 }}
                                                >
                                                    <Input placeholder="请输入法人银行卡号" />
                                                </FormItem>
                                            </Col>
                                        </Row>
                                        <Row>
                                            <Col span={12}>
                                                <FormItem
                                                    label="法人手机号"
                                                    name={[
                                                        'registrationDetails',
                                                        'legalRepPhone'
                                                    ]}
                                                    rules={[rule]}
                                                    // initialValue="USD"
                                                    labelCol={{ span: 12 }}
                                                >
                                                    <Input placeholder="请输入法人手机号" />
                                                </FormItem>
                                            </Col>
                                        </Row>
                                    </>
                                )}
                            </div>
                        </Card>
                        <Card>
                            <Title level={4} className="m-0">
                                账户信息
                            </Title>
                            <div className="max-w-[1000px] pt-10">
                                <Row>
                                    <Col span={12} className="pl-[50px]">
                                        <FormItem
                                            label="账户类型"
                                            name="type"
                                            labelCol={{ span: 10 }}
                                            rules={[rule]}
                                        >
                                            <Select
                                                placeholder="请选择账户类型"
                                                options={[
                                                    {
                                                        label: '竞价账户',
                                                        value: 10
                                                    },
                                                    {
                                                        label: '品牌账户',
                                                        value: 20
                                                    }
                                                ]}
                                            />
                                        </FormItem>
                                    </Col>
                                    <Col span={12} className="pr-[52px]">
                                        <FormItem
                                            label="行业"
                                            name="productType"
                                            labelCol={{ span: 7 }}
                                            rules={[rule]}
                                        >
                                            <Select
                                                placeholder="请选择行业"
                                                options={productTypeList}
                                            />
                                        </FormItem>
                                    </Col>
                                </Row>
                                <div className="pr-[52px]">
                                    <FormItem
                                        label="账户时区"
                                        name="timezone"
                                        labelCol={{ span: 6 }}
                                        rules={[rule]}
                                    >
                                        <Select
                                            placeholder="请选择账户时区"
                                            options={[
                                                {
                                                    label: '非洲/阿克拉 UTC+00:00',
                                                    value: '非洲/阿克拉'
                                                },
                                                {
                                                    label: '非洲/开罗 UTC+02:00',
                                                    value: '非洲/开罗'
                                                }
                                            ]}
                                        />
                                    </FormItem>
                                </div>
                                <div className="pr-[52px]">
                                    <FormItem
                                        label="投放国家"
                                        name="advertisingCountries"
                                        labelCol={{ span: 6 }}
                                        rules={[rule]}
                                    >
                                        <Select
                                            mode="multiple"
                                            placeholder="请选择投放国家"
                                            options={[
                                                {
                                                    label: '安道尔',
                                                    value: 'AD'
                                                },
                                                {
                                                    label: '阿联酋',
                                                    value: 'AF'
                                                }
                                            ]}
                                        />
                                    </FormItem>
                                </div>
                                <div className="pr-[52px]">
                                    <FormItem
                                        label="推荐广告"
                                        name="promotionLink"
                                        labelCol={{ span: 6 }}
                                        rules={[rule]}
                                    >
                                        <Input placeholder="请输入推广链接" />
                                        <Text className="text-gray-400">
                                            请确认推广链接是可打开而且是可正常跳转的状态，且链接包含https。
                                        </Text>
                                    </FormItem>
                                </div>
                            </div>
                        </Card>
                        <Card>
                            <Title level={4} className="m-0">
                                账户命名
                            </Title>
                            <div className="max-w-[1000px] pr-[52px] pt-10">
                                <FormItem
                                    label="账户"
                                    name="name"
                                    labelCol={{ span: 6 }}
                                    rules={[rule]}
                                >
                                    <Input />
                                </FormItem>
                                {/* <Row>
                                    <Col span={18} offset={5}>
                                        <FormItem
                                            label={null}
                                            labelCol={{ span: 6 }}
                                        >
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
                            <Flex justify="center">
                                <Space>
                                    <Button
                                        type="default"
                                        onClick={() => {
                                            form.resetFields()
                                        }}
                                    >
                                        重置
                                    </Button>
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        loading={isPending}
                                    >
                                        提交
                                    </Button>
                                </Space>
                            </Flex>
                        </Card>
                    </Flex>
                </Form>
            </ConfigProvider>
        </StyleProvider>
    )
}
