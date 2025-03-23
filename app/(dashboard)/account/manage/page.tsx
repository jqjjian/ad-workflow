'use client'

import { useState, useEffect } from 'react'
import { message, Badge } from 'antd'
import {
    Select,
    Input,
    DatePicker,
    Button,
    Table,
    Space,
    Form,
    Card,
    Flex,
    Tag
} from 'antd'
import type { TableColumnsType } from 'antd'
import { StyleProvider } from '@ant-design/cssinjs'
import { ConfigProvider } from 'antd'
import { Typography } from 'antd'
import { queryMediaAccounts } from '@/app/actions/workorder'
import {
    MediaAccount,
    MediaAccountResponse,
    MediaAccountSearch
} from '@/schemas/mediaAccount'

const { Title } = Typography
const { RangePicker } = DatePicker

// 自定义表单类型，包含前端特有的日期范围字段
type AccountSearchForm = {
    mediaAccountId?: string
    mediaAccountName?: string
    mediaPlatform?: number
    companyName?: string
    status?: number
    createTimeRange?: any[]
    pageNumber?: number
    pageSize?: number
}

export default function AccountManagePage() {
    const [form] = Form.useForm<AccountSearchForm>()
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
                    <span style={{ fontWeight: 'bold' }}>
                        {record.mediaAccountName}
                    </span>
                    <span style={{ color: '#666' }}>
                        {record.mediaAccountId}
                    </span>
                </Space>
            ),
            sorter: (a, b) =>
                a.mediaAccountName.localeCompare(b.mediaAccountName)
        },
        {
            title: '公司主体',
            dataIndex: 'companyName',
            key: 'companyName',
            sorter: (a, b) => a.companyName.localeCompare(b.companyName)
        },
        {
            title: '媒体平台',
            dataIndex: 'mediaPlatform',
            key: 'mediaPlatform',
            render: (platform) => {
                const platformMap = {
                    1: { name: 'Facebook', color: '#1877F2' },
                    2: { name: 'Google', color: '#4285F4' },
                    3: { name: 'Meta', color: '#0081FB' },
                    5: { name: 'TikTok', color: '#000000' }
                }
                const platformInfo =
                    platformMap[platform as keyof typeof platformMap]
                return platformInfo ? (
                    <Tag color={platformInfo.color}>{platformInfo.name}</Tag>
                ) : (
                    platform
                )
            },
            filters: [
                { text: 'Facebook', value: 1 },
                { text: 'Google', value: 2 },
                { text: 'Meta', value: 3 },
                { text: 'TikTok', value: 5 }
            ],
            onFilter: (value, record) => record.mediaPlatform === value
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status) => {
                const statusMap = {
                    1: { text: '审核中', color: 'processing' },
                    2: { text: '生效中', color: 'success' },
                    3: { text: '封户', color: 'error' },
                    4: { text: '失效', color: 'default' }
                }
                const statusInfo = statusMap[status as keyof typeof statusMap]
                return statusInfo ? (
                    <Badge
                        status={statusInfo.color as any}
                        text={statusInfo.text}
                    />
                ) : (
                    status
                )
            },
            filters: [
                { text: '审核中', value: 1 },
                { text: '生效中', value: 2 },
                { text: '封户', value: 3 },
                { text: '失效', value: 4 }
            ],
            onFilter: (value, record) => record.status === value
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
        }
    ]

    // 处理查询
    const handleSearch = async (values: AccountSearchForm) => {
        setLoading(true)
        try {
            // 处理查询参数
            const queryParams: MediaAccountSearch = {
                mediaAccountId: values.mediaAccountId,
                mediaAccountName: values.mediaAccountName,
                mediaPlatform: values.mediaPlatform,
                companyName: values.companyName,
                status: values.status || 2, // 默认查询"生效中"的记录
                pageNumber: values.pageNumber || 1,
                pageSize: values.pageSize || 10,
                createTimeRange: values.createTimeRange
            }

            // 处理日期范围
            if (values.createTimeRange?.length === 2) {
                queryParams.startTime =
                    values.createTimeRange[0]?.format('YYYY-MM-DD')
                queryParams.endTime =
                    values.createTimeRange[1]?.format('YYYY-MM-DD')
            }

            const response = await queryMediaAccounts(queryParams)

            if (response.success && response.data) {
                // 确保 data 是 MediaAccountSearchResult 类型
                if ('mediaAccounts' in response.data) {
                    const formattedData = response.data.mediaAccounts || []

                    // 对数据进行格式化处理
                    const processedData = formattedData.map(
                        (account: MediaAccount) => ({
                            ...account,
                            // 确保数值字段为数字类型
                            balance: parseFloat(
                                account.balance?.toString() || '0'
                            ),
                            grantBalance: parseFloat(
                                account.grantBalance?.toString() || '0'
                            ),
                            consumeAmount: parseFloat(
                                account.consumeAmount?.toString() || '0'
                            ),
                            conversionAmount: parseFloat(
                                account.conversionAmount?.toString() || '0'
                            ),
                            conversionRate: account.conversionRate
                                ? parseFloat(account.conversionRate.toString())
                                : 0
                        })
                    )

                    setData(processedData)
                    setTotal('total' in response.data ? response.data.total : 0)
                } else {
                    setData([])
                    setTotal(0)
                }
            } else {
                message.error(response.message || '查询失败')
                setData([])
                setTotal(0)
            }
        } catch (error) {
            console.error('查询出错:', error)
            message.error('查询出错，请稍后重试')
            setData([])
            setTotal(0)
        } finally {
            setLoading(false)
        }
    }

    // 添加筛选条件变更时自动查询
    const handleFilterChange = (
        changedValues: any,
        allValues: AccountSearchForm
    ) => {
        // 当筛选条件变更时，重置到第一页
        handleSearch({
            ...allValues,
            pageNumber: 1,
            pageSize: 10
        })
    }

    // 处理重置
    const handleReset = () => {
        form.resetFields()
        // 重置后，默认查询生效中的记录
        handleSearch({ status: 2, pageNumber: 1, pageSize: 10 })
    }

    useEffect(() => {
        // 初始加载时，默认查询生效中的账户
        handleSearch({ status: 2, pageNumber: 1, pageSize: 10 })
    }, [])

    return (
        <StyleProvider layer>
            <ConfigProvider>
                <Title level={3} className="m-0 mb-4">
                    账户管理
                </Title>
                <Card>
                    <Form<AccountSearchForm>
                        form={form}
                        onFinish={handleSearch}
                        onValuesChange={handleFilterChange}
                        layout="horizontal"
                    >
                        <Flex gap={16} wrap>
                            <Form.Item
                                label="账户名称"
                                name="mediaAccountName"
                                style={{ marginBottom: 0 }}
                            >
                                <Input
                                    placeholder="请输入账户名称"
                                    allowClear
                                />
                            </Form.Item>
                            <Form.Item
                                label="账户ID"
                                name="mediaAccountId"
                                style={{ marginBottom: 0 }}
                            >
                                <Input placeholder="请输入账户ID" allowClear />
                            </Form.Item>
                            <Form.Item
                                label="公司主体"
                                name="companyName"
                                style={{ marginBottom: 0 }}
                            >
                                <Input
                                    placeholder="请输入公司主体"
                                    allowClear
                                />
                            </Form.Item>
                            <Form.Item
                                label="媒体平台"
                                name="mediaPlatform"
                                style={{ marginBottom: 0 }}
                            >
                                <Select placeholder="请选择媒体平台" allowClear>
                                    <Select.Option value={1}>
                                        Facebook
                                    </Select.Option>
                                    <Select.Option value={2}>
                                        Google
                                    </Select.Option>
                                    <Select.Option value={3}>
                                        Meta
                                    </Select.Option>
                                    <Select.Option value={5}>
                                        TikTok
                                    </Select.Option>
                                </Select>
                            </Form.Item>
                            <Form.Item
                                label="状态"
                                name="status"
                                style={{ marginBottom: 0 }}
                                initialValue={2} // 默认选择"生效中"
                            >
                                <Select placeholder="请选择状态" allowClear>
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
                            <Form.Item
                                label="创建时间"
                                name="createTimeRange"
                                style={{ marginBottom: 0 }}
                            >
                                <RangePicker allowClear />
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

                {/* 数据表格 */}
                <Table
                    loading={loading}
                    columns={columns}
                    dataSource={data}
                    rowSelection={{
                        type: 'checkbox',
                        onChange: (_, selectedRows) =>
                            setSelectedRows(selectedRows),
                        getCheckboxProps: (record) => ({
                            // 禁用非生效中状态的行选择
                            disabled: record.status !== 2
                        })
                    }}
                    rowKey="mediaAccountId"
                    pagination={{
                        total: total,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total) => `共 ${total} 条记录`,
                        pageSize: 10,
                        pageSizeOptions: ['10', '20', '50', '100'],
                        onChange: (page, pageSize) => {
                            const values = form.getFieldsValue()
                            handleSearch({
                                ...values,
                                pageNumber: page,
                                pageSize
                            })
                        }
                    }}
                    rowClassName={(record) => {
                        if (record.status === 3) return 'bg-red-50' // 封户状态标红
                        if (record.status === 4) return 'bg-gray-50' // 失效状态标灰
                        return ''
                    }}
                    summary={(pageData) => {
                        if (pageData.length === 0) return null

                        const totalBalance = pageData.reduce(
                            (sum, item) => sum + (Number(item.balance) || 0),
                            0
                        )

                        const totalConsume = pageData.reduce(
                            (sum, item) =>
                                sum + (Number(item.consumeAmount) || 0),
                            0
                        )

                        return (
                            <Table.Summary fixed>
                                <Table.Summary.Row>
                                    <Table.Summary.Cell index={0} colSpan={5}>
                                        <strong>账户总余额</strong>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={1}>
                                        <strong>
                                            {totalBalance.toFixed(2)}
                                        </strong>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={2}>
                                        <strong>总消耗</strong>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell index={3}>
                                        <strong>
                                            {totalConsume.toFixed(2)}
                                        </strong>
                                    </Table.Summary.Cell>
                                    <Table.Summary.Cell
                                        index={4}
                                        colSpan={3}
                                    ></Table.Summary.Cell>
                                </Table.Summary.Row>
                            </Table.Summary>
                        )
                    }}
                />
            </ConfigProvider>
        </StyleProvider>
    )
}
