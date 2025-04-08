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
    // type TableProps,
    message,
    // Switch,
    Modal
} from 'antd'
import { ConfigProvider } from 'antd'
import { StyleProvider } from '@ant-design/cssinjs'
import { ApplyRecordData } from '@/schemas'
import {
    getAccountApplicationRecords,
    QueryApplyRecordDto,
    bindExternalTaskIdToWorkOrder
} from '@/app/actions/workorder/account-application'
import type { MediaAccountInfo } from '@/schemas'
import { useRouter } from 'next/navigation'
import { InfoCircleOutlined } from '@ant-design/icons'
import { useSession } from 'next-auth/react'
// import EditApplicationModal from '@/app/components/account-application/EditApplicationModal'
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
    10: { color: 'default', text: '审核中' },
    20: { color: 'processing', text: '待修改' },
    30: { color: 'success', text: '已通过' },
    40: { color: 'error', text: '已拒绝' }
}

// 添加一个工具函数清理参数对象
const cleanQueryParams = (params: any): any => {
    // 创建一个新对象来存储清理后的参数
    const cleanedParams: any = {}

    // 遍历所有参数
    Object.entries(params).forEach(([key, value]) => {
        // 跳过分页参数的检查，这些参数始终需要发送
        if (key === 'page' || key === 'pageSize') {
            cleanedParams[key] = value
            return
        }

        // 检查值是否有效
        if (value === null || value === undefined) {
            // 跳过null或undefined值
            return
        }

        // 处理字符串
        if (typeof value === 'string' && value.trim() === '') {
            // 跳过空字符串
            return
        }

        // 处理数组
        if (Array.isArray(value)) {
            if (value.length === 0) {
                // 跳过空数组
                return
            }

            // 过滤数组中的空值
            const filteredArray = value.filter(
                (item) =>
                    item !== null &&
                    item !== undefined &&
                    !(typeof item === 'string' && item.trim() === '')
            )

            if (filteredArray.length === 0) {
                // 如果过滤后数组为空，则跳过
                return
            }

            cleanedParams[key] = filteredArray
            return
        }

        // 处理对象
        if (typeof value === 'object') {
            // 递归清理嵌套对象
            const cleanedValue = cleanQueryParams(value)

            // 如果清理后对象为空，则跳过
            if (Object.keys(cleanedValue).length === 0) {
                return
            }

            cleanedParams[key] = cleanedValue
            return
        }

        // 其他值类型直接保留
        cleanedParams[key] = value
    })

    return cleanedParams
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
    const { data: session } = useSession()

    useEffect(() => {
        // Set loading to true before the initial data fetch
        setLoading(true)
        onFinish(initialValues)
    }, [])

    const onFinish = async (values: QueryApplyRecordDto) => {
        // Set loading to true at the beginning of data fetching
        setLoading(true)

        try {
            // 处理company对象
            if (values.company) {
                const company = values.company
                const hasValidCompanyField = Object.values(company).some(
                    (value) =>
                        value !== undefined && value !== null && value !== ''
                )

                if (!hasValidCompanyField) {
                    // 如果company对象没有有效字段，从参数中删除整个对象
                    delete values.company
                }
            }

            // 继续处理其他参数...
            const cleanedParams = cleanQueryParams({
                ...values,
                page: pagination.page,
                pageSize: pagination.pageSize
            })

            // 使用清理后的参数执行查询
            const response = await getAccountApplicationRecords(cleanedParams)

            if (response.success) {
                console.log('查询响应:', response)
                setData(response?.data as ApplyRecordData)

                // 保存成功的查询条件到本地，以便在页面刷新后恢复
                if (typeof window !== 'undefined') {
                    localStorage.setItem(
                        'lastApplyRecordQuery',
                        JSON.stringify({
                            ...values,
                            timestamp: new Date().getTime()
                        })
                    )
                }
            } else {
                message.error(response.message || '查询失败')
            }
        } catch (error) {
            console.error('查询错误:', error)
            message.error('查询失败')
        } finally {
            // Always set loading to false when done, whether successful or not
            setLoading(false)
        }
    }

    const handlePageChange = (page: number, pageSize: number) => {
        setLoading(true)
        setPagination({ page, pageSize })
        form.validateFields()
            .then((values) => {
                onFinish({
                    ...values,
                    page,
                    pageSize
                })
            })
            .catch((error) => {
                console.error('验证表单失败:', error)
                setLoading(false)
            })
    }

    const refreshData = () => {
        // Set loading to true before refreshing data
        setLoading(true)

        // 获取当前表单值
        const currentValues = form.getFieldsValue()

        // 直接调用查询方法，参数清理在onFinish中处理
        onFinish(currentValues)
    }

    const handleEdit = (record: any) => {
        // 任何平台：没有绑定外部taskId的情况下允许修改
        if (!record.taskId || record.taskId === record.taskNumber) {
            const platform = record.mediaPlatform
            const path =
                platform === 2
                    ? '/application/apply/google'
                    : platform === 5
                        ? '/application/apply/tiktok'
                        : '/application/apply/facebook'
            router.push(`${path}?taskId=${record.taskId}`)
            return
        }

        if (record.status === 30) {
            message.warning('已通过的申请不能修改')
            return
        }

        if (record.status === 10) {
            message.warning('审核中的申请不能修改')
            return
        }

        // 只有待修改(20)状态的工单才能进行修改
        if (record.status !== 20) {
            message.warning('当前状态不允许修改')
            return
        }

        const platform = record.mediaPlatform
        const path =
            platform === 2
                ? '/application/apply/google'
                : platform === 5
                    ? '/application/apply/tiktok'
                    : '/application/apply/facebook'
        router.push(`${path}?taskId=${record.taskId}`)
    }

    const handleBindTaskId = (record: any) => {
        // 使用Modal弹出绑定任务ID的表单
        Modal.confirm({
            title: '绑定申请ID',
            icon: <InfoCircleOutlined />,
            content: (
                <div>
                    <Input
                        id="externalTaskId"
                        placeholder="请输入平台获取的任务ID"
                        style={{ marginTop: 16 }}
                    />
                </div>
            ),
            onOk: async () => {
                // 获取输入的外部任务ID
                const externalTaskId = (
                    document.getElementById(
                        'externalTaskId'
                    ) as HTMLInputElement
                )?.value

                if (!externalTaskId) {
                    message.error('请输入外部任务ID')
                    return Promise.reject('请输入外部任务ID')
                }

                try {
                    setLoading(true)

                    // 统一使用通用方法处理所有平台
                    const res = await bindExternalTaskIdToWorkOrder(
                        record.workOrderId,
                        externalTaskId,
                        record.mediaPlatform,
                        session?.user?.id
                    )

                    if (res && res.success) {
                        message.success('绑定成功')
                        // 刷新列表数据
                        refreshData()
                        return Promise.resolve()
                    } else {
                        message.error((res && res.message) || '绑定失败')
                        return Promise.reject(
                            (res && res.message) || '绑定失败'
                        )
                    }
                } catch (error) {
                    console.error('绑定外部任务ID失败:', error)
                    message.error('绑定过程中发生错误')
                    return Promise.reject('绑定过程中发生错误')
                } finally {
                    setLoading(false)
                }
            }
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
                            form={form}
                            initialValues={initialValues}
                            onFinish={onFinish}
                            layout="vertical"
                            colon={false}
                            style={{ marginBottom: 0 }}
                            className="compact-form"
                            onValuesChange={(changedValues, allValues) => {
                                console.log('表单值变化:', changedValues)
                            }}
                        >
                            <Row gutter={[16, 8]}>
                                <Col xs={24} sm={12} md={8} lg={6}>
                                    <Item
                                        label="媒体平台"
                                        name="mediaPlatforms"
                                        style={{ marginBottom: '8px' }}
                                    >
                                        <Select
                                            style={{ width: '100%' }}
                                            placeholder="请选择媒体平台"
                                            mode="multiple"
                                            options={[
                                                { label: 'Facebook', value: 1 },
                                                { label: 'Google', value: 2 },
                                                { label: 'TikTok', value: 5 }
                                            ]}
                                            allowClear
                                            size="middle"
                                        />
                                    </Item>
                                </Col>

                                <Col xs={24} sm={12} md={8} lg={6}>
                                    <Item
                                        label="开户状态"
                                        name="statuses"
                                        style={{ marginBottom: '8px' }}
                                    >
                                        <Select
                                            style={{ width: '100%' }}
                                            placeholder="请选择开户状态"
                                            mode="multiple"
                                            options={[
                                                { label: '审核中', value: 10 },
                                                { label: '待修改', value: 20 },
                                                { label: '已通过', value: 30 },
                                                { label: '已拒绝', value: 40 }
                                            ]}
                                            allowClear
                                            size="middle"
                                        />
                                    </Item>
                                </Col>

                                <Col xs={24} sm={12} md={8} lg={6}>
                                    <Item
                                        label="开户主体"
                                        name={['company', 'name']}
                                        style={{ marginBottom: '8px' }}
                                    >
                                        <Input
                                            placeholder="请输入开户主体名称"
                                            allowClear
                                            size="middle"
                                            onChange={(e) => {
                                                if (e.target.value === '') {
                                                    const current =
                                                        form.getFieldValue([
                                                            'company'
                                                        ]) || {}
                                                    form.setFieldsValue({
                                                        company: {
                                                            ...current,
                                                            name: undefined
                                                        }
                                                    })
                                                }
                                            }}
                                        />
                                    </Item>
                                </Col>

                                <Col xs={24} sm={12} md={8} lg={6}>
                                    <Item
                                        label="申请时间"
                                        name="dateRange"
                                        style={{ marginBottom: '8px' }}
                                    >
                                        <RangePicker
                                            style={{ width: '100%' }}
                                            size="middle"
                                        />
                                    </Item>
                                </Col>

                                <Col xs={24} sm={12} md={8} lg={6}>
                                    <Item
                                        label="营业执照号"
                                        name={['company', 'businessLicenseNo']}
                                        style={{ marginBottom: '8px' }}
                                    >
                                        <Input
                                            placeholder="请输入营业执照号"
                                            allowClear
                                            size="middle"
                                        />
                                    </Item>
                                </Col>

                                <Col xs={24} sm={12} md={8} lg={6}>
                                    <Item
                                        label="申请ID"
                                        name="taskIds"
                                        style={{ marginBottom: '8px' }}
                                    >
                                        <Input
                                            placeholder="多个ID用逗号分隔"
                                            allowClear
                                            size="middle"
                                        />
                                    </Item>
                                </Col>

                                <Col xs={24} sm={12} md={8} lg={6}>
                                    <Item
                                        label="OE ID"
                                        name="oeIds"
                                        style={{ marginBottom: '8px' }}
                                    >
                                        <Input
                                            placeholder="请输入OE ID"
                                            allowClear
                                            size="middle"
                                        />
                                    </Item>
                                </Col>

                                <Col xs={24} sm={12} md={8} lg={6}>
                                    <Item
                                        label="推广链接"
                                        name="promotionLinks"
                                        style={{ marginBottom: '8px' }}
                                    >
                                        <Select
                                            style={{ width: '100%' }}
                                            placeholder="请选择推广链接"
                                            options={[
                                                {
                                                    label: 'https://wwww.baidu.com',
                                                    value: 'https://wwww.baidu.com'
                                                }
                                            ]}
                                            allowClear
                                            size="middle"
                                        />
                                    </Item>
                                </Col>

                                <Col xs={24}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'flex-end',
                                            marginTop: '8px'
                                        }}
                                    >
                                        <Space size="small">
                                            <Button
                                                type="default"
                                                onClick={() =>
                                                    form.resetFields()
                                                }
                                                size="middle"
                                            >
                                                重置
                                            </Button>
                                            <Button
                                                type="primary"
                                                htmlType="submit"
                                                size="middle"
                                            >
                                                搜索
                                            </Button>
                                            <Button
                                                onClick={refreshData}
                                                size="middle"
                                            >
                                                刷新
                                            </Button>
                                        </Space>
                                    </div>
                                </Col>
                            </Row>
                        </Form>
                    </Card>
                    <Card>
                        <div
                            style={{
                                marginBottom: 16,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                        >
                            <Typography.Title level={4} style={{ margin: 0 }}>
                                账户申请记录
                            </Typography.Title>
                        </div>
                        <Table
                            loading={loading}
                            columns={[
                                {
                                    title: '工单号',
                                    dataIndex: 'taskNumber',
                                    key: 'taskNumber',
                                    width: 240,
                                    ellipsis: true
                                },
                                {
                                    title: '申请ID',
                                    dataIndex: 'taskId',
                                    key: 'taskId',
                                    width: 160,
                                    ellipsis: true,
                                    render: (taskId: string, record: any) => {
                                        // 对于TikTok和Facebook平台且taskId等于taskNumber的情况，显示为空
                                        if (
                                            (record.mediaPlatform === 5 ||
                                                record.mediaPlatform === 1) &&
                                            taskId === record.taskNumber
                                        ) {
                                            return '-'
                                        }
                                        return taskId || '-'
                                    }
                                },
                                {
                                    title: '开户主体',
                                    dataIndex: ['company', 'name'],
                                    key: 'companyName',
                                    width: 200,
                                    ellipsis: true
                                },
                                {
                                    title: 'OE ID',
                                    dataIndex: 'oeId',
                                    key: 'oeId',
                                    width: 100,
                                    ellipsis: true
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
                                    render: (status: number, record: any) => {
                                        // 对于TikTok和Facebook平台且没有真正taskId的情况，显示为"待处理"状态
                                        if (
                                            (record.mediaPlatform === 5 ||
                                                record.mediaPlatform === 1) &&
                                            record.taskId === record.taskNumber
                                        ) {
                                            return (
                                                <Tag color="default">
                                                    待处理
                                                </Tag>
                                            )
                                        }

                                        const statusInfo = statusMap[
                                            status
                                        ] || {
                                            color: 'warning',
                                            text: `状态${status}`
                                        }
                                        return (
                                            <Tag color={statusInfo.color}>
                                                {statusInfo.text}
                                            </Tag>
                                        )
                                    },
                                    width: 100
                                },
                                {
                                    title: '工单状态',
                                    dataIndex: 'internalStatus',
                                    key: 'internalStatus',
                                    render: (status: string) => {
                                        // 系统工单状态的展示
                                        let color = 'default'
                                        let text = status || '-'

                                        switch (status) {
                                            case 'PENDING':
                                                color = 'default'
                                                text = '审核中'
                                                break
                                            case 'PROCESSING':
                                                color = 'processing'
                                                text = '处理中'
                                                break
                                            case 'COMPLETED':
                                                color = 'success'
                                                text = '已通过'
                                                break
                                            case 'FAILED':
                                                color = 'error'
                                                text = '已拒绝'
                                                break
                                        }

                                        return <Tag color={color}>{text}</Tag>
                                    },
                                    width: 100
                                },
                                {
                                    title: '推广链接',
                                    dataIndex: 'mediaAccountInfos',
                                    key: 'mediaAccountInfos',
                                    width: 250,
                                    ellipsis: true,
                                    render: (
                                        mediaAccountInfos: MediaAccountInfo
                                    ) => {
                                        return (
                                            mediaAccountInfos[0]?.promotionLinks
                                                .map((link: string) => link)
                                                .join(',') || '-'
                                        )
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
                                    width: 180,
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
                                {
                                    title: '操作',
                                    key: 'action',
                                    width: 220,
                                    render: (_, record) => (
                                        <Space>
                                            <Button
                                                type="link"
                                                onClick={() => {
                                                    const path =
                                                        '/application/detail'
                                                    router.push(
                                                        `${path}?taskId=${record.taskId}`
                                                    )
                                                }}
                                            >
                                                查看
                                            </Button>

                                            {/* 修改操作按钮 */}
                                            <Button
                                                type="link"
                                                onClick={() =>
                                                    handleEdit(record)
                                                }
                                                disabled={
                                                    record.status === 30 ||
                                                    (record.status === 10 &&
                                                        !(
                                                            (record.mediaPlatform ===
                                                                5 ||
                                                                record.mediaPlatform ===
                                                                1) &&
                                                            record.taskId ===
                                                            record.taskNumber
                                                        ))
                                                }
                                                title={
                                                    record.status === 30
                                                        ? '已通过的申请不能修改'
                                                        : record.status === 10
                                                            ? '审核中的申请不能修改'
                                                            : ''
                                                }
                                            >
                                                修改
                                            </Button>

                                            {/* 处理绑定ID和复制ID按钮逻辑 */}
                                            {!record.taskId ||
                                                record.taskId ===
                                                record.taskNumber ? (
                                                <Button
                                                    type="link"
                                                    onClick={() =>
                                                        handleBindTaskId(record)
                                                    }
                                                >
                                                    绑定ID
                                                </Button>
                                            ) : (
                                                <Button
                                                    type="link"
                                                    onClick={() => {
                                                        navigator.clipboard
                                                            .writeText(
                                                                record.taskId
                                                            )
                                                            .then(() => {
                                                                message.success(
                                                                    '申请ID已复制到剪贴板'
                                                                )
                                                            })
                                                            .catch((err) => {
                                                                console.error(
                                                                    '复制失败:',
                                                                    err
                                                                )
                                                                message.error(
                                                                    '复制失败，请手动复制'
                                                                )
                                                            })
                                                    }}
                                                >
                                                    复制ID
                                                </Button>
                                            )}
                                        </Space>
                                    )
                                }
                            ]}
                            dataSource={data?.mediaAccountApplications}
                            rowKey="taskId"
                            scroll={{ x: 1200 }}
                            pagination={{
                                total: data?.total,
                                current: data?.pageNumber,
                                pageSize: data?.pageSize,
                                showSizeChanger: true,
                                showQuickJumper: true,
                                showTotal: (total) => `共 ${total} 条记录`,
                                onChange: handlePageChange
                            }}
                            rowClassName={(record) => {
                                if (record.status === 30) return 'bg-green-50'
                                if (record.status === 20) return 'bg-blue-50'
                                return ''
                            }}
                            summary={(pageData) => {
                                const pendingCount = pageData.filter(
                                    (item) => item.status === 10
                                ).length
                                const processingCount = pageData.filter(
                                    (item) => item.status === 20
                                ).length
                                const completedCount = pageData.filter(
                                    (item) => item.status === 30
                                ).length
                                const rejectedCount = pageData.filter(
                                    (item) => item.status === 40
                                ).length

                                return (
                                    <Table.Summary.Row>
                                        <Table.Summary.Cell
                                            index={0}
                                            colSpan={9}
                                        >
                                            <Space split="|">
                                                <span>
                                                    审核中: {pendingCount}
                                                </span>
                                                <span>
                                                    待修改: {processingCount}
                                                </span>
                                                <span>
                                                    已通过: {completedCount}
                                                </span>
                                                <span>
                                                    已拒绝: {rejectedCount}
                                                </span>
                                                <span>
                                                    总计: {pageData.length}
                                                </span>
                                            </Space>
                                        </Table.Summary.Cell>
                                    </Table.Summary.Row>
                                )
                            }}
                        />
                    </Card>
                </Space>
            </ConfigProvider>
        </StyleProvider>
    )
}

// ;<style jsx global>{`
//     .compact-form .ant-form-item-label {
//         padding-bottom: 4px;
//     }

//     .compact-form .ant-form-item {
//         margin-bottom: 8px;
//     }

//     .compact-form .ant-form-item-label > label {
//         height: 20px;
//         font-size: 13px;
//     }

//     .compact-form .ant-card-body {
//         padding: 12px;
//     }
// `}</style>
