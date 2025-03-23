'use client'

import { useState, useEffect } from 'react'
import {
    message,
    Badge,
    Modal,
    Button,
    Table,
    Space,
    Form,
    Card,
    DatePicker,
    Input,
    Select,
    Descriptions,
    Typography,
    Tag,
    Flex,
    Tabs
} from 'antd'
import type { TableColumnsType } from 'antd'
import { StyleProvider } from '@ant-design/cssinjs'
import { ConfigProvider } from 'antd'
import { submitRechargeToThirdParty } from '@/app/actions/workorder/account-management/deposit'
import {
    approveDepositWorkOrder,
    rejectDepositWorkOrder
} from '@/app/actions/workorder/account-management/deposit'
import {
    approveWithdrawalWorkOrder,
    rejectWithdrawalWorkOrder
} from '@/app/actions/workorder/account-management/withdrawal'
import {
    approveTransferWorkOrder,
    rejectTransferWorkOrder
} from '@/app/actions/workorder/account-management/transfer'
import {
    approveAccountBindingWorkOrder,
    rejectAccountBindingWorkOrder
} from '@/app/actions/workorder/account-management/account-binding'
import { getWorkOrders } from '@/app/actions/workorder/common'
import {
    WorkOrderStatus,
    WorkOrderType
} from '@/app/actions/workorder/account-management/types'
import { WorkOrderSubtype } from '@prisma/client'
import type { WorkOrder } from '@/app/actions/workorder/account-management/types'

const { Title } = Typography
const { RangePicker } = DatePicker

// 搜索表单
interface SearchForm {
    id?: string
    mediaAccountName?: string
    mediaAccountId?: string
    status?: WorkOrderStatus
    type?: WorkOrderType
    dateRange?: any[]
    mediaPlatform?: number
    createdBy?: string
}

export default function AdminWorkOrdersPage() {
    const [form] = Form.useForm<SearchForm>()
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<WorkOrder[]>([])
    const [total, setTotal] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [detailVisible, setDetailVisible] = useState(false)
    const [currentWorkOrder, setCurrentWorkOrder] = useState<WorkOrder | null>(
        null
    )
    const [actionLoading, setActionLoading] = useState(false)
    const [activeTab, setActiveTab] = useState('all')
    const [pendingCount, setPendingCount] = useState(0)

    // 获取待处理工单数量
    const fetchPendingCount = async () => {
        try {
            const response = await getWorkOrders({
                status: WorkOrderStatus.PENDING,
                page: 1,
                pageSize: 1
            })
            if (response.success && response.data) {
                setPendingCount(response.data.total)
            }
        } catch (error) {
            console.error('获取待处理工单数量失败:', error)
        }
    }

    // 初始化时获取待处理数量
    useEffect(() => {
        fetchPendingCount()
    }, [])

    // 表格列定义
    const columns: TableColumnsType<WorkOrder> = [
        {
            title: '工单ID',
            dataIndex: 'id',
            key: 'id',
            width: 180
        },
        {
            title: '类型',
            dataIndex: 'type',
            key: 'type',
            width: 100,
            render: (type) => {
                const typeMap = {
                    [WorkOrderType.DEPOSIT]: { text: '充值', color: 'blue' },
                    [WorkOrderType.DEDUCTION]: { text: '减款', color: 'red' },
                    [WorkOrderType.TRANSFER]: { text: '转账', color: 'green' },
                    [WorkOrderType.BIND]: { text: '绑定', color: 'purple' }
                }
                const typeInfo = typeMap[type as WorkOrderType]
                return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>
            },
            filters: [
                { text: '充值', value: WorkOrderType.DEPOSIT },
                { text: '减款', value: WorkOrderType.DEDUCTION },
                { text: '转账', value: WorkOrderType.TRANSFER },
                { text: '绑定', value: WorkOrderType.BIND }
            ],
            onFilter: (value, record) => record.type === value
        },
        {
            title: '账户名称',
            dataIndex: 'mediaAccountName',
            key: 'mediaAccountName',
            width: 140
        },
        {
            title: '媒体平台',
            dataIndex: 'mediaPlatform',
            key: 'mediaPlatform',
            width: 100,
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
            }
        },
        {
            title: '金额',
            key: 'amount',
            width: 120,
            render: (_, record) =>
                record.amount ? `${record.amount} ${record.currency}` : '-'
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            width: 120,
            render: (status) => {
                const statusMap = {
                    [WorkOrderStatus.PENDING]: {
                        text: '待处理',
                        color: 'processing'
                    },
                    [WorkOrderStatus.PROCESSING]: {
                        text: '处理中',
                        color: 'blue'
                    },
                    [WorkOrderStatus.APPROVED]: {
                        text: '已通过',
                        color: 'success'
                    },
                    [WorkOrderStatus.REJECTED]: {
                        text: '已拒绝',
                        color: 'error'
                    },
                    [WorkOrderStatus.COMPLETED]: {
                        text: '已完成',
                        color: 'success'
                    },
                    [WorkOrderStatus.FAILED]: {
                        text: '失败',
                        color: 'error'
                    },
                    [WorkOrderStatus.CANCELED]: {
                        text: '已取消',
                        color: 'default'
                    }
                }
                const statusInfo = statusMap[status as WorkOrderStatus] || {
                    text: '未知',
                    color: 'default'
                }
                return (
                    <Badge
                        status={statusInfo.color as any}
                        text={statusInfo.text}
                    />
                )
            }
        },
        {
            title: '申请人',
            dataIndex: 'createdBy',
            key: 'createdBy',
            width: 100
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 160
        },
        {
            title: '操作',
            key: 'action',
            fixed: 'right',
            width: 200,
            render: (_, record) => (
                <Space size="small">
                    <Button
                        size="small"
                        onClick={() => handleViewDetail(record)}
                    >
                        查看
                    </Button>
                    {record.status === WorkOrderStatus.PENDING && (
                        <>
                            <Button
                                size="small"
                                type="primary"
                                onClick={() => handleApprove(record)}
                            >
                                通过
                            </Button>
                            <Button
                                size="small"
                                danger
                                onClick={() => handleReject(record)}
                            >
                                拒绝
                            </Button>
                        </>
                    )}
                </Space>
            )
        }
    ]

    // Define tab items for the modern Tabs API
    const tabItems = [
        {
            key: 'all',
            label: '全部工单'
        },
        {
            key: 'pending',
            label: (
                <span>
                    待处理
                    <Badge count={pendingCount} />
                </span>
            )
        },
        {
            key: 'processing',
            label: '处理中'
        },
        {
            key: 'completed',
            label: '已完成'
        }
    ]

    // 处理查询
    const handleSearch = async (values: SearchForm) => {
        setLoading(true)

        try {
            // 构建查询参数
            const queryParams: any = {
                page: currentPage,
                pageSize: pageSize
            }

            // 根据当前标签页过滤状态
            if (activeTab === 'pending') {
                queryParams.status = WorkOrderStatus.PENDING
            } else if (activeTab === 'processing') {
                queryParams.status = WorkOrderStatus.PROCESSING
            } else if (activeTab === 'completed') {
                queryParams.status = [
                    WorkOrderStatus.COMPLETED,
                    WorkOrderStatus.REJECTED,
                    WorkOrderStatus.FAILED
                ]
            }

            // 添加其他查询条件
            if (values.id) {
                queryParams.taskNumber = values.id
            }

            if (values.mediaAccountName) {
                queryParams.mediaAccountName = values.mediaAccountName
            }

            if (values.mediaAccountId) {
                queryParams.mediaAccountId = values.mediaAccountId
            }

            if (values.status) {
                queryParams.status = values.status
            }

            // 添加工单类型映射
            if (values.type) {
                // 前端使用的WorkOrderType需要映射到后端的workOrderType和workOrderSubtype
                queryParams.workOrderType = 'ACCOUNT_MANAGEMENT'

                switch (values.type) {
                    case WorkOrderType.DEPOSIT:
                        queryParams.workOrderSubtype = 'DEPOSIT'
                        break
                    case WorkOrderType.DEDUCTION:
                        queryParams.workOrderSubtype = 'WITHDRAWAL'
                        break
                    case WorkOrderType.TRANSFER:
                        queryParams.workOrderSubtype = 'TRANSFER'
                        break
                    case WorkOrderType.BIND:
                        // 如果需要查询所有绑定类型，可以通过IN条件
                        queryParams.workOrderSubtype = [
                            'BIND_ACCOUNT',
                            'BIND_EMAIL',
                            'BIND_PIXEL'
                        ]
                        break
                    default:
                        // 其他情况，直接使用type作为workOrderSubtype
                        queryParams.workOrderSubtype = values.type
                }
            }

            if (values.mediaPlatform) {
                queryParams.mediaPlatform = values.mediaPlatform
            }

            if (values.createdBy) {
                queryParams.createdBy = values.createdBy
            }

            if (values.dateRange && values.dateRange.length === 2) {
                queryParams.dateRange = {
                    start: new Date(values.dateRange[0].format('YYYY-MM-DD')),
                    end: new Date(values.dateRange[1].format('YYYY-MM-DD'))
                }
            }

            // 调用服务端查询函数
            const response = await getWorkOrders(queryParams)
            console.log('查询结果:', response)

            if (response.success && response.data) {
                // 辅助函数解析metadata
                const parseMeta = (item: any): Record<string, any> => {
                    let metadata: Record<string, any> = {}
                    try {
                        if (typeof item.metadata === 'string') {
                            metadata = JSON.parse(item.metadata)
                        } else if (
                            item.metadata &&
                            typeof item.metadata === 'object'
                        ) {
                            metadata = item.metadata as Record<string, any>
                        }
                    } catch (e) {
                        console.error('解析元数据失败:', e, item.metadata)
                        metadata = {}
                    }
                    return metadata
                }

                // 转换数据结构以匹配WorkOrder接口
                const workOrders: WorkOrder[] = response.data.items.map(
                    (item: any) => {
                        // 从metadata中提取信息
                        const metadata = parseMeta(item)
                        console.log('工单ID:', item.id, '元数据:', metadata)

                        // 优先使用数字形式，其次尝试转换
                        let mediaPlatform = metadata.mediaPlatformNumber

                        if (mediaPlatform === undefined) {
                            // 尝试从platformType或字符串形式转换
                            const platformTypeStr =
                                metadata.platformType ||
                                metadata.mediaPlatform ||
                                item.mediaPlatform
                            if (platformTypeStr) {
                                mediaPlatform = Number(platformTypeStr)
                            }
                        }

                        // 如果仍然无效，使用0作为默认值
                        if (
                            mediaPlatform === undefined ||
                            isNaN(mediaPlatform)
                        ) {
                            mediaPlatform = 0
                        }

                        // 提取媒体账户名称
                        const mediaAccountName =
                            metadata.mediaAccountName ||
                            item.mediaAccountName ||
                            ''

                        console.log('处理工单:', {
                            id: item.id,
                            mediaPlatform,
                            mediaAccountName
                        })

                        return {
                            id: item.id,
                            type: (() => {
                                // 根据workOrderType和workOrderSubtype映射到前端枚举
                                if (
                                    item.workOrderType === 'ACCOUNT_MANAGEMENT'
                                ) {
                                    // 账户管理类型需要根据子类型进一步判断
                                    switch (item.workOrderSubtype) {
                                        case 'DEPOSIT':
                                            return WorkOrderType.DEPOSIT
                                        case 'WITHDRAWAL':
                                            return WorkOrderType.DEDUCTION
                                        case 'TRANSFER':
                                            return WorkOrderType.TRANSFER
                                        case 'BIND_ACCOUNT':
                                        case 'BIND_EMAIL':
                                        case 'BIND_PIXEL':
                                            return WorkOrderType.BIND
                                        default:
                                            return item.workOrderSubtype
                                    }
                                } else {
                                    // 其他类型直接返回
                                    return item.workOrderType as any
                                }
                            })(),
                            status: item.status as WorkOrderStatus,
                            createdAt: new Date(
                                item.createdAt
                            ).toLocaleString(),
                            updatedAt: new Date(
                                item.updatedAt
                            ).toLocaleString(),
                            createdBy: item.createdBy || '未知',
                            updatedBy: item.updatedBy || '未知',
                            mediaAccountId: item.mediaAccountId || '',
                            mediaAccountName: mediaAccountName,
                            mediaPlatform: Number(mediaPlatform),
                            companyName:
                                metadata.companyName || item.companyName || '',
                            amount: metadata.amount,
                            dailyBudget: metadata.dailyBudget,
                            currency: metadata.currency || 'USD',
                            remarks: item.remark || '',
                            taskId: item.taskId || item.thirdPartyTaskId,
                            reason: item.failureReason,
                            thirdPartyResponse: item.thirdPartyResponse
                        }
                    }
                )

                setData(workOrders)
                setTotal(response.data.total)
            } else {
                message.error(response.message || '查询失败')
                setData([])
                setTotal(0)
            }

            // 如果不是查询待处理标签，更新待处理数量
            if (activeTab !== 'pending') {
                fetchPendingCount()
            } else {
                // 如果是查询待处理标签，直接使用总数
                setPendingCount(response.data?.total || 0)
            }
        } catch (error) {
            console.error('查询工单失败:', error)
            message.error('查询失败，请稍后重试')
            setData([])
            setTotal(0)
        } finally {
            setLoading(false)
        }
    }

    // 查看详情
    const handleViewDetail = (record: WorkOrder) => {
        setCurrentWorkOrder(record)
        setDetailVisible(true)
    }

    // 批准工单
    const handleApprove = (record: WorkOrder) => {
        Modal.confirm({
            title: '确认审批',
            content: '确定要通过此工单吗？',
            onOk: async () => {
                setActionLoading(true)

                try {
                    let result

                    // 根据工单类型使用相应的API进行审批
                    switch (record.type) {
                        case WorkOrderType.DEPOSIT:
                            result = await approveDepositWorkOrder({
                                workOrderId: record.id,
                                approvedBy: '管理员'
                            })
                            break
                        case WorkOrderType.DEDUCTION: // 对应WITHDRAWAL
                            result = await approveWithdrawalWorkOrder({
                                workOrderId: record.id,
                                approvedBy: '管理员'
                            })
                            break
                        case WorkOrderType.TRANSFER:
                            result = await approveTransferWorkOrder({
                                workOrderId: record.id,
                                approvedBy: '管理员'
                            })
                            break
                        case WorkOrderType.BIND: // 对应BIND_ACCOUNT
                            result = await approveAccountBindingWorkOrder({
                                workOrderId: record.id,
                                approvedBy: '管理员'
                            })
                            break
                        default:
                            throw new Error(`不支持的工单类型: ${record.type}`)
                    }

                    if (result && result.success) {
                        // 更新本地数据
                        const newData = data.map((item) => {
                            if (item.id === record.id) {
                                return {
                                    ...item,
                                    status: WorkOrderStatus.APPROVED,
                                    updatedAt: new Date()
                                        .toISOString()
                                        .replace('T', ' ')
                                        .substring(0, 19),
                                    updatedBy: '管理员'
                                }
                            }
                            return item
                        })
                        setData(newData)

                        // 如果当前工单是正在查看详情的工单，也更新它
                        if (
                            currentWorkOrder &&
                            currentWorkOrder.id === record.id
                        ) {
                            setCurrentWorkOrder({
                                ...currentWorkOrder,
                                status: WorkOrderStatus.APPROVED,
                                updatedAt: new Date()
                                    .toISOString()
                                    .replace('T', ' ')
                                    .substring(0, 19),
                                updatedBy: '管理员'
                            })
                        }

                        message.success(result.message || '工单已通过')
                        // 刷新待处理工单数量
                        fetchPendingCount()
                    } else {
                        message.error(result?.message || '审批工单失败')
                    }
                } catch (error) {
                    console.error('工单审批失败:', error)
                    message.error(
                        error instanceof Error
                            ? error.message
                            : '审批过程中发生错误'
                    )
                } finally {
                    setActionLoading(false)
                }
            }
        })
    }

    // 拒绝工单
    const handleReject = (record: WorkOrder) => {
        Modal.confirm({
            title: '确认拒绝',
            content: (
                <div>
                    <p>确定要拒绝此工单吗？</p>
                    <p>请输入拒绝原因：</p>
                    <Input.TextArea id="rejectReason" rows={3} />
                </div>
            ),
            onOk: async () => {
                const reason =
                    (
                        document.getElementById(
                            'rejectReason'
                        ) as HTMLTextAreaElement
                    )?.value || '未提供原因'

                setActionLoading(true)

                try {
                    let result

                    // 根据工单类型使用相应的API进行拒绝
                    switch (record.type) {
                        case WorkOrderType.DEPOSIT:
                            result = await rejectDepositWorkOrder({
                                workOrderId: record.id,
                                reason: reason,
                                rejectedBy: '管理员'
                            })
                            break
                        case WorkOrderType.DEDUCTION: // 对应WITHDRAWAL
                            result = await rejectWithdrawalWorkOrder({
                                workOrderId: record.id,
                                reason: reason,
                                rejectedBy: '管理员'
                            })
                            break
                        case WorkOrderType.TRANSFER:
                            result = await rejectTransferWorkOrder({
                                workOrderId: record.id,
                                reason: reason,
                                rejectedBy: '管理员'
                            })
                            break
                        case WorkOrderType.BIND: // 对应BIND_ACCOUNT
                            result = await rejectAccountBindingWorkOrder({
                                workOrderId: record.id,
                                reason: reason,
                                rejectedBy: '管理员'
                            })
                            break
                        default:
                            throw new Error(`不支持的工单类型: ${record.type}`)
                    }

                    if (result && result.success) {
                        // 更新本地数据
                        const newData = data.map((item) => {
                            if (item.id === record.id) {
                                return {
                                    ...item,
                                    status: WorkOrderStatus.REJECTED,
                                    reason: reason,
                                    updatedAt: new Date().toLocaleString(),
                                    updatedBy: '管理员'
                                }
                            }
                            return item
                        })
                        setData(newData)

                        // 更新当前查看的工单
                        if (
                            currentWorkOrder &&
                            currentWorkOrder.id === record.id
                        ) {
                            setCurrentWorkOrder({
                                ...currentWorkOrder,
                                status: WorkOrderStatus.REJECTED,
                                reason: reason,
                                updatedAt: new Date().toLocaleString(),
                                updatedBy: '管理员'
                            })
                        }

                        message.success(result.message || '工单已拒绝')
                        // 刷新待处理工单数量
                        fetchPendingCount()
                    } else {
                        message.error(result?.message || '拒绝工单失败')
                    }
                } catch (error) {
                    console.error('拒绝工单失败:', error)
                    message.error(
                        error instanceof Error ? error.message : '拒绝工单失败'
                    )
                } finally {
                    setActionLoading(false)
                }
            }
        })
    }

    // 处理分页变化
    const handlePaginationChange = (page: number, size: number) => {
        setCurrentPage(page)
        setPageSize(size)
        handleSearch(form.getFieldsValue())
    }

    // 处理标签页切换
    const handleTabChange = (activeKey: string) => {
        setActiveTab(activeKey)
        setCurrentPage(1)
        handleSearch(form.getFieldsValue())
    }

    // 处理重置
    const handleReset = () => {
        form.resetFields()
        setCurrentPage(1)
        handleSearch({})
    }

    // 初始化
    useEffect(() => {
        handleSearch({})
    }, [])

    return (
        <StyleProvider layer>
            <ConfigProvider>
                <Title level={3} className="m-0 mb-4">
                    工单管理
                </Title>

                {/* 标签页 - Updated to use items prop */}
                <Tabs
                    activeKey={activeTab}
                    onChange={handleTabChange}
                    style={{ marginBottom: 16 }}
                    items={tabItems}
                />

                {/* 搜索表单 */}
                <Card style={{ marginBottom: 16 }}>
                    <Form
                        form={form}
                        layout="horizontal"
                        onFinish={handleSearch}
                    >
                        <Flex gap={16} wrap>
                            <Form.Item
                                label="工单编号"
                                name="id"
                                style={{ marginBottom: 0 }}
                            >
                                <Input
                                    placeholder="请输入工单编号"
                                    allowClear
                                />
                            </Form.Item>
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
                                label="申请人"
                                name="createdBy"
                                style={{ marginBottom: 0 }}
                            >
                                <Input placeholder="请输入申请人" allowClear />
                            </Form.Item>
                            <Form.Item
                                label="媒体平台"
                                name="mediaPlatform"
                                style={{ marginBottom: 0 }}
                            >
                                <Select
                                    placeholder="请选择媒体平台"
                                    allowClear
                                    style={{ width: 150 }}
                                >
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
                            >
                                <Select
                                    placeholder="请选择状态"
                                    allowClear
                                    style={{ width: 150 }}
                                >
                                    <Select.Option
                                        value={WorkOrderStatus.PENDING}
                                    >
                                        待处理
                                    </Select.Option>
                                    <Select.Option
                                        value={WorkOrderStatus.PROCESSING}
                                    >
                                        处理中
                                    </Select.Option>
                                    <Select.Option
                                        value={WorkOrderStatus.APPROVED}
                                    >
                                        已通过
                                    </Select.Option>
                                    <Select.Option
                                        value={WorkOrderStatus.REJECTED}
                                    >
                                        已拒绝
                                    </Select.Option>
                                    <Select.Option
                                        value={WorkOrderStatus.COMPLETED}
                                    >
                                        已完成
                                    </Select.Option>
                                    <Select.Option
                                        value={WorkOrderStatus.FAILED}
                                    >
                                        失败
                                    </Select.Option>
                                </Select>
                            </Form.Item>
                            <Form.Item
                                label="类型"
                                name="type"
                                style={{ marginBottom: 0 }}
                            >
                                <Select
                                    placeholder="请选择类型"
                                    allowClear
                                    style={{ width: 150 }}
                                >
                                    <Select.Option
                                        value={WorkOrderType.DEPOSIT}
                                    >
                                        充值
                                    </Select.Option>
                                    <Select.Option
                                        value={WorkOrderType.DEDUCTION}
                                    >
                                        减款
                                    </Select.Option>
                                    <Select.Option
                                        value={WorkOrderType.TRANSFER}
                                    >
                                        转账
                                    </Select.Option>
                                    <Select.Option value={WorkOrderType.BIND}>
                                        绑定
                                    </Select.Option>
                                </Select>
                            </Form.Item>
                            <Form.Item
                                label="创建时间"
                                name="dateRange"
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
                    columns={columns}
                    dataSource={data}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        current: currentPage,
                        pageSize: pageSize,
                        total: total,
                        showSizeChanger: true,
                        showQuickJumper: true,
                        showTotal: (total) => `共 ${total} 条记录`,
                        onChange: handlePaginationChange
                    }}
                    scroll={{ x: 1300 }}
                />

                {/* 详情弹窗 */}
                <Modal
                    title="工单详情"
                    open={detailVisible}
                    onCancel={() => setDetailVisible(false)}
                    footer={[
                        <Button
                            key="close"
                            onClick={() => setDetailVisible(false)}
                        >
                            关闭
                        </Button>,
                        currentWorkOrder?.status ===
                            WorkOrderStatus.PENDING && (
                            <>
                                <Button
                                    key="reject"
                                    danger
                                    loading={actionLoading}
                                    onClick={() => {
                                        if (currentWorkOrder) {
                                            handleReject(currentWorkOrder)
                                        }
                                    }}
                                >
                                    拒绝
                                </Button>
                                <Button
                                    key="approve"
                                    type="primary"
                                    loading={actionLoading}
                                    onClick={() => {
                                        if (currentWorkOrder) {
                                            handleApprove(currentWorkOrder)
                                        }
                                    }}
                                >
                                    通过
                                </Button>
                            </>
                        )
                    ]}
                    width={700}
                >
                    {currentWorkOrder && (
                        <Descriptions bordered column={2}>
                            <Descriptions.Item label="工单编号" span={2}>
                                {currentWorkOrder.id}
                            </Descriptions.Item>
                            <Descriptions.Item label="工单类型">
                                {(() => {
                                    const typeMap = {
                                        [WorkOrderType.DEPOSIT]: '充值',
                                        [WorkOrderType.DEDUCTION]: '减款',
                                        [WorkOrderType.TRANSFER]: '转账',
                                        [WorkOrderType.BIND]: '绑定'
                                    }
                                    return typeMap[currentWorkOrder.type]
                                })()}
                            </Descriptions.Item>
                            <Descriptions.Item label="状态">
                                {(() => {
                                    const statusMap = {
                                        [WorkOrderStatus.PENDING]: '待处理',
                                        [WorkOrderStatus.PROCESSING]: '处理中',
                                        [WorkOrderStatus.APPROVED]: '已通过',
                                        [WorkOrderStatus.REJECTED]: '已拒绝',
                                        [WorkOrderStatus.COMPLETED]: '已完成',
                                        [WorkOrderStatus.FAILED]: '失败',
                                        [WorkOrderStatus.CANCELED]: '已取消'
                                    }
                                    return (
                                        statusMap[currentWorkOrder.status] ||
                                        '未知'
                                    )
                                })()}
                            </Descriptions.Item>
                            <Descriptions.Item label="账户名称">
                                {currentWorkOrder.mediaAccountName}
                            </Descriptions.Item>
                            <Descriptions.Item label="账户ID">
                                {currentWorkOrder.mediaAccountId}
                            </Descriptions.Item>
                            <Descriptions.Item label="媒体平台">
                                {(() => {
                                    const platformMap = {
                                        1: 'Facebook',
                                        2: 'Google',
                                        3: 'Meta',
                                        5: 'TikTok'
                                    }
                                    return (
                                        platformMap[
                                            currentWorkOrder.mediaPlatform as keyof typeof platformMap
                                        ] || '未知'
                                    )
                                })()}
                            </Descriptions.Item>
                            <Descriptions.Item label="公司主体">
                                {currentWorkOrder.companyName}
                            </Descriptions.Item>
                            {currentWorkOrder.amount !== undefined && (
                                <Descriptions.Item label="金额">
                                    {`${currentWorkOrder.amount} ${currentWorkOrder.currency}`}
                                </Descriptions.Item>
                            )}
                            {currentWorkOrder.dailyBudget !== undefined && (
                                <Descriptions.Item label="每日预算">
                                    {`${currentWorkOrder.dailyBudget} ${currentWorkOrder.currency}`}
                                </Descriptions.Item>
                            )}
                            <Descriptions.Item label="申请人">
                                {currentWorkOrder.createdBy}
                            </Descriptions.Item>
                            <Descriptions.Item label="处理人">
                                {currentWorkOrder.updatedBy}
                            </Descriptions.Item>
                            <Descriptions.Item label="创建时间">
                                {currentWorkOrder.createdAt}
                            </Descriptions.Item>
                            <Descriptions.Item label="更新时间">
                                {currentWorkOrder.updatedAt}
                            </Descriptions.Item>
                            {currentWorkOrder.taskId && (
                                <Descriptions.Item label="任务ID" span={2}>
                                    {currentWorkOrder.taskId}
                                </Descriptions.Item>
                            )}
                            {currentWorkOrder.reason && (
                                <Descriptions.Item label="原因/结果" span={2}>
                                    {currentWorkOrder.reason}
                                </Descriptions.Item>
                            )}
                            {currentWorkOrder.remarks && (
                                <Descriptions.Item label="备注" span={2}>
                                    {currentWorkOrder.remarks}
                                </Descriptions.Item>
                            )}
                            {currentWorkOrder.thirdPartyResponse && (
                                <Descriptions.Item label="第三方响应" span={2}>
                                    <pre
                                        style={{
                                            whiteSpace: 'pre-wrap',
                                            maxHeight: '200px',
                                            overflowY: 'auto'
                                        }}
                                    >
                                        {JSON.stringify(
                                            JSON.parse(
                                                currentWorkOrder.thirdPartyResponse
                                            ),
                                            null,
                                            2
                                        )}
                                    </pre>
                                </Descriptions.Item>
                            )}
                        </Descriptions>
                    )}
                </Modal>
            </ConfigProvider>
        </StyleProvider>
    )
}
