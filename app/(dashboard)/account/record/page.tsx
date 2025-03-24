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
    InputNumber
} from 'antd'
import type { TableColumnsType } from 'antd'
import { StyleProvider } from '@ant-design/cssinjs'
import { ConfigProvider } from 'antd'
import {
    WorkOrderStatus,
    WorkOrderType
} from '@/app/actions/workorder/account-management/types'
import { updateDepositWorkOrder } from '@/app/actions/workorder/account-management/deposit'
import { updateWithdrawalWorkOrder } from '@/app/actions/workorder/account-management/withdrawal'
import { getWorkOrders } from '@/app/actions/workorder/common'

const { Title } = Typography
const { RangePicker } = DatePicker

// 申请记录
interface Application {
    id: string // 申请ID
    type: WorkOrderType // 申请类型
    mediaAccountId: string // 账户ID
    mediaAccountName: string // 账户名称
    mediaPlatform: number // 媒体平台
    amount?: string // 金额（充值、减款、转账时有）
    dailyBudget?: number // 每日预算（充值时有）
    currency?: string // 币种
    status: WorkOrderStatus // 状态
    remarks?: string // 备注
    createdAt: string // 创建时间
    updatedAt: string // 更新时间
    taskId?: string // 任务ID（第三方返回）
    reason?: string // 原因（拒绝时有）
    companyName?: string // 公司主体
}

// 搜索表单
interface SearchForm {
    id?: string
    mediaAccountName?: string
    mediaAccountId?: string
    status?: WorkOrderStatus
    type?: WorkOrderType
    dateRange?: any[]
    mediaPlatform?: number
}

export default function ApplicationsPage() {
    const [form] = Form.useForm<SearchForm>()
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<Application[]>([])
    const [total, setTotal] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [detailVisible, setDetailVisible] = useState(false)
    const [currentApplication, setCurrentApplication] =
        useState<Application | null>(null)
    const [editVisible, setEditVisible] = useState(false)
    const [editForm] = Form.useForm()

    // 表格列定义
    const columns: TableColumnsType<Application> = [
        {
            title: '工单ID',
            dataIndex: 'id',
            key: 'id',
            width: 200
        },
        {
            title: '类型',
            dataIndex: 'type',
            key: 'type',
            width: 100,
            render: (type) => {
                console.log('媒体平台:', type)
                const typeMap = {
                    [WorkOrderType.DEPOSIT]: { text: '充值', color: 'blue' },
                    [WorkOrderType.DEDUCTION]: { text: '减款', color: 'red' },
                    [WorkOrderType.TRANSFER]: {
                        text: '转账',
                        color: 'green'
                    },
                    [WorkOrderType.BIND]: { text: '绑定', color: 'purple' },
                    // 添加对ACCOUNT_MANAGEMENT类型的支持
                    ACCOUNT_MANAGEMENT: { text: '充值', color: 'blue' }
                }
                const typeInfo = typeMap[type as WorkOrderType]
                return typeInfo ? (
                    <Tag color={typeInfo.color}>{typeInfo.text}</Tag>
                ) : (
                    <Tag color="default">{type || '未知类型'}</Tag>
                )
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
            width: 150
        },
        {
            title: '账户ID',
            dataIndex: 'mediaAccountId',
            key: 'mediaAccountId',
            width: 200
        },
        {
            title: '媒体平台',
            dataIndex: 'mediaPlatform',
            key: 'mediaPlatform',
            width: 100,
            render: (platform) => {
                console.log('媒体平台:', platform, typeof platform)
                const platformMap = {
                    1: { name: 'Facebook', color: '#1877F2' },
                    2: { name: 'Google', color: '#4285F4' },
                    3: { name: 'Meta', color: '#0081FB' },
                    5: { name: 'TikTok', color: '#000000' }
                }
                // 确保平台值为数字
                const platformValue = Number(platform)
                const platformInfo =
                    platformMap[platformValue as keyof typeof platformMap]
                return platformInfo ? (
                    <Tag color={platformInfo.color}>{platformInfo.name}</Tag>
                ) : (
                    <span>{platform || '未知'}</span>
                )
            }
        },
        {
            title: '金额',
            key: 'amount',
            width: 150,
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
                    [WorkOrderStatus.FAILED]: { text: '失败', color: 'error' },
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
            },
            filters: [
                { text: '待处理', value: WorkOrderStatus.PENDING },
                { text: '处理中', value: WorkOrderStatus.PROCESSING },
                { text: '已通过', value: WorkOrderStatus.APPROVED },
                { text: '已拒绝', value: WorkOrderStatus.REJECTED },
                { text: '已完成', value: WorkOrderStatus.COMPLETED },
                { text: '失败', value: WorkOrderStatus.FAILED },
                { text: '已取消', value: WorkOrderStatus.CANCELED }
            ],
            onFilter: (value, record) => record.status === value
        },
        {
            title: '申请时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 180
        },
        {
            title: '操作',
            key: 'action',
            fixed: 'right',
            width: 150,
            render: (_, record) => (
                <Space size="small">
                    <Button
                        size="small"
                        onClick={() => handleViewDetail(record)}
                    >
                        查看
                    </Button>
                    {record.status === WorkOrderStatus.PENDING && (
                        <Button
                            size="small"
                            type="primary"
                            onClick={() => handleEdit(record)}
                        >
                            编辑
                        </Button>
                    )}
                </Space>
            )
        }
    ]

    const handleSearch = async (values: SearchForm) => {
        setLoading(true)

        try {
            // 构建查询参数
            const queryParams: any = {
                page: currentPage,
                pageSize: pageSize
            }

            // 工单类型映射
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

            // 添加其他查询条件
            if (values.id) {
                queryParams.taskNumber = values.id
            }

            if (values.mediaAccountId) {
                queryParams.mediaAccountId = values.mediaAccountId
            }

            if (values.status) {
                queryParams.status = values.status
            }

            if (values.dateRange && values.dateRange.length === 2) {
                queryParams.dateRange = {
                    start: new Date(values.dateRange[0].format('YYYY-MM-DD')),
                    end: new Date(values.dateRange[1].format('YYYY-MM-DD'))
                }
            }

            // 调用服务端查询函数
            const response = await getWorkOrders(queryParams)
            console.log(response)
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

                // 转换数据结构以匹配Application接口
                const applications: Application[] = response.data.items.map(
                    (item: any) => {
                        // 从metadata中提取mediaPlatform，如果存在的话
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

                        console.log('处理申请记录:', {
                            id: item.id,
                            mediaPlatform,
                            mediaAccountName
                        })

                        return {
                            id: item.taskId || item.id,
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
                            mediaAccountId: item.mediaAccountId || '',
                            mediaAccountName: mediaAccountName,
                            mediaPlatform: Number(mediaPlatform),
                            amount: item.amount
                                ? String(item.amount)
                                : metadata.amount
                                  ? String(metadata.amount)
                                  : undefined,
                            dailyBudget:
                                item.dailyBudget || metadata.dailyBudget,
                            currency:
                                item.currency || metadata.currency || 'USD',
                            status: item.status as WorkOrderStatus,
                            remarks: item.remarks || metadata.remarks || '',
                            createdAt: new Date(
                                item.createdAt
                            ).toLocaleString(),
                            updatedAt: new Date(
                                item.updatedAt
                            ).toLocaleString(),
                            taskId: item.taskId,
                            reason: item.failureReason,
                            companyName:
                                metadata.companyName || item.companyName
                        }
                    }
                )

                setData(applications)
                setTotal(response.data.total)
            } else {
                message.error(response.message || '查询失败')
                setData([])
                setTotal(0)
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
    const handleViewDetail = (record: Application) => {
        setCurrentApplication(record)
        setDetailVisible(true)
    }

    // 处理分页变化
    const handlePaginationChange = (page: number, size: number) => {
        setCurrentPage(page)
        setPageSize(size)
        handleSearch(form.getFieldsValue())
    }

    // 处理重置
    const handleReset = () => {
        form.resetFields()
        setCurrentPage(1)
        handleSearch({})
    }

    // 处理编辑
    const handleEdit = (record: Application) => {
        setCurrentApplication(record)
        editForm.setFieldsValue({
            amount: record.amount,
            dailyBudget: record.dailyBudget,
            remarks: record.remarks
        })
        setEditVisible(true)
    }

    // 保存编辑
    const handleSaveEdit = async () => {
        try {
            const values = await editForm.validateFields()
            let success = false
            let responseMsg = ''

            // 根据工单类型调用不同的API
            if (currentApplication?.type === WorkOrderType.DEPOSIT) {
                // 充值工单
                const response = await updateDepositWorkOrder({
                    workOrderId: currentApplication!.id,
                    amount: values.amount,
                    dailyBudget: values.dailyBudget
                })
                success = response.success
                responseMsg = response.message || ''
            } else if (currentApplication?.type === WorkOrderType.DEDUCTION) {
                // 减款工单
                const response = await updateWithdrawalWorkOrder({
                    workOrderId: currentApplication!.id,
                    amount: values.amount,
                    remarks: values.remarks
                })
                // 减款API可能使用code字段而不是success
                success = response.code === 'SUCCESS'
                responseMsg = response.message || ''
            } else {
                throw new Error('不支持的工单类型')
            }

            if (success) {
                // 更新本地数据
                const newData = data.map((item) => {
                    if (item.id === currentApplication?.id) {
                        return {
                            ...item,
                            amount: values.amount,
                            dailyBudget:
                                currentApplication?.type ===
                                WorkOrderType.DEPOSIT
                                    ? values.dailyBudget
                                    : undefined,
                            updatedAt: new Date()
                                .toISOString()
                                .replace('T', ' ')
                                .substring(0, 19)
                        }
                    }
                    return item
                })

                setData(newData)
                setEditVisible(false)
                message.success(responseMsg || '修改成功')
            } else {
                message.error(responseMsg || '修改失败')
            }
        } catch (error) {
            console.error('表单验证失败:', error)
        }
    }

    // 初始化
    useEffect(() => {
        handleSearch({})
    }, [])

    return (
        <StyleProvider layer>
            <ConfigProvider>
                <Title level={3} className="m-0 mb-4">
                    申请记录
                </Title>

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
                                <Input placeholder="请输入申请ID" allowClear />
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
                                label="账户ID"
                                name="mediaAccountId"
                                style={{ marginBottom: 0 }}
                            >
                                <Input placeholder="请输入账户ID" allowClear />
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
                                label="申请时间"
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
                    rowKey={(record) => `${record.id}_${record.createdAt}`}
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
                    title="申请详情"
                    open={detailVisible}
                    onCancel={() => setDetailVisible(false)}
                    footer={[
                        <Button
                            key="close"
                            onClick={() => setDetailVisible(false)}
                        >
                            关闭
                        </Button>
                    ]}
                    width={700}
                >
                    {currentApplication && (
                        <Descriptions bordered column={2}>
                            <Descriptions.Item label="工单ID" span={2}>
                                {currentApplication.id}
                            </Descriptions.Item>
                            <Descriptions.Item label="申请类型">
                                {(() => {
                                    const typeMap: Record<string, string> = {
                                        [WorkOrderType.DEPOSIT]: '充值',
                                        [WorkOrderType.DEDUCTION]: '减款',
                                        [WorkOrderType.TRANSFER]: '转账',
                                        [WorkOrderType.BIND]: '绑定'
                                    }
                                    return (
                                        typeMap[
                                            currentApplication.type as string
                                        ] ||
                                        currentApplication.type ||
                                        '未知'
                                    )
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
                                        statusMap[currentApplication.status] ||
                                        '未知'
                                    )
                                })()}
                            </Descriptions.Item>
                            <Descriptions.Item label="账户名称">
                                {currentApplication.mediaAccountName}
                            </Descriptions.Item>
                            <Descriptions.Item label="账户ID">
                                {currentApplication.mediaAccountId}
                            </Descriptions.Item>
                            <Descriptions.Item label="媒体平台">
                                {(() => {
                                    console.log(
                                        '详情平台:',
                                        currentApplication.mediaPlatform
                                    )
                                    const platformMap = {
                                        1: 'Facebook',
                                        2: 'Google',
                                        3: 'Meta',
                                        5: 'TikTok'
                                    }
                                    const platformValue = Number(
                                        currentApplication.mediaPlatform
                                    )
                                    return (
                                        platformMap[
                                            platformValue as keyof typeof platformMap
                                        ] || '未知'
                                    )
                                })()}
                            </Descriptions.Item>
                            <Descriptions.Item label="公司主体">
                                {currentApplication.companyName || '-'}
                            </Descriptions.Item>
                            {currentApplication.amount !== undefined && (
                                <Descriptions.Item label="金额">
                                    {`${currentApplication.amount} ${currentApplication.currency}`}
                                </Descriptions.Item>
                            )}
                            {currentApplication.dailyBudget !== undefined && (
                                <Descriptions.Item label="每日预算">
                                    {`${currentApplication.dailyBudget} ${currentApplication.currency}`}
                                </Descriptions.Item>
                            )}
                            <Descriptions.Item label="申请时间">
                                {currentApplication.createdAt}
                            </Descriptions.Item>
                            <Descriptions.Item label="最后更新时间">
                                {currentApplication.updatedAt}
                            </Descriptions.Item>
                            {currentApplication.taskId && (
                                <Descriptions.Item label="任务ID" span={2}>
                                    {currentApplication.taskId}
                                </Descriptions.Item>
                            )}
                            {currentApplication.reason && (
                                <Descriptions.Item label="原因/结果" span={2}>
                                    {currentApplication.reason}
                                </Descriptions.Item>
                            )}
                            {currentApplication.remarks && (
                                <Descriptions.Item label="备注" span={2}>
                                    {currentApplication.remarks}
                                </Descriptions.Item>
                            )}
                        </Descriptions>
                    )}
                </Modal>

                {/* 编辑弹窗 */}
                <Modal
                    title={
                        currentApplication?.type === WorkOrderType.DEPOSIT
                            ? '编辑充值申请'
                            : '编辑减款申请'
                    }
                    open={editVisible}
                    onCancel={() => setEditVisible(false)}
                    onOk={handleSaveEdit}
                    okText="保存"
                    cancelText="取消"
                >
                    <Form
                        form={editForm}
                        layout="vertical"
                        initialValues={
                            currentApplication
                                ? {
                                      amount: currentApplication.amount,
                                      dailyBudget:
                                          currentApplication.dailyBudget,
                                      remarks: currentApplication.remarks
                                  }
                                : {}
                        }
                    >
                        <Form.Item
                            label={
                                currentApplication?.type ===
                                WorkOrderType.DEPOSIT
                                    ? '充值金额'
                                    : '减款金额'
                            }
                            name="amount"
                            rules={[
                                {
                                    required: true,
                                    message: `请输入${currentApplication?.type === WorkOrderType.DEPOSIT ? '充值' : '减款'}金额`
                                }
                            ]}
                        >
                            <InputNumber
                                style={{ width: '100%' }}
                                min={0}
                                precision={2}
                                placeholder={`请输入${currentApplication?.type === WorkOrderType.DEPOSIT ? '充值' : '减款'}金额`}
                            />
                        </Form.Item>

                        {currentApplication?.type === WorkOrderType.DEPOSIT && (
                            <Form.Item
                                label="每日预算"
                                name="dailyBudget"
                                rules={[
                                    {
                                        required: true,
                                        message: '请输入每日预算'
                                    }
                                ]}
                            >
                                <InputNumber
                                    style={{ width: '100%' }}
                                    min={0}
                                    precision={2}
                                    placeholder="请输入每日预算"
                                />
                            </Form.Item>
                        )}

                        <Form.Item label="备注" name="remarks">
                            <Input.TextArea
                                rows={4}
                                placeholder={`请输入${currentApplication?.type === WorkOrderType.DEPOSIT ? '充值' : '减款'}原因或备注信息`}
                            />
                        </Form.Item>
                    </Form>
                </Modal>
            </ConfigProvider>
        </StyleProvider>
    )
}
