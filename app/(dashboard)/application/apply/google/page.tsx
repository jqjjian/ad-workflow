'use client'
import { useState, useEffect, useTransition } from 'react'
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
    type FormProps
} from 'antd'
import { ConfigProvider } from 'antd'
import { StyleProvider } from '@ant-design/cssinjs'
import { getDictionaryItems } from '@/app/actions/dictionary'
import { createSchemaFieldRule } from 'antd-zod'
import { GoogleAccountSchema, GoogleAccount } from '@/schemas'
import { googleApply } from '@/app/actions/business'
import Link from 'next/link'
import { message } from 'antd'
// import Image from 'next/image'
import {
    FieldTimeOutlined,
    PlusOutlined,
    DeleteOutlined
} from '@ant-design/icons'
const { Text, Title } = Typography
const { Item: FormItem, List } = Form
// const url = 'https://test-ua-gw.tec-develop.cn/uni-agency'
// const token = 'ad776656d49f4adb840ef6187115fb8b'
export default function Page() {
    const [productTypeList, setProductTypeList] = useState<
        { label: string; value: number }[]
    >([])
    const [googleAccount, setGoogleAccount] = useState<GoogleAccount>({
        productType: 1,
        currencyCode: 'USD',
        timezone: 'Asia/Amman',
        rechargeAmount: '10.01',
        promotionLinks: ['http://localhost:3000/application/apply/google'],
        name: '123',
        auths: [
            {
                value: '123123',
                role: 1
            }
        ]
    })
    const getDicData = async () => {
        const res = await getDictionaryItems('BUSINESS', 'productType')
        const list = res?.items.map((item) => ({
            label: item.itemName,
            value: Number(item.itemValue)
        }))
        setProductTypeList(list || [])
    }
    const [isPending, startTransition] = useTransition()
    const [form] = Form.useForm()
    const handleSubmit: FormProps['onFinish'] = (values: GoogleAccount) => {
        startTransition(async () => {
            console.log('Success:', values)
            try {
                const res = await googleApply(values, '123')
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
    const rule = createSchemaFieldRule(GoogleAccountSchema)
    const timezoneRule = createSchemaFieldRule(
        GoogleAccountSchema.pick({ timezone: true })
    )
    // const test = async (data: GoogleAccount) => {
    //     const res = await fetch(url, {
    //         method: 'POST',
    //         headers: {
    //             'Content-Type': 'application/json',
    //             'Access-Token': token
    //         },
    //         body: JSON.stringify(data)
    //     })
    //     return res.json()
    // }
    useEffect(() => {
        // form.setFieldsValue({
        //     promotionLinks: [''],
        //     auths: [
        //         {
        //             value: '',
        //             role: null
        //         }
        //     ]
        // })
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
                            title: 'Google Ads'
                        }
                    ]}
                />
                <Title level={3} className="m-0 mb-4">
                    Google 平台开户申请
                </Title>
                <Form
                    layout="horizontal"
                    form={form}
                    onFinish={handleSubmit}
                    initialValues={googleAccount}
                    onValuesChange={(changedValues, allValues) => {
                        console.log('Form values changed:', changedValues)
                        console.log('All form values:', allValues)
                    }}
                >
                    <Flex gap={20} vertical>
                        <Card>
                            <Title level={4} className="m-0">
                                账户信息
                            </Title>
                            <div className="max-w-[1000px] pt-10">
                                <Row>
                                    <Col span={12}>
                                        <FormItem
                                            label="产品类型"
                                            name="productType"
                                            rules={[rule]}
                                            // initialValue={null}
                                            labelCol={{ span: 12 }}
                                        >
                                            <Select
                                                placeholder="请选择产品类型"
                                                options={productTypeList}
                                            />
                                        </FormItem>
                                    </Col>
                                </Row>
                                <Row>
                                    <Col span={12}>
                                        <FormItem
                                            label="币种"
                                            name="currencyCode"
                                            rules={[rule]}
                                            // initialValue="USD"
                                            labelCol={{ span: 12 }}
                                        >
                                            <Select
                                                options={[
                                                    {
                                                        label: 'USD',
                                                        value: 'USD'
                                                    }
                                                ]}
                                            />
                                        </FormItem>
                                    </Col>
                                    <Col span={12} className="pr-[52px]">
                                        <FormItem
                                            name="timezone"
                                            label="账户时区"
                                            rules={[timezoneRule]}
                                            labelCol={{ span: 10 }}
                                        >
                                            <Select
                                                allowClear
                                                placeholder="请选择账户时区"
                                                onChange={(value) => {
                                                    form.setFieldsValue({
                                                        timezone: value
                                                    })
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
                                <List name="promotionLinks">
                                    {(fields, { add, remove }) => (
                                        <div>
                                            {fields.map((field, index) => {
                                                if (index === 0) {
                                                    return (
                                                        <div
                                                            className="pl-[18px] pr-[52px]"
                                                            key={`${field.name} + ${index}`}
                                                        >
                                                            <FormItem
                                                                label="推广链接"
                                                                labelCol={{
                                                                    span: 6
                                                                }}
                                                                rules={[rule]}
                                                            >
                                                                <Input
                                                                    allowClear
                                                                />
                                                            </FormItem>
                                                        </div>
                                                    )
                                                }
                                                return (
                                                    <Row
                                                        className="pl-[18px]"
                                                        key={field.key}
                                                    >
                                                        <Col
                                                            span={20}
                                                            offset={4}
                                                        >
                                                            <Flex
                                                                gap={20}
                                                                className="pl-[68px]"
                                                            >
                                                                <FormItem
                                                                    {...field}
                                                                    className="flex-1"
                                                                    label={null}
                                                                    labelCol={{
                                                                        span: 6
                                                                    }}
                                                                    rules={[
                                                                        rule
                                                                    ]}
                                                                    key={null}
                                                                >
                                                                    <Input
                                                                        allowClear
                                                                    />
                                                                </FormItem>
                                                                <Button
                                                                    type="text"
                                                                    color="danger"
                                                                    variant="filled"
                                                                    onClick={() =>
                                                                        remove(
                                                                            field.name
                                                                        )
                                                                    }
                                                                    icon={
                                                                        <DeleteOutlined />
                                                                    }
                                                                />
                                                            </Flex>
                                                        </Col>
                                                    </Row>
                                                )
                                            })}
                                            <Row className="pl-[18px]">
                                                <Col span={18} offset={5}>
                                                    <FormItem
                                                        label={null}
                                                        name="name"
                                                        labelCol={{
                                                            span: 6
                                                        }}
                                                    >
                                                        <div className="pl-[25px]">
                                                            <Button
                                                                size="small"
                                                                type="primary"
                                                                onClick={() =>
                                                                    add()
                                                                }
                                                                icon={
                                                                    <PlusOutlined />
                                                                }
                                                            />
                                                        </div>
                                                    </FormItem>
                                                </Col>
                                            </Row>
                                        </div>
                                    )}
                                </List>
                                {/* <FormItem
                                    label="推广链接"
                                    name="promotionLinks"
                                    labelCol={{ span: 6 }}
                                >
                                    <List name="promotionLinks">
                                        {(fields, { add, remove }) => (
                                            <div>
                                                <div className="pr-[52px]">
                                                    <Input allowClear />
                                                    <Text className="text-gray-400">
                                                        请确认推广链接是可打开而且是可正常跳转的状态。链接示例：https://uniagency.tec-do.com
                                                    </Text>
                                                </div>
                                                <Flex
                                                    vertical
                                                    className="pl-[18px]"
                                                >
                                                    <Row>
                                                        <Col
                                                            span={20}
                                                            offset={4}
                                                        >
                                                            <Flex
                                                                gap={20}
                                                                className="pl-[68px]"
                                                            >
                                                                <FormItem
                                                                    className="flex-1"
                                                                    label={null}
                                                                    labelCol={{
                                                                        span: 6
                                                                    }}
                                                                    rules={[
                                                                        {
                                                                            required:
                                                                                true,
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
                                                                    icon={
                                                                        <DeleteOutlined />
                                                                    }
                                                                />
                                                            </Flex>
                                                        </Col>

                                                        <Col
                                                            span={18}
                                                            offset={5}
                                                        >
                                                            <FormItem
                                                                label={null}
                                                                name="name"
                                                                labelCol={{
                                                                    span: 6
                                                                }}
                                                            >
                                                                <div className="pl-[25px]">
                                                                    <Button
                                                                        size="small"
                                                                        type="primary"
                                                                        onClick={() =>
                                                                            add()
                                                                        }
                                                                        icon={
                                                                            <PlusOutlined />
                                                                        }
                                                                    />
                                                                </div>
                                                            </FormItem>
                                                        </Col>
                                                    </Row>
                                                </Flex>
                                            </div>
                                        )}
                                    </List>
                                </FormItem>
                                <Flex vertical className="pl-[18px]">
                                    <Row>
                                        <Col span={20} offset={4}>
                                            <Flex
                                                gap={20}
                                                className="pl-[68px]"
                                            >
                                                <FormItem
                                                    className="flex-1"
                                                    label={null}
                                                    name="aaa"
                                                    labelCol={{ span: 6 }}
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
                                </Flex> */}
                            </div>
                        </Card>
                        <Card>
                            <Title level={4} className="m-0">
                                授权信息
                            </Title>
                            <div className="max-w-[1000px] pt-10">
                                <List name="auths">
                                    {(fields, { add, remove }) => (
                                        <div>
                                            {fields.map((field, index) => {
                                                if (index === 0) {
                                                    return (
                                                        <Row key={field.key}>
                                                            <Col span={12}>
                                                                <FormItem
                                                                    label="授权邮箱"
                                                                    name={[
                                                                        field.name,
                                                                        'value'
                                                                    ]}
                                                                    labelCol={{
                                                                        span: 12
                                                                    }}
                                                                >
                                                                    <Input />
                                                                </FormItem>
                                                            </Col>
                                                            <Col
                                                                span={12}
                                                                className="pr-[52px]"
                                                            >
                                                                <FormItem
                                                                    label="权限"
                                                                    name={[
                                                                        field.name,
                                                                        'role'
                                                                    ]}
                                                                    labelCol={{
                                                                        span: 8
                                                                    }}
                                                                >
                                                                    <Select
                                                                        options={[
                                                                            {
                                                                                label: '标准',
                                                                                value: 1
                                                                            },
                                                                            {
                                                                                label: '只读',
                                                                                value: 2
                                                                            },
                                                                            {
                                                                                label: '管理员',
                                                                                value: 3
                                                                            }
                                                                        ]}
                                                                    />
                                                                </FormItem>
                                                            </Col>
                                                        </Row>
                                                    )
                                                }
                                                return (
                                                    <Row key={field.key}>
                                                        <Col
                                                            span={6}
                                                            offset={6}
                                                        >
                                                            <FormItem
                                                                label={null}
                                                                name={[
                                                                    field.name,
                                                                    'value'
                                                                ]}
                                                                labelCol={{
                                                                    span: 12
                                                                }}
                                                            >
                                                                <Input />
                                                            </FormItem>
                                                        </Col>
                                                        <Col
                                                            offset={3}
                                                            className="flex-1 pl-[24px]"
                                                        >
                                                            <Flex gap={20}>
                                                                <FormItem
                                                                    className="flex-1"
                                                                    label={null}
                                                                    name={[
                                                                        field.name,
                                                                        'role'
                                                                    ]}
                                                                    labelCol={{
                                                                        span: 8
                                                                    }}
                                                                >
                                                                    <Select
                                                                        options={[
                                                                            {
                                                                                label: '标准',
                                                                                value: 1
                                                                            },
                                                                            {
                                                                                label: '只读',
                                                                                value: 2
                                                                            },
                                                                            {
                                                                                label: '管理员',
                                                                                value: 3
                                                                            }
                                                                        ]}
                                                                    />
                                                                </FormItem>
                                                                <Button
                                                                    type="text"
                                                                    color="danger"
                                                                    variant="filled"
                                                                    onClick={() =>
                                                                        remove(
                                                                            field.name
                                                                        )
                                                                    }
                                                                    icon={
                                                                        <DeleteOutlined />
                                                                    }
                                                                />
                                                            </Flex>
                                                        </Col>
                                                    </Row>
                                                )
                                            })}
                                            <Row>
                                                <Col span={18} offset={5}>
                                                    <FormItem
                                                        label={null}
                                                        name="name"
                                                        labelCol={{ span: 6 }}
                                                    >
                                                        <div className="pl-[40px]">
                                                            <Button
                                                                size="small"
                                                                type="primary"
                                                                onClick={() =>
                                                                    add()
                                                                }
                                                                icon={
                                                                    <PlusOutlined />
                                                                }
                                                            />
                                                        </div>
                                                    </FormItem>
                                                </Col>
                                            </Row>
                                        </div>
                                    )}
                                </List>
                            </div>
                        </Card>
                        <Card>
                            <Title level={4} className="m-0">
                                授权命名
                            </Title>
                            <div className="max-w-[1000px] pr-[52px] pt-10">
                                <FormItem
                                    rules={[rule]}
                                    label="账户名称"
                                    name="name"
                                    labelCol={{ span: 6 }}
                                >
                                    {/* <div className="pr-[52px]"> */}
                                    <Input />
                                    {/* </div> */}
                                </FormItem>
                            </div>
                            {/* <Row>
                                <Col span={12}>
                                    <FormItem
                                        label="账户名称"
                                        name="name"
                                        labelCol={{ span: 4 }}
                                    >
                                        <div className="pr-[52px]">
                                            <Input />
                                        </div>
                                    </FormItem>

                                    <Row>
                                        <Col span={20} offset={4}>
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
                                        <Col span={12} offset={4}>
                                            <FormItem label="" name="name">
                                                <Button
                                                    size="small"
                                                    type="primary"
                                                    icon={<PlusOutlined />}
                                                />
                                            </FormItem>
                                        </Col>
                                    </Row>
                                </Col>
                            </Row> */}
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
                                    <Button type="primary" htmlType="submit">
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
