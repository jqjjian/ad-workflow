'use client'

import { useState, useEffect } from 'react'
import {
    Card,
    Table,
    Form,
    Select,
    DatePicker,
    Input,
    Button,
    Space,
    Typography,
    Spin,
    Tag,
    message
} from 'antd'
import { SearchOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons'
import { useRouter } from 'next/navigation'
import { getWorkOrders } from '@/app/actions/workorder/common'

const { Title } = Typography
const { RangePicker } = DatePicker
const { Option } = Select

export default function WorkOrderPage() {
    const router = useRouter()
    const [workOrders, setWorkOrders] = useState([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [form] = Form.useForm()
    const [filters, setFilters] = useState({
        page: 1,
        pageSize: 10,
        workOrderType: undefined,
        workOrderSubtype: undefined,
        status: undefined,
        dateRange: undefined,
        taskNumber: undefined,
        taskId: undefined
    })

    useEffect(() => {
        loadWorkOrders()
    }, [filters])

    async function loadWorkOrders() {
        setLoading(true)
        try {
            // 使用真实的用户ID
            const userId = 'current-user-id'
            const response = await getWorkOrders({
                ...filters,
                userId,
                dateRange: filters.dateRange
                    ? {
                          start: filters.dateRange[0],
                          end: filters.dateRange[1]
                      }
                    : undefined
            })

            if (response.success && response.data) {
                setWorkOrders(response.data.items)
                setTotal(response.data.total)
            } else {
                message.error(response.message || '加载工单列表失败')
            }
        } catch (error) {
            console.error('加载工单列表失败', error)
            message.error('加载工单列表失败')
        } finally {
            setLoading(false)
        }
    }

    const handleSearch = (values) => {
        setFilters({
            ...filters,
            ...values,
            page: 1
        })
    }

    const handleReset = () => {
        form.resetFields()
        setFilters({
            page: 1,
            pageSize: 10,
            workOrderType: undefined,
            workOrderSubtype: undefined,
            status: undefined,
            dateRange: undefined,
            taskNumber: undefined,
            taskId: undefined
        })
    }

    const handleTableChange = (pagination) => {
        setFilters({
            ...filters,
            page: pagination.current,
            pageSize: pagination.pageSize
        })
    }

    // 渲染工单状态标签
    const renderStatusTag = (status) => {
        let color = ''
        let text = status

        switch (status) {
            case 'SUCCESS':
                color = 'success'
                text = '成功'
                break
            case 'FAILED':
                color = 'error'
                text = '失败'
                break
            case 'PENDING':
                color = 'warning'
                text = '处理中'
                break
            case 'INIT':
                color = 'processing'
                text = '初始化'
                break
            case 'CANCELLED':
                color = 'default'
                text = '已取消'
                break
            default:
                color = 'default'
        }

        return <Tag color={color}>{text}</Tag>
    }

    const columns = [
        {
            title: '工单编号',
            dataIndex: 'taskNumber',
            key: 'taskNumber'
        },
        {
            title: '第三方任务ID',
            dataIndex: 'taskId',
            key: 'taskId'
        },
        {
            title: '工单类型',
            dataIndex: 'workOrderType',
            key: 'workOrderType',
            render: (type) => {
                if (type === 'ACCOUNT_APPLICATION') return '开户申请'
                if (type === 'ACCOUNT_MANAGEMENT') return '账户管理'
                if (type === 'ATTACHMENT_MANAGEMENT') return '附件管理'
                if (type === 'PAYMENT') return '支付账单'
                return type
            }
        },
        {
            title: '子类型',
            dataIndex: 'workOrderSubtype',
            key: 'workOrderSubtype',
            render: (subtype) => {
                // 这里可以添加更多的子类型映射
                const subtypeMap = {
                    GOOGLE_ACCOUNT: 'Google开户',
                    TIKTOK_ACCOUNT: 'TikTok开户',
                    FACEBOOK_ACCOUNT: 'Facebook开户',
                    DEPOSIT: '充值',
                    WITHDRAWAL: '减款',
                    TRANSFER: '转账',
                    ZEROING: '清零',
                    BIND_ACCOUNT: '绑定账号',
                    UNBIND_ACCOUNT: '解绑账号',
                    BIND_PIXEL: '绑定Pixel',
                    UNBIND_PIXEL: '解绑Pixel',
                    BIND_EMAIL: '绑定邮箱',
                    UNBIND_EMAIL: '解绑邮箱',
                    GENERAL_MANAGEMENT: '综合管理',
                    DOCUMENT_UPLOAD: '文档上传',
                    IMAGE_UPLOAD: '图片上传',
                    OTHER_ATTACHMENT: '其他附件',
                    PAYMENT_PROCESSING: '支付处理中',
                    PAYMENT_COMPLETED: '支付完成',
                    PAYMENT_FAILED: '支付失败'
                }

                return subtypeMap[subtype] || subtype
            }
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: renderStatusTag
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date) => new Date(date).toLocaleString()
        },
        {
            title: '更新时间',
            dataIndex: 'updatedAt',
            key: 'updatedAt',
            render: (date) => new Date(date).toLocaleString()
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record) => (
                <Button
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={() => router.push(`/workorder/${record.taskId}`)}
                >
                    查看
                </Button>
            )
        }
    ]

    return (
        <div>
            <Title level={2}>工单管理</Title>

            {/* 筛选表单 */}
            <Card style={{ marginBottom: 16 }}>
                <Form
                    form={form}
                    layout="inline"
                    onFinish={handleSearch}
                    style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}
                >
                    <Form.Item name="taskNumber" label="工单编号">
                        <Input
                            placeholder="请输入工单编号"
                            style={{ width: 200 }}
                        />
                    </Form.Item>

                    <Form.Item name="taskId" label="第三方任务ID">
                        <Input
                            placeholder="请输入第三方任务ID"
                            style={{ width: 200 }}
                        />
                    </Form.Item>

                    <Form.Item name="workOrderType" label="工单类型">
                        <Select
                            style={{ width: 140 }}
                            placeholder="选择类型"
                            allowClear
                        >
                            <Option value="ACCOUNT_APPLICATION">
                                开户申请
                            </Option>
                            <Option value="ACCOUNT_MANAGEMENT">账户管理</Option>
                            <Option value="ATTACHMENT_MANAGEMENT">
                                附件管理
                            </Option>
                            <Option value="PAYMENT">支付账单</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item name="status" label="状态">
                        <Select
                            style={{ width: 140 }}
                            placeholder="选择状态"
                            allowClear
                        >
                            <Option value="SUCCESS">成功</Option>
                            <Option value="FAILED">失败</Option>
                            <Option value="PENDING">处理中</Option>
                            <Option value="INIT">初始化</Option>
                            <Option value="CANCELLED">已取消</Option>
                        </Select>
                    </Form.Item>

                    <Form.Item name="dateRange" label="日期范围">
                        <RangePicker />
                    </Form.Item>

                    <Form.Item style={{ marginLeft: 'auto' }}>
                        <Space>
                            <Button
                                type="primary"
                                htmlType="submit"
                                icon={<SearchOutlined />}
                            >
                                搜索
                            </Button>
                            <Button
                                icon={<ReloadOutlined />}
                                onClick={handleReset}
                            >
                                重置
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Card>

            {/* 工单列表 */}
            <Card>
                <Spin spinning={loading}>
                    <Table
                        columns={columns}
                        dataSource={workOrders}
                        rowKey="id"
                        pagination={{
                            current: filters.page,
                            pageSize: filters.pageSize,
                            total: total,
                            showSizeChanger: true,
                            showTotal: (total) => `共 ${total} 条记录`
                        }}
                        onChange={handleTableChange}
                    />
                </Spin>
            </Card>
        </div>
    )
}
