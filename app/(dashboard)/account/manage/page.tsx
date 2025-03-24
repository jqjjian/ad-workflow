'use client'

import { useState, useEffect } from 'react'
import {
    message,
    Badge,
    Modal,
    InputNumber,
    Form as AntdForm,
    Descriptions,
    Switch,
    Radio
} from 'antd'
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
import { createDepositWorkOrder } from '@/app/actions/workorder/account-management/deposit'
import { createZeroingWorkOrder } from '@/app/actions/workorder/account-management/zeroing'
import { createWithdrawalWorkOrder } from '@/app/actions/workorder/account-management/withdrawal'
import { createTransferWorkOrder } from '@/app/actions/workorder/account-management/transfer'
import { createAccountBindingWorkOrder } from '@/app/actions/workorder/account-management/account-binding'
import { createEmailBindingWorkOrder } from '@/app/actions/workorder/account-management/email-binding'
import {
    MediaAccount,
    MediaAccountResponse,
    MediaAccountSearch
} from '@/schemas/mediaAccount'
import Link from 'next/link'

const { Title } = Typography
const { RangePicker } = DatePicker

// 扩展MediaAccount类型，添加uniqueId属性
interface EnhancedMediaAccount extends MediaAccount {
    uniqueId: string
}

// 生成唯一ID的辅助函数
const generateUniqueId = () => {
    return (
        'id_' +
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15)
    )
}

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

// 测试数据
const mockData = {
    mediaAccounts: [
        {
            uniqueId: generateUniqueId(),
            mediaAccountId: '74596062746538148011',
            mediaAccountName: 'yaochuhai',
            mediaPlatform: 5,
            companyName: '要出海（广州）科技管理有限公司',
            status: 2,
            balance: '0.00',
            deductibleAmount: null,
            currency: 'USD',
            grantBalance: '0',
            validGrantBalance: '0.00',
            minDailyBudget: null,
            disableReason: null,
            consumeAmount: '120.50',
            conversionAmount: '45',
            conversionRate: '37.5'
        },
        {
            uniqueId: generateUniqueId(),
            mediaAccountId: '74596062746538148011',
            mediaAccountName: 'globalreach',
            mediaPlatform: 1,
            companyName: '要出海（广州）科技管理有限公司',
            status: 2,
            balance: '1500.00',
            deductibleAmount: null,
            currency: 'USD',
            grantBalance: '200',
            validGrantBalance: '200.00',
            minDailyBudget: null,
            disableReason: null,
            consumeAmount: '750.25',
            conversionAmount: '180',
            conversionRate: '24.0'
        },
        {
            uniqueId: generateUniqueId(),
            mediaAccountId: '74596062746538148011',
            mediaAccountName: 'adstechasia',
            mediaPlatform: 2,
            companyName: '广州科技有限公司',
            status: 1,
            balance: '2500.00',
            deductibleAmount: null,
            currency: 'USD',
            grantBalance: '500',
            validGrantBalance: '500.00',
            minDailyBudget: null,
            disableReason: null,
            consumeAmount: '0.00',
            conversionAmount: '0',
            conversionRate: '0'
        },
        {
            uniqueId: generateUniqueId(),
            mediaAccountId: '74596062746538148011',
            mediaAccountName: 'marketexpand',
            mediaPlatform: 3,
            companyName: '广州科技有限公司',
            status: 3,
            balance: '0.00',
            deductibleAmount: null,
            currency: 'USD',
            grantBalance: '0',
            validGrantBalance: '0.00',
            minDailyBudget: null,
            disableReason: '违反平台规则',
            consumeAmount: '3200.75',
            conversionAmount: '850',
            conversionRate: '26.5'
        },
        {
            uniqueId: generateUniqueId(),
            mediaAccountId: '74596062746538148011',
            mediaAccountName: 'digitalpromo',
            mediaPlatform: 5,
            companyName: '深圳数字推广有限公司',
            status: 4,
            balance: '0.00',
            deductibleAmount: null,
            currency: 'USD',
            grantBalance: '0',
            validGrantBalance: '0.00',
            minDailyBudget: null,
            disableReason: '账户到期',
            consumeAmount: '1850.50',
            conversionAmount: '420',
            conversionRate: '22.7'
        }
    ],
    pageSize: 10,
    total: 5,
    pages: 1,
    pageNumber: 1
}

// 是否使用测试数据
const USE_MOCK_DATA = true

export default function AccountManagePage() {
    const [form] = Form.useForm<AccountSearchForm>()
    const [rechargeForm] = AntdForm.useForm()
    const [withdrawalForm] = AntdForm.useForm()
    const [transferForm] = AntdForm.useForm()
    const [bindingForm] = AntdForm.useForm()
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<EnhancedMediaAccount[]>([])
    const [selectedRows, setSelectedRows] = useState<EnhancedMediaAccount[]>([])
    const [total, setTotal] = useState(0)
    const [rechargeModalVisible, setRechargeModalVisible] = useState(false)
    const [withdrawalModalVisible, setWithdrawalModalVisible] = useState(false)
    const [transferModalVisible, setTransferModalVisible] = useState(false)
    const [bindingModalVisible, setBindingModalVisible] = useState(false)
    const [rechargeLoading, setRechargeLoading] = useState(false)
    const [withdrawalLoading, setWithdrawalLoading] = useState(false)
    const [transferLoading, setTransferLoading] = useState(false)
    const [bindingLoading, setBindingLoading] = useState(false)
    const [currentAccount, setCurrentAccount] =
        useState<EnhancedMediaAccount | null>(null)
    const [transferAccounts, setTransferAccounts] = useState<
        EnhancedMediaAccount[]
    >([])
    const [moveAllBalance, setMoveAllBalance] = useState(false)
    const [bindingType, setBindingType] = useState<'mcc' | 'email'>('mcc')

    // 表格列定义
    const columns: TableColumnsType<EnhancedMediaAccount> = [
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
            key: 'conversionRate',
            render: (rate) => (rate ? `${rate}%` : '0%')
        },
        {
            title: '操作',
            key: 'action',
            fixed: 'right',
            width: 280,
            render: (_, record) => (
                <Space size="small">
                    <Button
                        size="small"
                        type="primary"
                        disabled={record.status !== 2} // 只有生效中的账户才能操作
                        onClick={() => handleRecharge(record)}
                    >
                        充值
                    </Button>
                    <Button
                        size="small"
                        danger
                        disabled={
                            record.status !== 2 || Number(record.balance) <= 0
                        } // 余额为0不能减款
                        onClick={() => handleDeduction(record)}
                    >
                        减款
                    </Button>
                    <Button
                        size="small"
                        disabled={record.status !== 2}
                        onClick={() => handleTransfer(record)}
                    >
                        转账
                    </Button>
                    <Button
                        size="small"
                        disabled={record.status !== 2}
                        onClick={() => handleBind(record)}
                    >
                        绑定
                    </Button>
                    <Button
                        size="small"
                        type="default"
                        danger
                        disabled={
                            record.status !== 2 || Number(record.balance) <= 0
                        } // 余额为0不能清零
                        onClick={() => handleZeroing(record)}
                    >
                        清零
                    </Button>
                </Space>
            )
        }
    ]

    // 处理查询
    const handleSearch = async (values: AccountSearchForm) => {
        setLoading(true)
        try {
            if (USE_MOCK_DATA) {
                // 使用模拟数据进行过滤
                setTimeout(() => {
                    let filteredData = [...mockData.mediaAccounts]

                    // 根据查询条件进行过滤
                    if (values.mediaAccountId) {
                        filteredData = filteredData.filter((account) =>
                            account.mediaAccountId.includes(
                                values.mediaAccountId || ''
                            )
                        )
                    }

                    if (values.mediaAccountName) {
                        filteredData = filteredData.filter((account) =>
                            account.mediaAccountName.includes(
                                values.mediaAccountName || ''
                            )
                        )
                    }

                    if (values.mediaPlatform) {
                        filteredData = filteredData.filter(
                            (account) =>
                                account.mediaPlatform === values.mediaPlatform
                        )
                    }

                    if (values.companyName) {
                        filteredData = filteredData.filter((account) =>
                            account.companyName.includes(
                                values.companyName || ''
                            )
                        )
                    }

                    if (values.status) {
                        filteredData = filteredData.filter(
                            (account) => account.status === values.status
                        )
                    }

                    // 处理分页
                    const pageSize = values.pageSize || 10
                    const pageNumber = values.pageNumber || 1
                    const startIndex = (pageNumber - 1) * pageSize
                    const endIndex = Math.min(
                        startIndex + pageSize,
                        filteredData.length
                    )
                    const paginatedData = filteredData.slice(
                        startIndex,
                        endIndex
                    )

                    // 数据格式化处理
                    const processedData = paginatedData.map((account) => ({
                        ...account,
                        balance: parseFloat(account.balance?.toString() || '0'),
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
                    })) as EnhancedMediaAccount[]

                    setData(processedData)
                    setTotal(filteredData.length)
                    setLoading(false)
                }, 500) // 模拟网络延迟

                return
            }

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
                            uniqueId: generateUniqueId(), // 为每个后端返回的数据添加唯一ID
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
                    ) as EnhancedMediaAccount[]

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
            if (!USE_MOCK_DATA) {
                setLoading(false)
            }
        }
    }

    // 处理充值
    const handleRecharge = (record: EnhancedMediaAccount) => {
        setCurrentAccount(record)
        rechargeForm.resetFields()
        setRechargeModalVisible(true)
    }

    // 提交充值申请
    const handleRechargeSubmit = async () => {
        try {
            if (!currentAccount) return

            // 表单验证
            const values = await rechargeForm.validateFields()
            setRechargeLoading(true)

            // 调用创建充值工单API
            const result = await createDepositWorkOrder({
                mediaAccountId: currentAccount.mediaAccountId,
                mediaAccountName: currentAccount.mediaAccountName,
                mediaPlatform: currentAccount.mediaPlatform,
                companyName: currentAccount.companyName,
                amount: values.amount,
                dailyBudget: values.dailyBudget,
                remarks: values.remarks
            })

            if (result.success) {
                message.success(result.message || '充值工单创建成功')
                setRechargeModalVisible(false)
                // 刷新数据
                const formValues = form.getFieldsValue()
                handleSearch(formValues)
            } else {
                message.error(result.message || '充值工单创建失败')
            }
        } catch (error) {
            console.error('提交充值申请失败:', error)
            message.error('提交失败，请检查表单并重试')
        } finally {
            setRechargeLoading(false)
        }
    }

    // 处理减款
    const handleDeduction = (record: EnhancedMediaAccount) => {
        // 增加余额检查，防止执行时余额为0
        if (Number(record.balance) <= 0) {
            message.warning('账户余额为0，无法进行减款操作')
            return
        }
        setCurrentAccount(record)
        withdrawalForm.resetFields()
        setWithdrawalModalVisible(true)
    }

    // 提交减款申请
    const handleWithdrawalSubmit = async () => {
        try {
            if (!currentAccount) return

            // 表单验证
            const values = await withdrawalForm.validateFields()
            setWithdrawalLoading(true)

            // 调用创建减款工单API
            const result = await createWithdrawalWorkOrder({
                mediaAccountId: currentAccount.mediaAccountId,
                mediaPlatform: currentAccount.mediaPlatform.toString(),
                mediaAccountName: currentAccount.mediaAccountName,
                amount: values.amount.toString(),
                currency: currentAccount.currency || 'USD',
                remarks: values.remarks
            })

            if (result.success) {
                message.success(result.message || '减款工单创建成功')
                setWithdrawalModalVisible(false)
                // 刷新数据
                const formValues = form.getFieldsValue()
                handleSearch(formValues)
            } else {
                message.error(result.message || '减款工单创建失败')
            }
        } catch (error) {
            console.error('提交减款申请失败:', error)
            message.error('提交失败，请检查表单并重试')
        } finally {
            setWithdrawalLoading(false)
        }
    }

    // 处理转账
    const handleTransfer = (record: EnhancedMediaAccount) => {
        setCurrentAccount(record)
        transferForm.resetFields()
        // 设置表单默认值
        transferForm.setFieldsValue({
            mediaPlatform: record.mediaPlatform
        })
        setMoveAllBalance(false)
        setTransferModalVisible(true)

        // 初始筛选可用于转账的账户
        updateEligibleAccounts(record.mediaPlatform)
    }

    // 根据选择的媒体平台更新可用于转账的账户列表
    const updateEligibleAccounts = (platform: number) => {
        const eligibleAccounts = data.filter(
            (account) =>
                account.uniqueId !== currentAccount?.uniqueId &&
                account.mediaPlatform === platform &&
                account.status === 2
        )
        setTransferAccounts(eligibleAccounts)
    }

    // 提交转账申请
    const handleTransferSubmit = async () => {
        try {
            if (!currentAccount) return

            // 表单验证
            const values = await transferForm.validateFields()
            setTransferLoading(true)

            // 获取目标账户信息（假设通过values.targetAccountId可以获取）
            // 需要从目标账户选择下拉框中获取完整的账户信息
            const selectedTargetAccount = transferAccounts.find(
                (acc) => acc.mediaAccountId === values.targetAccountId
            )

            // 调用创建转账工单API
            const result = await createTransferWorkOrder({
                sourceAccountId: currentAccount.mediaAccountId,
                sourceAccountName: currentAccount.mediaAccountName, // 添加源账户名称
                targetAccountId: values.targetAccountId,
                targetAccountName:
                    selectedTargetAccount?.mediaAccountName ||
                    `媒体账户${values.targetAccountId}`, // 添加目标账户名称
                mediaPlatform: currentAccount.mediaPlatform.toString(), // 使用currentAccount中的mediaPlatform
                targetMediaPlatform: values.mediaPlatform.toString(), // 目标平台可能与源平台不同
                amount: moveAllBalance ? undefined : values.amount?.toString(),
                currency: currentAccount.currency || 'USD',
                isMoveAllBalance: moveAllBalance,
                remarks: values.remarks
            })

            if (result.success) {
                message.success(result.message || '转账工单创建成功')
                setTransferModalVisible(false)
                // 刷新数据
                const formValues = form.getFieldsValue()
                handleSearch(formValues)
            } else {
                message.error(result.message || '转账工单创建失败')
            }
        } catch (error) {
            console.error('提交转账申请失败:', error)
            message.error('提交失败，请检查表单并重试')
        } finally {
            setTransferLoading(false)
        }
    }

    // 处理绑定
    const handleBind = (record: EnhancedMediaAccount) => {
        setCurrentAccount(record)
        bindingForm.resetFields()
        setBindingType('mcc') // 默认选择MCC绑定
        setBindingModalVisible(true)
    }

    // 提交绑定申请
    const handleBindingSubmit = async () => {
        try {
            if (!currentAccount) return

            // 表单验证
            const values = await bindingForm.validateFields()
            setBindingLoading(true)

            if (bindingType === 'mcc') {
                // 调用创建账户绑定工单API (MCC绑定)
                const result = await createAccountBindingWorkOrder({
                    mediaAccountId: currentAccount.mediaAccountId,
                    mediaAccountName: currentAccount.mediaAccountName,
                    mediaPlatform: currentAccount.mediaPlatform,
                    companyName: currentAccount.companyName,
                    mccId: values.mccId,
                    bindingType: 'bind',
                    remarks: values.remarks
                })

                if (result.success) {
                    message.success(result.message || 'MCC绑定工单创建成功')
                    setBindingModalVisible(false)
                    // 刷新数据
                    const formValues = form.getFieldsValue()
                    handleSearch(formValues)
                } else {
                    message.error(result.message || 'MCC绑定工单创建失败')
                }
            } else {
                // 调用创建邮箱绑定工单API
                const result = await createEmailBindingWorkOrder({
                    mediaAccountId: currentAccount.mediaAccountId,
                    mediaPlatform: currentAccount.mediaPlatform,
                    value: values.email,
                    role: values.role
                })

                // 邮箱绑定API返回的格式与MCC绑定不同，需要做适配
                if (result.code === 'SUCCESS' || !result.code) {
                    // 如果是成功
                    message.success(result.message || '邮箱绑定工单创建成功')
                    setBindingModalVisible(false)
                    // 刷新数据
                    const formValues = form.getFieldsValue()
                    handleSearch(formValues)
                } else {
                    message.error(result.message || '邮箱绑定工单创建失败')
                }
            }
        } catch (error) {
            console.error('提交绑定申请失败:', error)
            message.error('提交失败，请检查表单并重试')
        } finally {
            setBindingLoading(false)
        }
    }

    // 处理清零
    const handleZeroing = (record: EnhancedMediaAccount) => {
        // 增加余额检查，防止执行时余额为0
        if (Number(record.balance) <= 0) {
            message.warning('账户余额为0，无法进行清零操作')
            return
        }

        Modal.confirm({
            title: '确认清零操作',
            content: `您确定要对账户 ${record.mediaAccountName} 进行清零操作吗？此操作会将账户余额清零。`,
            okText: '确认',
            okType: 'danger',
            cancelText: '取消',
            onOk: async () => {
                try {
                    // 调用创建清零工单API
                    const result = await createZeroingWorkOrder({
                        mediaAccountId: record.mediaAccountId,
                        mediaAccountName: record.mediaAccountName,
                        mediaPlatform: record.mediaPlatform,
                        companyName: record.companyName
                    })

                    if (result.success) {
                        message.success(result.message || '清零工单创建成功')
                        // 刷新数据
                        const formValues = form.getFieldsValue()
                        handleSearch(formValues)
                    } else {
                        message.error(result.message || '清零工单创建失败')
                    }
                } catch (error) {
                    console.error('创建清零工单失败:', error)
                    message.error('操作失败，请稍后重试')
                }
            }
        })
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
                <Flex justify="space-between" align="center" className="mb-4">
                    <Title level={3} className="m-0">
                        账户管理
                    </Title>
                    <Button type="primary">
                        <Link href="/account/record" className="text-white">
                            申请记录
                        </Link>
                    </Button>
                </Flex>
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
                    rowKey="uniqueId"
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

                {/* 充值弹窗 */}
                <Modal
                    title="账户充值"
                    open={rechargeModalVisible}
                    onCancel={() => setRechargeModalVisible(false)}
                    footer={[
                        <Button
                            key="cancel"
                            onClick={() => setRechargeModalVisible(false)}
                        >
                            取消
                        </Button>,
                        <Button
                            key="submit"
                            type="primary"
                            loading={rechargeLoading}
                            onClick={handleRechargeSubmit}
                        >
                            提交
                        </Button>
                    ]}
                    width={600}
                >
                    {currentAccount && (
                        <>
                            <Descriptions
                                title="账户信息"
                                bordered
                                column={1}
                                size="small"
                                style={{ marginBottom: 20 }}
                            >
                                <Descriptions.Item label="账户名称">
                                    {currentAccount.mediaAccountName}
                                </Descriptions.Item>
                                <Descriptions.Item label="媒体平台">
                                    {(() => {
                                        const platforms = {
                                            1: 'Facebook',
                                            2: 'Google',
                                            3: 'Meta',
                                            5: 'TikTok'
                                        }
                                        return (
                                            platforms[
                                                currentAccount.mediaPlatform as keyof typeof platforms
                                            ] || '未知'
                                        )
                                    })()}
                                </Descriptions.Item>
                                <Descriptions.Item label="币种">
                                    {currentAccount.currency || 'USD'}
                                </Descriptions.Item>
                                <Descriptions.Item label="账户余额">
                                    {currentAccount.balance}{' '}
                                    {currentAccount.currency || 'USD'}
                                </Descriptions.Item>
                            </Descriptions>

                            <AntdForm form={rechargeForm} layout="vertical">
                                <AntdForm.Item
                                    label="充值金额"
                                    name="amount"
                                    rules={[
                                        {
                                            required: true,
                                            message: '请输入充值金额'
                                        }
                                    ]}
                                >
                                    <InputNumber
                                        style={{ width: '100%' }}
                                        placeholder="请输入充值金额"
                                        min={0}
                                        precision={2}
                                        prefix={
                                            currentAccount.currency || 'USD'
                                        }
                                    />
                                </AntdForm.Item>
                                <AntdForm.Item
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
                                        placeholder="请输入每日预算"
                                        min={0}
                                        precision={2}
                                        prefix={
                                            currentAccount.currency || 'USD'
                                        }
                                    />
                                </AntdForm.Item>
                                <AntdForm.Item label="备注" name="remarks">
                                    <Input.TextArea
                                        rows={4}
                                        placeholder="请输入充值原因或备注信息"
                                    />
                                </AntdForm.Item>
                            </AntdForm>
                        </>
                    )}
                </Modal>

                {/* 减款弹窗 */}
                <Modal
                    title="账户减款"
                    open={withdrawalModalVisible}
                    onCancel={() => setWithdrawalModalVisible(false)}
                    footer={[
                        <Button
                            key="cancel"
                            onClick={() => setWithdrawalModalVisible(false)}
                        >
                            取消
                        </Button>,
                        <Button
                            key="submit"
                            type="primary"
                            danger
                            loading={withdrawalLoading}
                            onClick={handleWithdrawalSubmit}
                        >
                            提交
                        </Button>
                    ]}
                    width={600}
                >
                    {currentAccount && (
                        <>
                            <Descriptions
                                title="账户信息"
                                bordered
                                column={1}
                                size="small"
                                style={{ marginBottom: 20 }}
                            >
                                <Descriptions.Item label="账户名称">
                                    {currentAccount.mediaAccountName}
                                </Descriptions.Item>
                                <Descriptions.Item label="账户ID">
                                    {currentAccount.mediaAccountId}
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
                                                currentAccount.mediaPlatform as keyof typeof platformMap
                                            ] || '未知'
                                        )
                                    })()}
                                </Descriptions.Item>
                                <Descriptions.Item label="公司主体">
                                    {currentAccount.companyName}
                                </Descriptions.Item>
                                <Descriptions.Item label="当前余额">{`${currentAccount.balance} ${currentAccount.currency}`}</Descriptions.Item>
                            </Descriptions>

                            <AntdForm
                                form={withdrawalForm}
                                labelCol={{ span: 6 }}
                                wrapperCol={{ span: 16 }}
                            >
                                <AntdForm.Item
                                    label="减款金额"
                                    name="amount"
                                    rules={[
                                        {
                                            required: true,
                                            message: '请输入减款金额'
                                        },
                                        {
                                            type: 'number',
                                            min: 0.01,
                                            max: Number(currentAccount.balance),
                                            message: `金额必须大于0且不超过当前余额${currentAccount.balance}`
                                        }
                                    ]}
                                >
                                    <InputNumber
                                        style={{ width: '100%' }}
                                        placeholder="请输入减款金额"
                                        precision={2}
                                        addonAfter={
                                            currentAccount.currency || 'USD'
                                        }
                                        max={Number(currentAccount.balance)}
                                    />
                                </AntdForm.Item>

                                <AntdForm.Item label="备注" name="remarks">
                                    <Input.TextArea
                                        rows={4}
                                        placeholder="请输入减款原因或备注信息"
                                    />
                                </AntdForm.Item>
                            </AntdForm>
                        </>
                    )}
                </Modal>

                {/* 转账弹窗 */}
                <Modal
                    title="账户转账"
                    open={transferModalVisible}
                    onCancel={() => setTransferModalVisible(false)}
                    footer={[
                        <Button
                            key="cancel"
                            onClick={() => setTransferModalVisible(false)}
                        >
                            取消
                        </Button>,
                        <Button
                            key="submit"
                            type="primary"
                            loading={transferLoading}
                            onClick={handleTransferSubmit}
                        >
                            提交
                        </Button>
                    ]}
                    width={600}
                >
                    {currentAccount && (
                        <>
                            <Descriptions
                                title="源账户信息"
                                bordered
                                column={1}
                                size="small"
                                style={{ marginBottom: 20 }}
                            >
                                <Descriptions.Item label="账户名称">
                                    {currentAccount.mediaAccountName}
                                </Descriptions.Item>
                                <Descriptions.Item label="账户ID">
                                    {currentAccount.mediaAccountId}
                                </Descriptions.Item>
                                <Descriptions.Item label="媒体平台">
                                    {(() => {
                                        const platformMap = {
                                            1: 'Facebook',
                                            2: 'Google',
                                            3: 'Meta',
                                            5: 'TikTok',
                                            7: 'Microsoft Advertising'
                                        }
                                        return (
                                            platformMap[
                                                currentAccount.mediaPlatform as keyof typeof platformMap
                                            ] || '未知'
                                        )
                                    })()}
                                </Descriptions.Item>
                                <Descriptions.Item label="当前余额">{`${currentAccount.balance} ${currentAccount.currency}`}</Descriptions.Item>
                            </Descriptions>

                            <AntdForm
                                form={transferForm}
                                labelCol={{ span: 6 }}
                                wrapperCol={{ span: 16 }}
                            >
                                <AntdForm.Item
                                    label="目标账户"
                                    name="targetAccountId"
                                    rules={[
                                        {
                                            required: true,
                                            message: '请选择目标账户'
                                        }
                                    ]}
                                >
                                    <Select placeholder="请选择转账目标账户">
                                        {transferAccounts.map((account) => (
                                            <Select.Option
                                                key={account.mediaAccountId}
                                                value={account.mediaAccountId}
                                            >
                                                {account.mediaAccountName} (
                                                {account.mediaAccountId})
                                            </Select.Option>
                                        ))}
                                    </Select>
                                </AntdForm.Item>

                                <AntdForm.Item
                                    label="媒体平台"
                                    name="mediaPlatform"
                                    initialValue={currentAccount.mediaPlatform}
                                    rules={[
                                        {
                                            required: true,
                                            message: '请选择媒体平台'
                                        }
                                    ]}
                                >
                                    <Select
                                        placeholder="请选择媒体平台"
                                        onChange={(value) =>
                                            updateEligibleAccounts(value)
                                        }
                                    >
                                        <Select.Option value={1}>
                                            Facebook
                                        </Select.Option>
                                        <Select.Option value={2}>
                                            Google
                                        </Select.Option>
                                        <Select.Option value={7}>
                                            Microsoft Advertising
                                        </Select.Option>
                                    </Select>
                                </AntdForm.Item>

                                <AntdForm.Item
                                    label="转移全部余额"
                                    name="moveAllBalance"
                                >
                                    <Switch
                                        checked={moveAllBalance}
                                        onChange={(checked) =>
                                            setMoveAllBalance(checked)
                                        }
                                    />
                                </AntdForm.Item>

                                {!moveAllBalance && (
                                    <AntdForm.Item
                                        label="转账金额"
                                        name="amount"
                                        rules={[
                                            {
                                                required: !moveAllBalance,
                                                message: '请输入转账金额'
                                            },
                                            {
                                                type: 'number',
                                                min: 0.01,
                                                max: Number(
                                                    currentAccount.balance
                                                ),
                                                message: `金额必须大于0且不超过当前余额${currentAccount.balance}`
                                            }
                                        ]}
                                    >
                                        <InputNumber
                                            style={{ width: '100%' }}
                                            placeholder="请输入转账金额"
                                            precision={2}
                                            addonAfter={
                                                currentAccount.currency || 'USD'
                                            }
                                            max={Number(currentAccount.balance)}
                                            disabled={moveAllBalance}
                                        />
                                    </AntdForm.Item>
                                )}

                                <AntdForm.Item label="备注" name="remarks">
                                    <Input.TextArea
                                        rows={4}
                                        placeholder="请输入转账原因或备注信息"
                                    />
                                </AntdForm.Item>
                            </AntdForm>
                        </>
                    )}
                </Modal>

                {/* 账户绑定弹窗 */}
                <Modal
                    title="账户绑定"
                    open={bindingModalVisible}
                    onCancel={() => setBindingModalVisible(false)}
                    footer={[
                        <Button
                            key="cancel"
                            onClick={() => setBindingModalVisible(false)}
                        >
                            取消
                        </Button>,
                        <Button
                            key="submit"
                            type="primary"
                            loading={bindingLoading}
                            onClick={handleBindingSubmit}
                        >
                            提交
                        </Button>
                    ]}
                    width={600}
                >
                    {currentAccount && (
                        <>
                            <Descriptions
                                title="账户信息"
                                bordered
                                column={1}
                                size="small"
                                style={{ marginBottom: 20 }}
                            >
                                <Descriptions.Item label="账户名称">
                                    {currentAccount.mediaAccountName}
                                </Descriptions.Item>
                                <Descriptions.Item label="账户ID">
                                    {currentAccount.mediaAccountId}
                                </Descriptions.Item>
                                <Descriptions.Item label="媒体平台">
                                    {(() => {
                                        const platformMap = {
                                            1: 'Facebook',
                                            2: 'Google',
                                            3: 'Meta',
                                            5: 'TikTok',
                                            7: 'Microsoft Advertising'
                                        }
                                        return (
                                            platformMap[
                                                currentAccount.mediaPlatform as keyof typeof platformMap
                                            ] || '未知'
                                        )
                                    })()}
                                </Descriptions.Item>
                                <Descriptions.Item label="公司主体">
                                    {currentAccount.companyName}
                                </Descriptions.Item>
                            </Descriptions>

                            <AntdForm
                                form={bindingForm}
                                labelCol={{ span: 6 }}
                                wrapperCol={{ span: 16 }}
                            >
                                <AntdForm.Item
                                    label="绑定类型"
                                    name="bindingType"
                                    initialValue="mcc"
                                >
                                    <Radio.Group
                                        onChange={(e) =>
                                            setBindingType(e.target.value)
                                        }
                                        value={bindingType}
                                    >
                                        <Radio value="mcc">MCC绑定</Radio>
                                        <Radio value="email">邮箱绑定</Radio>
                                    </Radio.Group>
                                </AntdForm.Item>

                                {bindingType === 'mcc' ? (
                                    <AntdForm.Item
                                        label="MCC ID"
                                        name="mccId"
                                        rules={[
                                            {
                                                required: true,
                                                message: '请输入MCC ID'
                                            }
                                        ]}
                                    >
                                        <Input placeholder="请输入要绑定的MCC ID" />
                                    </AntdForm.Item>
                                ) : (
                                    <>
                                        <AntdForm.Item
                                            label="邮箱地址"
                                            name="email"
                                            rules={[
                                                {
                                                    required: true,
                                                    message: '请输入邮箱地址'
                                                },
                                                {
                                                    type: 'email',
                                                    message:
                                                        '请输入有效的邮箱地址'
                                                }
                                            ]}
                                        >
                                            <Input placeholder="请输入要绑定的邮箱地址" />
                                        </AntdForm.Item>
                                        <AntdForm.Item
                                            label="授权角色"
                                            name="role"
                                            rules={[
                                                {
                                                    required: true,
                                                    message: '请选择授权角色'
                                                }
                                            ]}
                                        >
                                            <Select placeholder="请选择授权角色">
                                                <Select.Option value={10}>
                                                    查看权限
                                                </Select.Option>
                                                <Select.Option value={20}>
                                                    标准权限
                                                </Select.Option>
                                                <Select.Option value={30}>
                                                    管理员权限
                                                </Select.Option>
                                            </Select>
                                        </AntdForm.Item>
                                    </>
                                )}

                                <AntdForm.Item label="备注" name="remarks">
                                    <Input.TextArea
                                        rows={4}
                                        placeholder={`请输入${bindingType === 'mcc' ? 'MCC' : '邮箱'}绑定原因或备注信息`}
                                    />
                                </AntdForm.Item>
                            </AntdForm>
                        </>
                    )}
                </Modal>
            </ConfigProvider>
        </StyleProvider>
    )
}
