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
import { GoogleAccountSchema, GoogleAccount, ApplyRecordData } from '@/schemas'
import {
    googleApply,
    updateGoogleApply,
    getApplyRecord
} from '@/app/actions/business'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { message } from 'antd'
// import Image from 'next/image'
import {
    FieldTimeOutlined,
    PlusOutlined,
    DeleteOutlined
} from '@ant-design/icons'
import { useSearchParams } from 'next/navigation'
import { type Rule } from 'antd/es/form'
const { Text, Title } = Typography
const { Item: FormItem, List } = Form
// const url = 'https://test-ua-gw.tec-develop.cn/uni-agency'
// const token = 'ad776656d49f4adb840ef6187115fb8b'

// 定义返回数据的类型
// interface MediaAccountApplication {
//     taskId: string
//     taskNumber: string
//     mediaAccountInfo: {
//         productType: number
//         currencyCode: string
//         timezone: string
//         rechargeAmount: string
//         promotionLinks: string[]
//         name: string
//         auths: Array<{ value: string; role: number }>
//     }
// }

export default function Page() {
    const { data: session, status } = useSession()
    const userId = session?.user?.id
    // console.log('userId', userId)
    const [productTypeList, setProductTypeList] = useState<
        { label: string; value: number }[]
    >([])
    const [googleAccount, setGoogleAccount] = useState<GoogleAccount>({
        productType: undefined,
        currencyCode: '',
        timezone: '',
        promotionLinks: [''],
        name: '',
        rechargeAmount: '',
        auths: [null]
    })
    const searchParams = useSearchParams()
    const taskId = searchParams.get('taskId')
    const isEdit = !!taskId
    const [loading, setLoading] = useState(false)
    const requiredRule = { required: true }
    const rule = createSchemaFieldRule(GoogleAccountSchema)
    // const authRule = createSchemaFieldRule(AuthItemSchema)

    // 邮箱验证规则
    const emailValidateRule = (field: any): Rule[] => [
        {
            validator: async (_: any, value: string) => {
                const role = form.getFieldValue(['auths', field.name, 'role'])

                // 如果权限有值，且正在输入邮箱，触发权限字段的重新验证
                if (role && value) {
                    form.validateFields([['auths', field.name, 'role']])
                }

                // 如果邮箱有值，验证格式
                if (
                    value &&
                    !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(
                        value
                    )
                ) {
                    return Promise.reject('请输入正确的邮箱格式')
                }

                // 如果只有邮箱有值，没有权限
                if (value && !role) {
                    return Promise.reject('授权邮箱和权限必须同时填写')
                }

                return Promise.resolve()
            }
        }
    ]

    // 权限验证规则
    const roleValidateRule = (field: any): Rule[] => [
        {
            validator: async (_: any, value: number) => {
                const email = form.getFieldValue(['auths', field.name, 'value'])

                // 如果只有权限有值，没有邮箱
                if (value && !email) {
                    return Promise.reject('授权邮箱和权限必须同时填写')
                }

                return Promise.resolve()
            }
        }
    ]

    const getDicData = async () => {
        try {
            const res = await getDictionaryItems('BUSINESS', 'productType')
            if (res?.items) {
                const list = res.items.map((item) => ({
                    label: item.itemName,
                    value: Number(item.itemValue)
                }))
                setProductTypeList(list)
            }
        } catch (error: any) {
            console.error('获取字典数据失败:', error)
            message.error('获取产品类型失败')
        }
    }
    const [isPending, startTransition] = useTransition()
    const [form] = Form.useForm()
    const handleSubmit: FormProps['onFinish'] = async (
        values: GoogleAccount
    ) => {
        if (!userId) {
            message.error('用户未登录')
            return
        }

        setLoading(true)
        try {
            // 确保数据类型正确
            const formData = {
                ...values,
                productType: Number(values.productType),
                promotionLinks: Array.isArray(values.promotionLinks)
                    ? values.promotionLinks
                    : [values.promotionLinks],
                auths: values.auths
                    ?.filter((auth) => auth !== null)
                    .map((auth) => ({
                        role: Number(auth.role),
                        value: auth.value
                    })) || [null]
            }

            console.log('提交的数据:', formData)

            let res
            if (isEdit && taskId) {
                res = await updateGoogleApply(formData, userId, taskId)
            } else {
                res = await googleApply(formData, userId)
            }

            if (res.success) {
                message.success(isEdit ? '修改成功' : '开户成功')
            } else {
                // 处理业务错误
                if (res.message?.includes('Unauthorized')) {
                    message.error('登录已过期，请重新登录')
                    return
                }
                message.error(res.message || (isEdit ? '修改失败' : '开户失败'))
            }
        } catch (error: any) {
            console.error('提交错误:', error)
            if (error.message?.includes('Unauthorized')) {
                message.error('登录已过期，请重新登录')
                return
            }
            message.error(error.message || (isEdit ? '修改失败' : '开户失败'))
        } finally {
            setLoading(false)
        }
    }
    const fetchTaskDetail = async () => {
        if (!taskId || !userId) return

        setLoading(true)
        try {
            const res = await getApplyRecord({
                taskIds: taskId
            })

            if (
                res.success &&
                res.data?.mediaAccountApplications?.[0]?.mediaAccountInfos
            ) {
                const mediaAccountInfo =
                    res.data.mediaAccountApplications[0].mediaAccountInfos[0]
                const formData = {
                    ...mediaAccountInfo,
                    productType: Number(mediaAccountInfo.productType),
                    promotionLinks: Array.isArray(
                        mediaAccountInfo.promotionLinks
                    )
                        ? mediaAccountInfo.promotionLinks
                        : [mediaAccountInfo.promotionLinks].filter(Boolean),
                    auths: mediaAccountInfo.auths?.map((auth) =>
                        auth
                            ? {
                                  role: Number(auth.role),
                                  value: auth.value
                              }
                            : null
                    ) || [null]
                }

                console.log('设置表单数据:', formData)
                form.setFieldsValue(formData)
                setGoogleAccount(formData)
            } else {
                if (res.message?.includes('Unauthorized')) {
                    message.error('登录已过期，请重新登录')
                    return
                }
                message.error(res.message || '获取任务详情失败')
            }
        } catch (error: any) {
            console.error('获取任务详情失败:', error)
            if (error.message?.includes('Unauthorized')) {
                message.error('登录已过期，请重新登录')
                return
            }
            message.error(error.message || '获取任务详情失败')
        } finally {
            setLoading(false)
        }
    }
    useEffect(() => {
        // 检查登录状态
        if (status === 'unauthenticated') {
            message.error('请先登录')
            return
        }

        getDicData()
        if (isEdit) {
            fetchTaskDetail()
        }
    }, [taskId, status])

    // 如果未登录，显示加载状态或重定向
    if (status === 'loading' || !session) {
        return <div>Loading...</div>
    }

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
                    onFinishFailed={(errorInfo) => {
                        console.log('表单验证失败:', errorInfo)
                    }}
                    initialValues={googleAccount}
                    disabled={loading}
                    validateMessages={{
                        required: '${label}不能为空',
                        types: {
                            email: '请输入正确的邮箱格式',
                            number: '请输入数字',
                            string: '请输入文字'
                        }
                    }}
                    onValuesChange={(changedValues, allValues) => {
                        console.log('表单值变化:', {
                            changed: changedValues,
                            all: allValues
                        })
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
                                            rules={[
                                                {
                                                    required: true,
                                                    message: '产品类型不能为空'
                                                },
                                                {
                                                    type: 'number',
                                                    message:
                                                        '请选择有效的产品类型'
                                                }
                                            ]}
                                            labelCol={{ span: 12 }}
                                        >
                                            <Select
                                                allowClear
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
                                            rules={[
                                                {
                                                    required: true,
                                                    message: '货币代码不能为空'
                                                }
                                            ]}
                                            labelCol={{ span: 12 }}
                                        >
                                            <Select
                                                allowClear
                                                placeholder="请选择币种"
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
                                            rules={[requiredRule, rule]}
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
                                                            key={field.key}
                                                        >
                                                            <FormItem
                                                                labelCol={{
                                                                    span: 6
                                                                }}
                                                                label="推广链接"
                                                                name={
                                                                    field.name
                                                                }
                                                                rules={[
                                                                    {
                                                                        required:
                                                                            true,
                                                                        message:
                                                                            '推广链接不能为空'
                                                                    },
                                                                    {
                                                                        type: 'url',
                                                                        message:
                                                                            '请输入有效的链接'
                                                                    }
                                                                ]}
                                                            >
                                                                <Input
                                                                    allowClear
                                                                    placeholder="请输入推广链接"
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
                                                                    name={
                                                                        field.name
                                                                    }
                                                                    fieldKey={
                                                                        field.fieldKey
                                                                    }
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
                                                                                '推广链接不能为空'
                                                                        },
                                                                        {
                                                                            type: 'url',
                                                                            message:
                                                                                '请输入有效的链接'
                                                                        }
                                                                    ]}
                                                                    required={
                                                                        true
                                                                    }
                                                                >
                                                                    <Input
                                                                        allowClear
                                                                        placeholder="请输入推广链接"
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
                                                                    rules={emailValidateRule(
                                                                        field
                                                                    )}
                                                                >
                                                                    <Input placeholder="请输入授权邮箱" />
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
                                                                    rules={roleValidateRule(
                                                                        field
                                                                    )}
                                                                >
                                                                    <Select
                                                                        allowClear
                                                                        placeholder="请选择权限"
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
                                                                rules={emailValidateRule(
                                                                    field
                                                                )}
                                                            >
                                                                <Input placeholder="请输入授权邮箱" />
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
                                                                    rules={roleValidateRule(
                                                                        field
                                                                    )}
                                                                >
                                                                    <Select
                                                                        allowClear
                                                                        placeholder="请选择权限"
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
                                    rules={[requiredRule, rule]}
                                    label="账户名称"
                                    name="name"
                                    labelCol={{ span: 6 }}
                                >
                                    <Input placeholder="请输入账户名称" />
                                </FormItem>
                            </div>
                        </Card>
                        <Card>
                            <Flex justify="center">
                                <Space>
                                    <Button
                                        type="default"
                                        onClick={() => {
                                            if (isEdit) {
                                                fetchTaskDetail()
                                            } else {
                                                form.resetFields()
                                            }
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
