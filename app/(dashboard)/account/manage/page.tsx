'use client'

import { useState, useEffect } from 'react'
import { message } from 'antd'
import {
    Select,
    Input,
    DatePicker,
    Button,
    Table,
    Space,
    Form,
    Card,
    Radio,
    InputNumber,
    Row,
    Col,
    Flex
} from 'antd'
import type { TableColumnsType } from 'antd'
import { StyleProvider } from '@ant-design/cssinjs'
import { ConfigProvider } from 'antd'
import { Breadcrumb, Typography } from 'antd'
import Link from 'next/link'
import { queryMediaAccounts } from '@/app/actions/business'
import { MediaAccountsearch } from '@/schemas'
import { MediaAccountResponseType } from '@/schemas/third-party-type'
const { Title } = Typography
// 定义账户数据接口
interface AccountData {
    mediaAccountId: string
    mediaAccountName: string
    companyName: string
    mediaPlatform: number
    status: number
}

// 定义筛选条件接口
interface FilterParams {
    accountType: 'name' | 'id'
    accountValue: string
    company: string
    platform: string
    status: string
    dateRange: [string, string]
    spendCondition: string
    pageNumber?: number
    pageSize?: number
}

type MediaAccount = MediaAccountResponseType['mediaAccounts'][number]

export default function AccountManagePage() {
    const [form] = Form.useForm<MediaAccountsearch>()
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<MediaAccount[]>([])
    const [selectedRows, setSelectedRows] = useState<MediaAccount[]>([])
    const [total, setTotal] = useState(0)

    // 表格列定义
    const columns: TableColumnsType<MediaAccount> = [
        {
            title: '账户名称与账户ID',
            key: 'account',
            render: (_, record) => (
                <Space direction="vertical" size="small">
                    <span>{record.mediaAccountName}</span>
                    <span>{record.mediaAccountId}</span>
                </Space>
            )
        },
        {
            title: '公司主体',
            dataIndex: 'companyName',
            key: 'companyName'
        },
        {
            title: '媒体平台',
            dataIndex: 'mediaPlatform',
            key: 'mediaPlatform',
            render: (platform) => {
                const platformMap = {
                    1: 'Facebook',
                    2: 'Google',
                    3: 'Meta',
                    5: 'TikTok'
                }
                return (
                    platformMap[platform as keyof typeof platformMap] ||
                    platform
                )
            }
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                const statusMap = {
                    1: '审核中',
                    2: '生效中',
                    3: '封户',
                    4: '失效'
                }
                return statusMap[status as keyof typeof statusMap] || status
            }
        },
        {
            title: '币种',
            dataIndex: 'currency',
            key: 'currency'
        },
        {
            title: '余额',
            dataIndex: 'balance',
            key: 'balance'
        },
        {
            title: '剩余赠金',
            dataIndex: 'grantBalance',
            key: 'grantBalance'
        },
        {
            title: '消耗',
            dataIndex: 'consumeAmount',
            key: 'consumeAmount'
        },
        {
            title: '转化量',
            dataIndex: 'conversionAmount',
            key: 'conversionAmount'
        },
        {
            title: '转化率',
            dataIndex: 'conversionRate',
            key: 'conversionRate'
        },

        {
            title: '操作',
            key: 'action',
            width: 100,
            render: (_, record) => (
                <Space size="small">
                    <Button type="link" size="small">
                        账户充值
                    </Button>
                    <Button type="link" size="small">
                        减款转账
                    </Button>
                    <Button type="link" size="small">
                        绑定/解绑
                    </Button>
                </Space>
            )
        }
    ]

    // 处理查询
    const handleSearch = async (values: MediaAccountsearch) => {
        setLoading(true)
        try {
            const response = await queryMediaAccounts(values)
            console.log(response)
            if (response.success && response.data) {
                const formattedData = response.data.mediaAccounts || []
                setData(formattedData)
                setTotal(response.data?.total || 0) // 注意：这里应该用 total 而不是 pageSize
            } else {
                message.error(response.message || '查询失败')
            }
        } catch (error) {
            message.error('查询出错')
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    // 处理重置
    const handleReset = () => {
        form.resetFields()
        setData([])
    }

    useEffect(() => {
        handleSearch(form.getFieldsValue())
    }, [])
    return (
        <StyleProvider layer>
            <ConfigProvider>
                {/* <Breadcrumb
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
                /> */}
                <Title level={3} className="m-0 mb-4">
                    账户管理
                </Title>
                <Card>
                    <Form<MediaAccountsearch>
                        form={form}
                        onFinish={handleSearch}
                        layout="horizontal"
                    >
                        <Flex gap={16} wrap>
                            <Form.Item
                                label="账户名称"
                                name="mediaAccountName"
                                style={{ marginBottom: 0 }}
                            >
                                <Input placeholder="请输入账户名称" />
                            </Form.Item>
                            <Form.Item
                                label="账户ID"
                                name="mediaAccountId"
                                style={{ marginBottom: 0 }}
                            >
                                <Input placeholder="请输入账户ID" />
                            </Form.Item>
                            <Form.Item
                                label="公司主体"
                                name="companyName"
                                style={{ marginBottom: 0 }}
                            >
                                <Input placeholder="请输入公司主体" />
                            </Form.Item>
                            <Form.Item
                                label="媒体平台"
                                name="mediaPlatform"
                                style={{ marginBottom: 0 }}
                            >
                                <Select placeholder="请选择媒体平台">
                                    <Select.Option value={1}>
                                        Facebook
                                    </Select.Option>
                                    <Select.Option value={2}>
                                        Google
                                    </Select.Option>
                                    <Select.Option value={3}>
                                        Meta
                                    </Select.Option>
                                    <Select.Option value={4}>
                                        TikTok
                                    </Select.Option>
                                </Select>
                            </Form.Item>
                            <Form.Item
                                label="状态"
                                name="status"
                                style={{ marginBottom: 0 }}
                            >
                                <Select placeholder="请选择状态">
                                    <Select.Option value={1}>
                                        审核中
                                    </Select.Option>
                                    <Select.Option value={2}>
                                        生效中
                                    </Select.Option>
                                    <Select.Option value={3}>
                                        封户
                                    </Select.Option>
                                    <Select.Option value={4}>
                                        失效
                                    </Select.Option>
                                </Select>
                            </Form.Item>
                            <Form.Item style={{ marginBottom: 0 }}>
                                <Space>
                                    <Button onClick={handleReset}>重置</Button>
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        loading={loading}
                                    >
                                        搜索
                                    </Button>
                                </Space>
                            </Form.Item>
                        </Flex>
                    </Form>
                </Card>

                {/* 操作按钮区 */}
                <div className="my-4 flex justify-between">
                    <Space>
                        <Button type="primary">批量充值</Button>
                        <Button>批量清零</Button>
                        <Button>批量绑定/解绑</Button>
                        <Button>批量刷新</Button>
                    </Space>
                    <Space>
                        <Button type="link">申请记录</Button>
                        <Button type="link">导出</Button>
                    </Space>
                </div>

                {/* 数据表格 */}
                <Table
                    loading={loading}
                    columns={columns}
                    dataSource={data}
                    rowSelection={{
                        type: 'checkbox',
                        onChange: (_, selectedRows) =>
                            setSelectedRows(selectedRows)
                    }}
                    rowKey="mediaAccountId"
                    pagination={{
                        onChange: (page, pageSize) => {
                            const values = form.getFieldsValue()
                            handleSearch({
                                ...values,
                                pageNumber: page,
                                pageSize
                            })
                        }
                    }}
                />
            </ConfigProvider>
        </StyleProvider>
    )
}
