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
    type TableColumnsType,
    Tag,
    Flex,
    Tabs,
    ConfigProvider
} from 'antd'
import { StyleProvider } from '@ant-design/cssinjs'
// import { submitRechargeToThirdParty } from '@/app/actions/workorder/account-management/deposit'
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
import {
    approveZeroingWorkOrder,
    rejectZeroingWorkOrder
} from '@/app/actions/workorder/account-management/zeroing'
import { getWorkOrders } from '@/app/actions/workorder/common'
import {
    WorkOrderStatus,
    WorkOrderType
} from '@/app/actions/workorder/account-management/types'
// import { WorkOrderSubtype } from '@prisma/client'
import type { WorkOrder } from '@/app/actions/workorder/account-management/types'

// 根据工单类型添加筛选条件的辅助函数
const addWorkOrderTypeConditions = (queryParams: any, type: any) => {
    // 如果没有type值，直接返回
    if (!type) return;

    switch (type) {
        case WorkOrderType.DEPOSIT:
            queryParams.workOrderType = 'ACCOUNT_MANAGEMENT';
            queryParams.workOrderSubtype = 'DEPOSIT'
            break
        case WorkOrderType.DEDUCTION:
            queryParams.workOrderType = 'ACCOUNT_MANAGEMENT';
            queryParams.workOrderSubtype = 'WITHDRAWAL'
            break
        case WorkOrderType.TRANSFER:
            queryParams.workOrderType = 'ACCOUNT_MANAGEMENT';
            queryParams.workOrderSubtype = 'TRANSFER'
            break
        case WorkOrderType.BIND:
            // 如果需要查询所有绑定类型，可以通过IN条件
            queryParams.workOrderType = 'ACCOUNT_MANAGEMENT';
            queryParams.workOrderSubtype = [
                'BIND_ACCOUNT',
                'BIND_EMAIL',
                'BIND_PIXEL'
            ]
            break
        case 'ZEROING':
            queryParams.workOrderType = 'ACCOUNT_MANAGEMENT';
            queryParams.workOrderSubtype = 'ZEROING'
            break
        case 'ACCOUNT_APPLICATION':
            queryParams.workOrderType = 'ACCOUNT_APPLICATION';
            break
        case 'GOOGLE_ACCOUNT':
            queryParams.workOrderType = 'ACCOUNT_APPLICATION';
            queryParams.workOrderSubtype = 'GOOGLE_ACCOUNT';
            break
        case 'FACEBOOK_ACCOUNT':
            queryParams.workOrderType = 'ACCOUNT_APPLICATION';
            queryParams.workOrderSubtype = 'FACEBOOK_ACCOUNT';
            break
        case 'TIKTOK_ACCOUNT':
            queryParams.workOrderType = 'ACCOUNT_APPLICATION';
            queryParams.workOrderSubtype = 'TIKTOK_ACCOUNT';
            break
        default:
            // 其他情况，如果是有效字符串，使用type作为workOrderSubtype
            if (typeof type === 'string' && type.trim()) {
                queryParams.workOrderSubtype = type
            }
    }
}

// 辅助函数：判断是否为开户申请类型工单
const isAccountApplicationWorkOrder = (record: ExtendedWorkOrder): boolean => {
    if (!record) return false;

    // 检查workOrderSubtype - 最直接的方式
    if (record.workOrderSubtype &&
        ['GOOGLE_ACCOUNT', 'FACEBOOK_ACCOUNT', 'TIKTOK_ACCOUNT'].includes(record.workOrderSubtype)) {
        return true;
    }

    // 检查workOrderType是否为ACCOUNT_APPLICATION
    if (record.workOrderType === 'ACCOUNT_APPLICATION') {
        return true;
    }

    // 检查metadata中的信息
    if (record.metadata) {
        if (record.metadata.workOrderType === 'ACCOUNT_APPLICATION') {
            return true;
        }

        if (record.metadata.workOrderSubtype &&
            ['GOOGLE_ACCOUNT', 'FACEBOOK_ACCOUNT', 'TIKTOK_ACCOUNT'].includes(record.metadata.workOrderSubtype)) {
            return true;
        }

        // 如果包含accountApplicationInfo字段，也视为开户申请
        if (record.metadata.accountApplicationInfo) {
            return true;
        }
    }

    return false;
}

// 扩展WorkOrder类型，添加metadata和workOrderSubtype字段
interface ExtendedWorkOrder extends WorkOrder {
    metadata?: Record<string, any>;
    workOrderSubtype?: string;
    workOrderType?: string;
    orderNumber?: string;
    taskNumber?: string;
}

const { Title } = Typography
const { RangePicker } = DatePicker

// 搜索表单
interface SearchForm {
    taskNumber?: string
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
    const [data, setData] = useState<ExtendedWorkOrder[]>([])
    const [total, setTotal] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [detailVisible, setDetailVisible] = useState(false)
    const [currentWorkOrder, setCurrentWorkOrder] = useState<ExtendedWorkOrder | null>(
        null
    )
    const [actionLoading, setActionLoading] = useState(false)
    const [activeTab, setActiveTab] = useState('all')
    const [pendingCount, setPendingCount] = useState(0)

    // 获取待处理工单数量 - 独立函数，不受当前标签影响
    const fetchPendingCount = async () => {
        try {
            // 单独请求只获取待处理状态的工单数量
            const response = await getWorkOrders({
                status: WorkOrderStatus.PENDING,
                page: 1,
                pageSize: 1
            })
            if (response.success && response.data) {
                setPendingCount(response.data.total)
            }
        } catch (error) {
            // 忽略错误
        }
    }

    // 初始化时获取待处理数量
    useEffect(() => {
        // 初始化时获取待处理工单数量
        fetchPendingCount()

        // 设置定时器，每分钟更新一次待处理数量
        const timer = setInterval(fetchPendingCount, 60000);

        // 组件卸载时清除定时器
        return () => clearInterval(timer);
    }, [])

    // 表格列定义
    const columns: TableColumnsType<ExtendedWorkOrder> = [
        {
            title: '工单编号',
            dataIndex: 'taskNumber',
            key: 'taskNumber',
            width: 180
        },
        {
            title: '类型',
            dataIndex: 'type',
            key: 'type',
            width: 100,
            render: (type, record) => {
                // 检查是否为开户申请类型
                const extRecord = record as ExtendedWorkOrder;
                if (isAccountApplicationWorkOrder(extRecord)) {
                    // 根据平台类型返回不同的开户类型名称
                    let platformText = '';
                    switch (extRecord.workOrderSubtype) {
                        case 'GOOGLE_ACCOUNT':
                            platformText = 'Google开户';
                            return <Tag color="blue">{platformText}</Tag>;
                        case 'FACEBOOK_ACCOUNT':
                            platformText = 'Facebook开户';
                            return <Tag color="purple">{platformText}</Tag>;
                        case 'TIKTOK_ACCOUNT':
                            platformText = 'TikTok开户';
                            return <Tag color="black">{platformText}</Tag>;
                        default:
                            platformText = '账户开户';
                            return <Tag color="cyan">{platformText}</Tag>;
                    }
                }

                // 完善工单类型映射
                const typeMap = {
                    [WorkOrderType.DEPOSIT]: { text: '充值', color: 'blue' },
                    [WorkOrderType.DEDUCTION]: { text: '减款', color: 'red' },
                    [WorkOrderType.TRANSFER]: { text: '转账', color: 'green' },
                    [WorkOrderType.BIND]: { text: '绑定', color: 'purple' },
                    // 补充更多类型映射
                    ZEROING: { text: '清零', color: 'orange' },
                    BIND_ACCOUNT: { text: '绑定账户', color: 'purple' },
                    BIND_EMAIL: { text: '绑定邮箱', color: 'purple' },
                    BIND_PIXEL: { text: '绑定Pixel', color: 'purple' },
                    ACCOUNT_APPLICATION: { text: '开户申请', color: 'cyan' },
                    ACCOUNT_MANAGEMENT: { text: '账户管理', color: 'blue' }
                }

                // 扩展的类型映射，处理字符串类型
                const extendedTypeMap: Record<
                    string,
                    { text: string; color: string }
                > = {
                    DEPOSIT: { text: '充值', color: 'blue' },
                    WITHDRAWAL: { text: '减款', color: 'red' },
                    TRANSFER: { text: '转账', color: 'green' },
                    BIND_ACCOUNT: { text: '绑定账户', color: 'purple' },
                    BIND_EMAIL: { text: '绑定邮箱', color: 'purple' },
                    BIND_PIXEL: { text: '绑定Pixel', color: 'purple' },
                    ZEROING: { text: '清零', color: 'orange' },
                    GOOGLE_ACCOUNT: { text: 'Google开户', color: 'cyan' },
                    FACEBOOK_ACCOUNT: { text: 'Facebook开户', color: 'blue' },
                    TIKTOK_ACCOUNT: { text: 'TikTok开户', color: 'black' }
                }

                // 先从主映射表查找，再从扩展映射表查找
                const typeInfo = typeMap[type as WorkOrderType] ||
                    extendedTypeMap[type as string] || {
                    text: type || '未知类型',
                    color: 'default'
                }
                return <Tag color={typeInfo.color}>{typeInfo.text}</Tag>
            },
            filters: [
                { text: '充值', value: WorkOrderType.DEPOSIT },
                { text: '减款', value: WorkOrderType.DEDUCTION },
                { text: '转账', value: WorkOrderType.TRANSFER },
                { text: '绑定', value: WorkOrderType.BIND },
                { text: '清零', value: 'ZEROING' }
            ],
            onFilter: (value, record) => record.type === value
        },
        {
            title: '账户名称',
            dataIndex: 'mediaAccountName',
            key: 'mediaAccountName',
            width: 140,
            render: (text, record) => text || (record as ExtendedWorkOrder).metadata?.mediaAccountName || '-'
        },
        {
            title: '媒体平台',
            dataIndex: 'mediaPlatform',
            key: 'mediaPlatform',
            width: 100,
            render: (platform, record) => {
                // 平台映射表
                const platformMap = {
                    1: { name: 'Facebook', color: '#1877F2' },
                    2: { name: 'Google', color: '#4285F4' },
                    3: { name: 'Meta', color: '#0081FB' },
                    5: { name: 'TikTok', color: '#000000' }
                }

                // 尝试从多个来源获取平台值
                let platformValue = platform;
                const extRecord = record as ExtendedWorkOrder;
                if (!platformValue && extRecord.metadata) {
                    // 尝试从metadata中获取
                    platformValue = extRecord.metadata.mediaPlatform ||
                        extRecord.metadata.mediaPlatformNumber ||
                        extRecord.metadata.platformType;
                }

                // 如果是工单子类型，也可以推断平台
                if (!platformValue && extRecord.workOrderSubtype) {
                    if (extRecord.workOrderSubtype === 'GOOGLE_ACCOUNT') platformValue = 2;
                    else if (extRecord.workOrderSubtype === 'FACEBOOK_ACCOUNT') platformValue = 1;
                    else if (extRecord.workOrderSubtype === 'TIKTOK_ACCOUNT') platformValue = 5;
                }

                // 确保平台值为数字
                platformValue = Number(platformValue);

                const platformInfo =
                    platformMap[platformValue as keyof typeof platformMap];

                return platformInfo ? (
                    <Tag color={platformInfo.color}>{platformInfo.name}</Tag>
                ) : (
                    <span>{platform || '-'}</span>
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
            width: 100,
            render: (text, record) => {
                // 从多个可能的源获取申请人信息
                const extRecord = record as ExtendedWorkOrder;
                const creator = text ||
                    extRecord.metadata?.createdBy ||
                    extRecord.metadata?.creator ||
                    extRecord.metadata?.applicant ||
                    extRecord.metadata?.userName ||
                    extRecord.metadata?.displayName;
                return creator || '-';
            }
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
            render: (_, record) => {
                // 判断是否为开户申请类型工单
                const extRecord = record as ExtendedWorkOrder;
                const isAccountApplication = isAccountApplicationWorkOrder(extRecord);

                return (
                    <Space size="small">
                        <Button
                            size="small"
                            onClick={() => handleViewDetail(record)}
                        >
                            查看
                        </Button>
                        {isAccountApplication ? (
                            extRecord.status === WorkOrderStatus.PROCESSING ?
                                null : // 处理中状态不显示修改按钮
                                <Button
                                    size="small"
                                    type="primary"
                                    onClick={() => handleEdit(extRecord)}
                                >
                                    修改
                                </Button>
                        ) : (
                            extRecord.status === WorkOrderStatus.PENDING && (
                                <>
                                    <Button
                                        size="small"
                                        type="primary"
                                        onClick={() => handleApprove(extRecord)}
                                    >
                                        通过
                                    </Button>
                                    <Button
                                        size="small"
                                        danger
                                        onClick={() => handleReject(extRecord)}
                                    >
                                        拒绝
                                    </Button>
                                </>
                            )
                        )}
                    </Space>
                )
            }
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

    // 处理分页变化
    const handlePaginationChange = (page: number, size: number) => {
        // 直接在函数内部使用新值进行查询，避免异步状态更新导致的问题
        const queryParams = {
            ...form.getFieldsValue(),
            page,
            pageSize: size
        }

        // 更新状态
        setCurrentPage(page)
        setPageSize(size)

        // 使用新页码直接执行搜索
        doSearch(queryParams)
    }

    // 处理标签页切换
    const handleTabChange = (activeKey: string) => {
        // 重置表单
        form.resetFields()
        // 重置页码
        setCurrentPage(1)
        // 先更新标签状态
        setActiveTab(activeKey)

        // 使用传入的activeKey而不是依赖状态变量activeTab
        // 构建查询参数
        const queryParams: any = { page: 1, pageSize }

        // 根据当前激活的标签添加状态过滤
        if (activeKey !== 'all') {
            if (activeKey === 'pending') {
                queryParams.status = WorkOrderStatus.PENDING
            } else if (activeKey === 'processing') {
                queryParams.status = WorkOrderStatus.PROCESSING
            } else if (activeKey === 'completed') {
                // 修改为单个查询条件，不使用数组
                queryParams.status = WorkOrderStatus.COMPLETED
            }
        }

        // 执行查询，使用新构建的查询参数
        doSearch(queryParams)
    }

    // 抽取实际执行搜索的函数，可以接收自定义参数
    const doSearch = async (params: any) => {
        setLoading(true)

        try {
            // 构建查询参数
            const queryParams: any = {
                page: params.page || currentPage,
                pageSize: params.pageSize || pageSize
            }

            // 使用传入的status参数，不依赖于activeTab
            if (params.status !== undefined) {
                queryParams.status = params.status
            }

            if (params.taskNumber) {
                queryParams.taskNumber = params.taskNumber
            }

            if (params.mediaAccountName) {
                queryParams.mediaAccountName = params.mediaAccountName
            }

            if (params.mediaAccountId) {
                queryParams.mediaAccountId = params.mediaAccountId
            }

            if (params.mediaPlatform) {
                queryParams.mediaPlatform = params.mediaPlatform
            }

            if (params.createdBy) {
                queryParams.createdBy = params.createdBy
            }

            if (params.dateRange && params.dateRange.length === 2) {
                queryParams.dateRange = {
                    start: new Date(params.dateRange[0].format('YYYY-MM-DD')),
                    end: new Date(params.dateRange[1].format('YYYY-MM-DD'))
                }
            }

            // 只有在明确选择了类型时才添加类型过滤
            if (params.type) {
                switch (params.type) {
                    case WorkOrderType.DEPOSIT:
                        queryParams.workOrderType = 'ACCOUNT_MANAGEMENT';
                        queryParams.workOrderSubtype = 'DEPOSIT';
                        break;
                    case WorkOrderType.DEDUCTION:
                        queryParams.workOrderType = 'ACCOUNT_MANAGEMENT';
                        queryParams.workOrderSubtype = 'WITHDRAWAL';
                        break;
                    case WorkOrderType.TRANSFER:
                        queryParams.workOrderType = 'ACCOUNT_MANAGEMENT';
                        queryParams.workOrderSubtype = 'TRANSFER';
                        break;
                    case WorkOrderType.BIND:
                        queryParams.workOrderType = 'ACCOUNT_MANAGEMENT';
                        queryParams.workOrderSubtype = [
                            'BIND_ACCOUNT',
                            'BIND_EMAIL',
                            'BIND_PIXEL'
                        ];
                        break;
                    case 'ZEROING':
                        queryParams.workOrderType = 'ACCOUNT_MANAGEMENT';
                        queryParams.workOrderSubtype = 'ZEROING';
                        break;
                    case 'ACCOUNT_APPLICATION':
                        queryParams.workOrderType = 'ACCOUNT_APPLICATION';
                        break;
                    case 'GOOGLE_ACCOUNT':
                        queryParams.workOrderType = 'ACCOUNT_APPLICATION';
                        queryParams.workOrderSubtype = 'GOOGLE_ACCOUNT';
                        break;
                    case 'FACEBOOK_ACCOUNT':
                        queryParams.workOrderType = 'ACCOUNT_APPLICATION';
                        queryParams.workOrderSubtype = 'FACEBOOK_ACCOUNT';
                        break;
                    case 'TIKTOK_ACCOUNT':
                        queryParams.workOrderType = 'ACCOUNT_APPLICATION';
                        queryParams.workOrderSubtype = 'TIKTOK_ACCOUNT';
                        break;
                }
            }

            // 调用服务端查询函数
            const response = await getWorkOrders(queryParams)

            if (response.success && response.data) {
                // 辅助函数解析metadata
                const parseMeta = (item: any): Record<string, any> => {
                    let metadata: Record<string, any> = {}
                    try {
                        if (typeof item.metadata === 'string') {
                            metadata = JSON.parse(item.metadata || '{}')
                        } else if (
                            item.metadata &&
                            typeof item.metadata === 'object'
                        ) {
                            metadata = item.metadata as Record<string, any>
                        }
                    } catch (e) {
                        metadata = {}
                    }
                    return metadata
                }

                // 转换数据结构以匹配WorkOrder接口
                const workOrders: ExtendedWorkOrder[] = response.data.items.map(
                    (item: any) => {
                        try {
                            // 从metadata中提取信息
                            const metadata = parseMeta(item)

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

                            // 确保金额字段为正确类型 (number或undefined)
                            const amount = metadata.amount
                                ? Number(metadata.amount)
                                : item.amount
                                    ? Number(item.amount)
                                    : undefined

                            // 提取申请人信息
                            const createdBy =
                                item.createdBy ||
                                metadata.createdBy ||
                                metadata.creator ||
                                metadata.applicant ||
                                metadata.userName ||
                                metadata.displayName ||
                                '未知'

                            // 提取工单编号
                            const taskNumber =
                                item.taskNumber ||
                                metadata.taskNumber ||
                                (item.workOrderSubtype ?
                                    `${item.workOrderSubtype.substring(0, 2)}-${item.id}` :
                                    item.id) ||
                                '';

                            return {
                                id: item.id,
                                type: (() => {
                                    // 根据workOrderType和workOrderSubtype映射到前端枚举
                                    if (
                                        item.workOrderType ===
                                        'ACCOUNT_MANAGEMENT'
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
                                            case 'ZEROING':
                                                return 'ZEROING'
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
                                createdBy,
                                updatedBy: item.updatedBy || '未知',
                                mediaAccountId: item.mediaAccountId || '',
                                mediaAccountName: mediaAccountName || '',
                                mediaPlatform: Number(mediaPlatform) || 0,
                                companyName:
                                    metadata.companyName ||
                                    item.companyName ||
                                    '',
                                amount,
                                dailyBudget: metadata.dailyBudget
                                    ? Number(metadata.dailyBudget)
                                    : undefined,
                                currency:
                                    metadata.currency || item.currency || 'USD',
                                remarks: item.remark || '',
                                taskId: item.taskId || item.thirdPartyTaskId,
                                reason: item.failureReason,
                                thirdPartyResponse: item.thirdPartyResponse,
                                workOrderSubtype: item.workOrderSubtype,
                                workOrderType: item.workOrderType,
                                metadata: metadata, // 添加元数据字段到工单对象
                                taskNumber: taskNumber
                            }
                        } catch (err) {
                            // 返回一个最小可用的工单对象
                            return {
                                id: item.id || `error-${Date.now()}`,
                                type: WorkOrderType.DEPOSIT,
                                status: WorkOrderStatus.PENDING,
                                mediaAccountId: '',
                                mediaAccountName: '数据错误',
                                mediaPlatform: 0,
                                createdAt: new Date().toLocaleString(),
                                updatedAt: new Date().toLocaleString(),
                                createdBy: '未知',
                                updatedBy: '未知',
                                companyName: '',
                                workOrderSubtype: '',
                                workOrderType: '',
                                metadata: {},
                                taskNumber: ''
                            }
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

            // 工单状态变更后刷新待处理数量
            if (params.updatePendingCount === true) {
                fetchPendingCount()
            }
        } catch (error) {
            message.error('查询失败，请稍后重试')
            setData([])
            setTotal(0)
        } finally {
            setLoading(false)
        }
    }

    // 查看详情
    const handleViewDetail = (record: ExtendedWorkOrder) => {
        setCurrentWorkOrder(record)
        setDetailVisible(true)
    }

    // 处理编辑工单
    const handleEdit = (record: ExtendedWorkOrder) => {
        // 首先查看详情
        setCurrentWorkOrder(record)
        setDetailVisible(true)
        // 在这里可以添加编辑工单的逻辑
        // 如有需要，可以后续实现更复杂的编辑功能
    }

    // 批准工单
    const handleApprove = (record: ExtendedWorkOrder) => {
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
                            result = await approveTransferWorkOrder(record.id)
                            break
                        case WorkOrderType.BIND: // 对应BIND_ACCOUNT
                            result = await approveAccountBindingWorkOrder({
                                workOrderId: record.id,
                                approvedBy: '管理员'
                            })
                            break
                        default:
                            // 处理ZEROING类型，因为它不在WorkOrderType枚举中
                            if (record.type === 'ZEROING') {
                                result = await approveZeroingWorkOrder({
                                    workOrderId: record.id,
                                    remarks: ''
                                })
                            } else {
                                throw new Error(
                                    `不支持的工单类型: ${record.type}`
                                )
                            }
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

                        // 重新加载当前数据
                        doSearch({ page: currentPage, pageSize, updatePendingCount: true })
                    } else {
                        message.error(result?.message || '审批工单失败')
                    }
                } catch (error) {
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
    const handleReject = (record: ExtendedWorkOrder) => {
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
                            result = await rejectTransferWorkOrder(
                                record.id,
                                reason
                            )
                            break
                        case WorkOrderType.BIND: // 对应BIND_ACCOUNT
                            result = await rejectAccountBindingWorkOrder({
                                workOrderId: record.id,
                                reason: reason,
                                rejectedBy: '管理员'
                            })
                            break
                        default:
                            // 处理ZEROING类型，因为它不在WorkOrderType枚举中
                            if (record.type === 'ZEROING') {
                                result = await rejectZeroingWorkOrder({
                                    workOrderId: record.id,
                                    reason: reason
                                })
                            } else {
                                throw new Error(
                                    `不支持的工单类型: ${record.type}`
                                )
                            }
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

                        // 重新加载当前数据
                        doSearch({ page: currentPage, pageSize, updatePendingCount: true })
                    } else {
                        message.error(result?.message || '拒绝工单失败')
                    }
                } catch (error) {
                    message.error(
                        error instanceof Error ? error.message : '拒绝工单失败'
                    )
                } finally {
                    setActionLoading(false)
                }
            }
        })
    }

    // 处理查询
    const handleSearch = async (values: SearchForm) => {
        // 重置页码，保持其他参数
        setCurrentPage(1)
        // 执行查询，携带表单中的所有筛选条件
        doSearch({ ...values, page: 1 })
    }

    // 处理重置
    const handleReset = () => {
        form.resetFields()
        setCurrentPage(1)
        doSearch({ page: 1 })
    }

    // 初始化
    useEffect(() => {
        // 只加载第一页，不添加任何筛选条件
        doSearch({ page: 1 })
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
                                name="taskNumber"
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
                                    {/* <Select.Option value={3}>
                                        Meta
                                    </Select.Option> */}
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
                                    <Select.Option value="ZEROING">
                                        清零
                                    </Select.Option>
                                    <Select.Option value="ACCOUNT_APPLICATION">
                                        开户申请
                                    </Select.Option>
                                    <Select.Option value="GOOGLE_ACCOUNT">
                                        Google开户
                                    </Select.Option>
                                    <Select.Option value="FACEBOOK_ACCOUNT">
                                        Facebook开户
                                    </Select.Option>
                                    <Select.Option value="TIKTOK_ACCOUNT">
                                        TikTok开户
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
                            (() => {
                                const extWorkOrder = currentWorkOrder as ExtendedWorkOrder;
                                const isAccountApplication = isAccountApplicationWorkOrder(extWorkOrder);

                                if (isAccountApplication) {
                                    return (
                                        extWorkOrder.status === WorkOrderStatus.PROCESSING ?
                                            null : // 处理中状态不显示修改按钮
                                            <Button
                                                key="edit"
                                                type="primary"
                                                loading={actionLoading}
                                                onClick={() => handleEdit(extWorkOrder)}
                                            >
                                                修改
                                            </Button>
                                    );
                                } else {
                                    return (
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
                                    );
                                }
                            })()
                        )
                    ]}
                    width={700}
                >
                    {currentWorkOrder && (
                        <Descriptions bordered column={2}>
                            <Descriptions.Item label="工单编号" span={2}>
                                {currentWorkOrder.taskNumber}
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
