'use client'

import { useState, useEffect } from 'react'
import {
    Card,
    Table,
    Button,
    Form,
    Select,
    Input,
    DatePicker,
    Space,
    Tag,
    message,
    Modal,
    Typography,
    Flex,
    Descriptions,
    Timeline,
    Divider
} from 'antd'
import { StyleProvider } from '@ant-design/cssinjs'
import { ConfigProvider } from 'antd'
import {
    queryWorkOrderList,
    getWorkOrderDetail
} from '@/app/actions/workorder/common'
import {
    WorkOrderType,
    WorkOrderStatus,
    WorkOrderQuery
} from '@/schemas/workorder/query'

const { Title } = Typography
const { RangePicker } = DatePicker

interface WorkOrderRecord {
    id: string
    workOrderId: string
    workOrderType: WorkOrderType
    mediaPlatform: number
    mediaAccountId: string
    mediaAccountName: string
    companyName: string
    createdAt: string
    systemStatus: WorkOrderStatus
    thirdPartyStatus: WorkOrderStatus | null
    amount?: number
    operator?: string
    updatedAt?: string
}

interface WorkOrderDetail extends WorkOrderRecord {
    remarks?: string
    workOrderLogs: Array<{
        id: string
        timestamp: string
        action: string
        operator: string
        details: string
    }>
    workOrderParams: Record<string, any>
}

export default function WorkOrderRecordsPage() {
    const [form] = Form.useForm<WorkOrderQuery>()
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<WorkOrderRecord[]>([])
    const [total, setTotal] = useState(0)
    const [detailModalVisible, setDetailModalVisible] = useState(false)
    const [currentWorkOrder, setCurrentWorkOrder] =
        useState<WorkOrderDetail | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)

    // 工单类型映射
    const workOrderTypeMap: Record<WorkOrderType, string> = {
        DEPOSIT: '账户充值',
        WITHDRAWAL: '账户减款',
        ZEROING: '账户清零',
        TRANSFER: '账户转账',
        ACCOUNT_BINDING: 'MCC绑定/解绑',
        EMAIL_BINDING: '邮箱绑定/解绑',
        PIXEL_BINDING: 'Pixel绑定/解绑',
        ACCOUNT_NAME_UPDATE: '账户名修改',
        ACCOUNT_APPLICATION: '账户申请',
        ACCOUNT_MANAGEMENT: '账户管理',
        ACCOUNT_UNBINDING: '账户解绑'
    }

    // 工单状态映射
    const workOrderStatusMap: Record<
        WorkOrderStatus,
        { text: string; color: string }
    > = {
        PENDING: { text: '待处理', color: 'orange' },
        PROCESSING: { text: '处理中', color: 'blue' },
        COMPLETED: { text: '已完成', color: 'green' },
        REJECTED: { text: '已拒绝', color: 'red' },
        CANCELED: { text: '已取消', color: 'default' },
        FAILED: { text: '处理失败', color: 'red' }
    }

    // 媒体平台映射
    const platformMap: Record<number, string> = {
        1: 'Facebook',
        2: 'Google',
        3: 'Meta',
        5: 'TikTok'
    }

    const columns = [
        {
            title: '工单ID',
            dataIndex: 'workOrderId',
            key: 'workOrderId'
        },
        {
            title: '工单类型',
            dataIndex: 'workOrderType',
            key: 'workOrderType',
            render: (type: WorkOrderType) => workOrderTypeMap[type] || type
        },
        {
            title: '媒体平台',
            dataIndex: 'mediaPlatform',
            key: 'mediaPlatform',
            render: (platform: number) => platformMap[platform] || platform
        },
        {
            title: '账户ID/名称',
            key: 'account',
            render: (_, record: WorkOrderRecord) => (
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
            title: '系统状态',
            dataIndex: 'systemStatus',
            key: 'systemStatus',
            render: (status: WorkOrderStatus) => (
                <Tag color={workOrderStatusMap[status]?.color || 'default'}>
                    {workOrderStatusMap[status]?.text || status}
                </Tag>
            )
        },
        {
            title: '第三方状态',
            dataIndex: 'thirdPartyStatus',
            key: 'thirdPartyStatus',
            render: (status: WorkOrderStatus | null) =>
                status ? (
                    <Tag color={workOrderStatusMap[status]?.color || 'default'}>
                        {workOrderStatusMap[status]?.text || status}
                    </Tag>
                ) : (
                    <Tag color="default">未提交</Tag>
                )
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            key: 'createdAt'
        },
        {
            title: '操作',
            key: 'action',
            render: (_, record: WorkOrderRecord) => (
                <Space size="small">
                    <Button
                        type="link"
                        onClick={() => viewWorkOrderDetail(record.id)}
                    >
                        查看详情
                    </Button>
                    {record.systemStatus === 'PENDING' && (
                        <Button
                            type="link"
                            onClick={() => editWorkOrder(record.id)}
                        >
                            编辑
                        </Button>
                    )}
                    {record.systemStatus === 'PENDING' && (
                        <Button
                            type="link"
                            danger
                            onClick={() => cancelWorkOrder(record.id)}
                        >
                            取消
                        </Button>
                    )}
                </Space>
            )
        }
    ]

    // 查询工单列表
    const handleSearch = async (values: WorkOrderQuery) => {
        setLoading(true)
        try {
            const response = await queryWorkOrderList(values)
            if (response.success && response.data) {
                setData(response.data.records || [])
                setTotal(response.data.total || 0)
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

    // 查看工单详情
    const viewWorkOrderDetail = async (workOrderId: string) => {
        setDetailLoading(true)
        try {
            const response = await getWorkOrderDetail(workOrderId)
            if (response.success && response.data) {
                setCurrentWorkOrder(response.data)
                setDetailModalVisible(true)
            } else {
                message.error(response.message || '获取工单详情失败')
            }
        } catch (error) {
            message.error('查询出错')
            console.error(error)
        } finally {
            setDetailLoading(false)
        }
    }

    // 编辑工单
    const editWorkOrder = (workOrderId: string) => {
        // 实现编辑工单的逻辑，可以跳转到编辑页面
        message.info('编辑工单功能开发中')
    }

    // 取消工单
    const cancelWorkOrder = (workOrderId: string) => {
        Modal.confirm({
            title: '确认取消工单',
            content: '取消后工单将无法恢复，确认要取消吗？',
            onOk: async () => {
                message.info('取消工单功能开发中')
                // 实现取消工单的逻辑
            }
        })
    }

    // 重置表单
    const handleReset = () => {
        form.resetFields()
        setData([])
    }

    // 渲染工单详情
    const renderWorkOrderDetail = () => {
        if (!currentWorkOrder) return null

        return (
            <div>
                <Descriptions title="工单基本信息" bordered column={2}>
                    <Descriptions.Item label="工单ID">
                        {currentWorkOrder.workOrderId}
                    </Descriptions.Item>
                    <Descriptions.Item label="工单类型">
                        {workOrderTypeMap[currentWorkOrder.workOrderType]}
                    </Descriptions.Item>
                    <Descriptions.Item label="媒体平台">
                        {platformMap[currentWorkOrder.mediaPlatform]}
                    </Descriptions.Item>
                    <Descriptions.Item label="账户ID">
                        {currentWorkOrder.mediaAccountId}
                    </Descriptions.Item>
                    <Descriptions.Item label="账户名称">
                        {currentWorkOrder.mediaAccountName}
                    </Descriptions.Item>
                    <Descriptions.Item label="公司主体">
                        {currentWorkOrder.companyName}
                    </Descriptions.Item>
                    <Descriptions.Item label="系统状态">
                        <Tag
                            color={
                                workOrderStatusMap[
                                    currentWorkOrder.systemStatus
                                ]?.color
                            }
                        >
                            {
                                workOrderStatusMap[
                                    currentWorkOrder.systemStatus
                                ]?.text
                            }
                        </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="第三方状态">
                        {currentWorkOrder.thirdPartyStatus ? (
                            <Tag
                                color={
                                    workOrderStatusMap[
                                        currentWorkOrder.thirdPartyStatus
                                    ]?.color
                                }
                            >
                                {
                                    workOrderStatusMap[
                                        currentWorkOrder.thirdPartyStatus
                                    ]?.text
                                }
                            </Tag>
                        ) : (
                            <Tag color="default">未提交</Tag>
                        )}
                    </Descriptions.Item>
                    <Descriptions.Item label="创建时间">
                        {currentWorkOrder.createdAt}
                    </Descriptions.Item>
                    <Descriptions.Item label="更新时间">
                        {currentWorkOrder.updatedAt || '-'}
                    </Descriptions.Item>
                    {currentWorkOrder.amount && (
                        <Descriptions.Item label="金额">
                            {currentWorkOrder.amount}
                        </Descriptions.Item>
                    )}
                    {currentWorkOrder.remarks && (
                        <Descriptions.Item label="备注" span={2}>
                            {currentWorkOrder.remarks}
                        </Descriptions.Item>
                    )}
                </Descriptions>

                {/* 根据工单类型显示不同的参数信息 */}
                <Divider />
                <Descriptions title="工单参数" bordered column={2}>
                    {currentWorkOrder.workOrderType === 'TRANSFER' && (
                        <Descriptions.Item label="目标账户ID">
                            {currentWorkOrder.workOrderParams.targetAccount}
                        </Descriptions.Item>
                    )}
                    {currentWorkOrder.workOrderType === 'EMAIL_BINDING' && (
                        <>
                            <Descriptions.Item label="邮箱地址">
                                {currentWorkOrder.workOrderParams.emailAddress}
                            </Descriptions.Item>
                            <Descriptions.Item label="操作类型">
                                {currentWorkOrder.workOrderParams
                                    .bindingType === 'bind'
                                    ? '绑定'
                                    : '解绑'}
                            </Descriptions.Item>
                        </>
                    )}
                    {currentWorkOrder.workOrderType === 'PIXEL_BINDING' && (
                        <>
                            <Descriptions.Item label="Pixel ID">
                                {currentWorkOrder.workOrderParams.pixelId}
                            </Descriptions.Item>
                            <Descriptions.Item label="操作类型">
                                {currentWorkOrder.workOrderParams
                                    .bindingType === 'bind'
                                    ? '绑定'
                                    : '解绑'}
                            </Descriptions.Item>
                        </>
                    )}
                    {currentWorkOrder.workOrderType === 'ACCOUNT_BINDING' && (
                        <>
                            <Descriptions.Item label="MCC ID">
                                {currentWorkOrder.workOrderParams.mccId}
                            </Descriptions.Item>
                            <Descriptions.Item label="操作类型">
                                {currentWorkOrder.workOrderParams
                                    .bindingType === 'bind'
                                    ? '绑定'
                                    : '解绑'}
                            </Descriptions.Item>
                        </>
                    )}
                    {currentWorkOrder.workOrderType ===
                        'ACCOUNT_NAME_UPDATE' && (
                        <>
                            <Descriptions.Item label="原账户名称">
                                {currentWorkOrder.mediaAccountName}
                            </Descriptions.Item>
                            <Descriptions.Item label="新账户名称">
                                {
                                    currentWorkOrder.workOrderParams
                                        .newAccountName
                                }
                            </Descriptions.Item>
                        </>
                    )}
                </Descriptions>

                {/* 工单处理日志时间线 */}
                <Divider />
                <div className="mb-4">
                    <h3>工单处理日志</h3>
                    <Timeline>
                        {currentWorkOrder.workOrderLogs.map((log) => (
                            <Timeline.Item key={log.id}>
                                <p>
                                    <strong>{log.action}</strong> -{' '}
                                    {log.timestamp}
                                </p>
                                <p>处理人: {log.operator}</p>
                                <p>详情: {log.details}</p>
                            </Timeline.Item>
                        ))}
                    </Timeline>
                </div>
            </div>
        )
    }

    useEffect(() => {
        // 初始加载时查询工单列表
        handleSearch(form.getFieldsValue())
    }, [])

    return (
        <StyleProvider layer>
            <ConfigProvider>
                <Title level={3} className="m-0 mb-4">
                    工单记录
                </Title>
                <Card>
                    <Form<WorkOrderQuery>
                        form={form}
                        onFinish={handleSearch}
                        layout="horizontal"
                    >
                        <Flex gap={16} wrap>
                            <Form.Item
                                label="工单类型"
                                name="workOrderType"
                                style={{ marginBottom: 0 }}
                            >
                                <Select
                                    placeholder="请选择工单类型"
                                    style={{ width: 180 }}
                                >
                                    {Object.entries(workOrderTypeMap).map(
                                        ([type, name]) => (
                                            <Select.Option
                                                key={type}
                                                value={type}
                                            >
                                                {name}
                                            </Select.Option>
                                        )
                                    )}
                                </Select>
                            </Form.Item>
                            <Form.Item
                                label="媒体平台"
                                name="mediaPlatform"
                                style={{ marginBottom: 0 }}
                            >
                                <Select
                                    placeholder="请选择媒体平台"
                                    style={{ width: 150 }}
                                >
                                    {Object.entries(platformMap).map(
                                        ([id, name]) => (
                                            <Select.Option
                                                key={id}
                                                value={Number(id)}
                                            >
                                                {name}
                                            </Select.Option>
                                        )
                                    )}
                                </Select>
                            </Form.Item>
                            <Form.Item
                                label="工单状态"
                                name="systemStatus"
                                style={{ marginBottom: 0 }}
                            >
                                <Select
                                    placeholder="请选择状态"
                                    style={{ width: 150 }}
                                >
                                    {Object.entries(workOrderStatusMap).map(
                                        ([status, { text }]) => (
                                            <Select.Option
                                                key={status}
                                                value={status}
                                            >
                                                {text}
                                            </Select.Option>
                                        )
                                    )}
                                </Select>
                            </Form.Item>
                            <Form.Item
                                label="账户ID"
                                name="mediaAccountId"
                                style={{ marginBottom: 0 }}
                            >
                                <Input
                                    placeholder="请输入账户ID"
                                    style={{ width: 180 }}
                                />
                            </Form.Item>
                            <Form.Item
                                label="账户名称"
                                name="mediaAccountName"
                                style={{ marginBottom: 0 }}
                            >
                                <Input
                                    placeholder="请输入账户名称"
                                    style={{ width: 180 }}
                                />
                            </Form.Item>
                            <Form.Item
                                label="工单ID"
                                name="workOrderId"
                                style={{ marginBottom: 0 }}
                            >
                                <Input
                                    placeholder="请输入工单ID"
                                    style={{ width: 180 }}
                                />
                            </Form.Item>
                            <Form.Item
                                label="申请时间"
                                name="createdTimeRange"
                                style={{ marginBottom: 0 }}
                            >
                                <RangePicker style={{ width: 280 }} />
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

                <div className="my-4 flex justify-end">
                    <Button type="link">导出</Button>
                </div>

                {/* 工单列表表格 */}
                <Table
                    loading={loading}
                    columns={columns}
                    dataSource={data}
                    rowKey="id"
                    pagination={{
                        total: total,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total) => `共 ${total} 条记录`,
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

                {/* 工单详情弹窗 */}
                <Modal
                    title="工单详情"
                    open={detailModalVisible}
                    onCancel={() => setDetailModalVisible(false)}
                    footer={[
                        <Button
                            key="back"
                            onClick={() => setDetailModalVisible(false)}
                        >
                            关闭
                        </Button>
                    ]}
                    width={800}
                >
                    {detailLoading ? (
                        <div className="text-center">加载中...</div>
                    ) : (
                        renderWorkOrderDetail()
                    )}
                </Modal>
            </ConfigProvider>
        </StyleProvider>
    )
}
