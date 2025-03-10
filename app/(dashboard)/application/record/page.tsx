'use client'
import { useState, useEffect } from 'react'
import {
    Row,
    Col,
    Card,
    Space,
    Table,
    Tag,
    Form,
    DatePicker,
    Select,
    Input,
    Button,
    Typography,
    type TableProps,
    message
} from 'antd'
import { ConfigProvider } from 'antd'
import { StyleProvider } from '@ant-design/cssinjs'
import { QueryApplyRecordDto } from '@/schemas'
import { getApplyRecord } from '@/app/actions/business'
import type {
    ApplyRecordData,
    ApplicationRecord,
    GoogleAccount
} from '@/schemas'
import { useRouter } from 'next/navigation'
// import Title from 'antd/es/typography/Title'
const { RangePicker } = DatePicker
const { Title } = Typography
const { Item } = Form

const initialValues: QueryApplyRecordDto = {
    page: 1,
    pageSize: 10
}

const platformMap: Record<number, string> = {
    1: 'Facebook',
    2: 'Google',
    5: 'TikTok'
}

const statusMap: Record<number, { color: string; text: string }> = {
    10: { color: 'processing', text: '审核中' },
    20: { color: 'success', text: '已通过' },
    30: { color: 'warning', text: '待修改' },
    40: { color: 'error', text: '已驳回' }
}

export default function Page() {
    const [form] = Form.useForm<QueryApplyRecordDto>()
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<ApplyRecordData>()
    const [pagination, setPagination] = useState({
        page: 1,
        pageSize: 10
    })
    const router = useRouter()

    useEffect(() => {
        onFinish(initialValues)
    }, [])

    const onFinish = async (values: QueryApplyRecordDto) => {
        console.log('values', values)
        try {
            setLoading(true)
            const params = {
                ...values,
                page: pagination.page,
                pageSize: pagination.pageSize
            }
            const response = await getApplyRecord(params)
            if (response.success) {
                console.log('response', response)
                setData(response?.data)
            } else {
                message.error(response.message || '查询失败')
            }
        } catch (error) {
            message.error('查询失败')
        } finally {
            setLoading(false)
        }
    }

    const handlePageChange = (page: number, pageSize: number) => {
        setPagination({ page, pageSize })
        form.validateFields().then((values) => {
            onFinish({
                ...values,
                page,
                pageSize
            })
        })
    }

    return (
        <StyleProvider layer>
            <ConfigProvider>
                <Title level={3} className="m-0 mb-4">
                    开户记录
                </Title>
                <Space direction="vertical" size={24} style={{ width: '100%' }}>
                    <Card>
                        <Form
                            layout="inline"
                            form={form}
                            initialValues={initialValues}
                            onFinish={onFinish}
                            labelCol={{ span: 4 }}
                        >
                            <Row gutter={16}>
                                <Col span={6}>
                                    <Item
                                        label="媒体平台"
                                        name="mediaPlatforms"
                                        style={{
                                            marginRight: 16,
                                            marginBottom: 16
                                        }}
                                    >
                                        <Select
                                            style={{ width: '100%' }}
                                            placeholder="请选择媒体平台"
                                            options={[
                                                { label: 'Meta', value: 1 },
                                                { label: 'Google', value: 2 },
                                                { label: 'TikTok', value: 5 }
                                            ]}
                                        />
                                    </Item>
                                </Col>
                                <Col span={6}>
                                    <Item
                                        label="开户状态"
                                        name="statuses"
                                        style={{
                                            marginRight: 16,
                                            marginBottom: 16
                                        }}
                                    >
                                        <Select
                                            style={{ width: '100%' }}
                                            placeholder="请选择开户状态"
                                            options={[
                                                {
                                                    label: '审核中',
                                                    value: 10
                                                },
                                                {
                                                    label: '已通过',
                                                    value: 20
                                                },
                                                {
                                                    label: '待修改',
                                                    value: 30
                                                },
                                                { label: '已驳回', value: 40 }
                                            ]}
                                        />
                                    </Item>
                                </Col>
                                <Col span={6}>
                                    <Item
                                        label="开户主体"
                                        name={['company', 'name']}
                                        style={{
                                            marginRight: 16,
                                            marginBottom: 16
                                        }}
                                    >
                                        <Input />
                                    </Item>
                                </Col>
                                <Col span={6}>
                                    <Item
                                        label="营业执照号"
                                        name={['company', 'businessLicenseNo']}
                                        style={{
                                            marginRight: 16,
                                            marginBottom: 16
                                        }}
                                    >
                                        <Input />
                                    </Item>
                                </Col>
                                <Col span={6}>
                                    <Item
                                        label="申请ID"
                                        name="taskIds"
                                        style={{
                                            marginRight: 16,
                                            marginBottom: 16
                                        }}
                                    >
                                        <Input />
                                    </Item>
                                </Col>
                                <Col span={6}>
                                    <Item
                                        label="OE ID"
                                        name="oeIds"
                                        style={{
                                            marginRight: 16,
                                            marginBottom: 16
                                        }}
                                    >
                                        <Input />
                                    </Item>
                                </Col>
                                <Col span={6}>
                                    <Item
                                        label="推广链接"
                                        name="promotionLinks"
                                        style={{
                                            marginRight: 16,
                                            marginBottom: 16
                                        }}
                                    >
                                        <Select
                                            style={{ width: '100%' }}
                                            placeholder="推广链接"
                                            options={[
                                                {
                                                    label: 'https://wwww.baidu.com',
                                                    value: 'https://wwww.baidu.com'
                                                }
                                            ]}
                                        />
                                    </Item>
                                </Col>
                                <Col span={6} className="flex gap-1">
                                    <Item>
                                        <Button
                                            type="default"
                                            onClick={() => form.resetFields()}
                                        >
                                            重置
                                        </Button>
                                    </Item>
                                    <Item>
                                        <Button
                                            type="primary"
                                            htmlType="submit"
                                        >
                                            搜索
                                        </Button>
                                    </Item>
                                </Col>
                            </Row>
                        </Form>
                    </Card>
                    <Card>
                        <Table
                            loading={loading}
                            columns={[
                                {
                                    title: '工单ID',
                                    dataIndex: 'taskId',
                                    key: 'taskId',
                                    width: 160
                                },
                                // {
                                //     title: '外部工单ID',
                                //     dataIndex: 'taskNumber',
                                //     key: 'taskNumber'
                                // },
                                {
                                    title: '开户主体',
                                    dataIndex: ['company', 'name'],
                                    key: 'companyName'
                                },
                                // {
                                //     title: '营业执照号',
                                //     dataIndex: ['company', 'businessLicenseNo'],
                                //     key: 'businessLicenseNo'
                                // },
                                {
                                    title: 'OE ID',
                                    dataIndex: 'oeId',
                                    key: 'oeId',
                                    width: 100
                                },
                                {
                                    title: '媒体平台',
                                    dataIndex: 'mediaPlatform',
                                    key: 'mediaPlatform',
                                    render: (platform: number) => {
                                        return platformMap[platform] || platform
                                    },
                                    width: 120
                                },
                                {
                                    title: '开户状态',
                                    dataIndex: 'status',
                                    key: 'status',
                                    render: (status: number) => {
                                        const statusInfo = statusMap[
                                            status
                                        ] || {
                                            color: 'default',
                                            text: status
                                        }
                                        return (
                                            <Tag color={statusInfo.color}>
                                                {statusInfo.text}
                                            </Tag>
                                        )
                                    },
                                    width: 120
                                },
                                {
                                    title: '推广链接',
                                    dataIndex: 'mediaAccountInfos',
                                    key: 'mediaAccountInfos',
                                    render: (
                                        mediaAccountInfos: GoogleAccount[]
                                    ) => {
                                        return mediaAccountInfos[0].promotionLinks
                                            .map((link) => link)
                                            .join(',')
                                    }
                                },
                                {
                                    title: '反馈信息',
                                    dataIndex: 'feedback',
                                    key: 'feedback',
                                    ellipsis: true,
                                    width: 200
                                },
                                {
                                    title: '申请时间',
                                    dataIndex: 'createdTimestamp',
                                    key: 'createdTimestamp',
                                    width: 160,
                                    render: (timestamp: number | undefined) => {
                                        if (!timestamp) {
                                            return '-'
                                        }

                                        const isSecondTimestamp =
                                            timestamp < 10000000000
                                        const milliseconds = isSecondTimestamp
                                            ? timestamp * 1000
                                            : timestamp

                                        return new Date(
                                            milliseconds
                                        ).toLocaleString('zh-CN', {
                                            hour12: false
                                        })
                                    }
                                },
                                // {
                                //     title: '更新时间',
                                //     dataIndex: 'updatedAt',
                                //     key: 'updatedAt',
                                //     render: (timestamp: number) => {
                                //         return new Date(
                                //             timestamp * 1000
                                //         ).toLocaleString()
                                //     }
                                // },
                                {
                                    title: '操作',
                                    key: 'action',
                                    width: 220,
                                    render: (_, record) => (
                                        <Space>
                                            <Button type="link">查看</Button>
                                            {record.status !== 20 && (
                                                <Button
                                                    type="link"
                                                    onClick={() => {
                                                        const platform =
                                                            record.mediaPlatform
                                                        const path =
                                                            platform === 2
                                                                ? '/application/apply/google'
                                                                : platform === 5
                                                                  ? '/application/apply/tiktok'
                                                                  : '/application/apply/facebook'
                                                        router.push(
                                                            `${path}?taskId=${record.taskId}`
                                                        )
                                                    }}
                                                >
                                                    修改
                                                </Button>
                                            )}
                                            <Button type="link">复制</Button>
                                        </Space>
                                    )
                                }
                            ]}
                            dataSource={data?.mediaAccountApplications}
                            rowKey="taskId"
                            pagination={{
                                total: data?.total,
                                current: data?.pageNumber,
                                pageSize: data?.pageSize,
                                showSizeChanger: true,
                                showQuickJumper: true,
                                showTotal: (total) => `共 ${total} 条记录`,
                                onChange: handlePageChange
                            }}
                        />
                    </Card>
                </Space>
            </ConfigProvider>
        </StyleProvider>
    )
}
