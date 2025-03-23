'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
    Row,
    Col,
    Card,
    Space,
    Typography,
    Descriptions,
    Divider,
    Tag,
    Button,
    Spin,
    message,
    Timeline,
    Steps,
    Tabs,
    ConfigProvider
} from 'antd'
import { StyleProvider } from '@ant-design/cssinjs'
// import { getGoogleApplyRecord } from '@/app/actions/workorder/google-account-application'
import { useRouter } from 'next/navigation'
// import type { GoogleAccountWithCompany } from '@/schemas/google-account'
import Image from 'next/image'
import { getAccountApplicationRecord } from '@/app/actions/workorder/account-application'

const { Title, Text, Paragraph } = Typography

// 状态映射，与列表页保持一致
const statusMap: Record<number, { color: string; text: string }> = {
    10: { color: 'default', text: '审核中' },
    20: { color: 'processing', text: '待修改' },
    30: { color: 'success', text: '已通过' },
    40: { color: 'error', text: '已拒绝' }
}

// 系统工单状态映射
const internalStatusMap: Record<string, { color: string; text: string }> = {
    PENDING: { color: 'default', text: '待处理' },
    PROCESSING: { color: 'processing', text: '处理中' },
    COMPLETED: { color: 'success', text: '完成' },
    FAILED: { color: 'error', text: '失败' }
}

// 产品类型映射
const productTypeMap: Record<number, string> = {
    0: '搜索广告',
    1: '展示广告',
    2: '视频广告',
    3: 'App广告'
}

// 角色字典 - 临时数据，后续可替换为全局状态
const roleMap: Record<number, string> = {
    1: '标准',
    2: '只读',
    3: '管理员'
}

// 首先，将时间戳格式化函数提取出来，方便复用
const formatTimestamp = (timestamp: number | string | undefined) => {
    if (!timestamp) return '-'

    // 统一处理时间戳格式
    const timestampNum =
        typeof timestamp === 'string' ? Number(timestamp) : timestamp
    const isSecondTimestamp = timestampNum < 10000000000
    const milliseconds = isSecondTimestamp ? timestampNum * 1000 : timestampNum

    return new Date(milliseconds).toLocaleString('zh-CN', { hour12: false })
}

export default function WorkOrderDetail() {
    const searchParams = useSearchParams()
    const taskId = searchParams.get('taskId')
    const router = useRouter()

    const [loading, setLoading] = useState(true)
    const [detail, setDetail] = useState<any>(null)
    const [activeTab, setActiveTab] = useState('1')
    const [statusMappings, setStatusMappings] = useState<any>(null)

    useEffect(() => {
        const fetchData = async () => {
            if (taskId) {
                setLoading(true)
                try {
                    // 使用统一的方法获取详情
                    const response = await getAccountApplicationRecord(taskId)
                    if (response.success) {
                        setDetail(response.data)
                    } else {
                        message.error(response.message || '获取数据失败')
                    }
                } catch (error) {
                    console.error('获取详情失败:', error)
                    message.error('获取详情失败')
                } finally {
                    setLoading(false)
                }
            }
        }

        fetchData()
    }, [taskId])

    useEffect(() => {
        if (detail) {
            console.log('工单详情数据:', detail)
            console.log('工单状态:', detail.status, typeof detail.status)
        }
    }, [detail])

    // useEffect(() => {
    //     // 获取状态映射表
    //     const fetchStatusMappings = async () => {
    //         try {
    //             const response = await fetch('/api/workorder/status-mappings')
    //             const data = await response.json()
    //             if (data.success) {
    //                 setStatusMappings(data.data)
    //             }
    //         } catch (error) {
    //             console.error('获取状态映射失败:', error)
    //         }
    //     }

    //     fetchStatusMappings()
    // }, [])

    const handleEdit = () => {
        if (!detail) return

        if (detail.status === 30) {
            message.warning('已通过的申请不能修改')
            return
        }

        if (detail.status === 10) {
            message.warning('审核中的申请不能修改')
            return
        }

        if (detail.status !== 20) {
            message.warning('当前状态不允许修改')
            return
        }

        const platform = detail.mediaPlatform
        const path =
            platform === 2
                ? '/application/apply/google'
                : platform === 5
                  ? '/application/apply/tiktok'
                  : '/application/apply/facebook'
        router.push(`${path}?taskId=${detail.taskId}`)
    }

    const handleCopy = () => {
        if (!detail) return

        const platform = detail.mediaPlatform
        const path =
            platform === 2
                ? '/application/apply/google'
                : platform === 5
                  ? '/application/apply/tiktok'
                  : '/application/apply/facebook'
        router.push(`${path}?copy=true&taskId=${detail.taskId}`)
    }

    // 更全面的状态解析函数
    const getStatusInfo = (statusValue: string | number) => {
        if (statusValue === undefined || statusValue === null)
            return { color: 'default', text: '加载中', step: 0 }

        // 转换为字符串，便于统一处理
        const statusCode = String(statusValue)

        console.log('解析状态:', statusCode, typeof statusValue)

        // 定义所有可能的状态映射
        const allStatusMap: Record<
            string,
            { color: string; text: string; step: number }
        > = {
            // 数字状态码
            '10': { color: 'default', text: '审核中', step: 1 },
            '20': { color: 'processing', text: '待修改', step: 1 },
            '30': { color: 'success', text: '已通过', step: 2 },
            '40': { color: 'error', text: '已拒绝', step: 1 },

            // 内部状态码
            PENDING: { color: 'default', text: '待处理', step: 1 },
            PROCESSING: { color: 'processing', text: '处理中', step: 1 },
            NEED_MODIFICATION: { color: 'processing', text: '待修改', step: 1 },
            APPROVED: { color: 'success', text: '已通过', step: 2 },
            REJECTED: { color: 'error', text: '已拒绝', step: 1 },
            FAILED: { color: 'error', text: '失败', step: 1 }
        }

        // 检查映射
        if (allStatusMap[statusCode]) {
            return allStatusMap[statusCode]
        }

        console.log('未找到状态映射:', statusCode)
        return { color: 'warning', text: '处理中', step: 1 }
    }

    // 使用函数获取两种状态的展示信息
    const workOrderStatusInfo = detail
        ? getStatusInfo(detail.internalStatus)
        : { color: 'default', text: '加载中', step: 0 }
    const accountStatusInfo = detail
        ? getStatusInfo(detail.status)
        : { color: 'default', text: '加载中', step: 0 }

    // 使用动态状态映射
    // const getStatusDisplay = (statusCode: any) => {
    //     if (!statusMappings)
    //         return { color: 'default', text: '加载中...', step: 0 }

    //     const statusKey = String(statusCode)
    //     return (
    //         statusMappings[statusKey] || {
    //             color: 'warning',
    //             text: `未知(${statusCode})`,
    //             step: 0
    //         }
    //     )
    // }

    // 构建时间线项目
    const buildTimelineItems = () => {
        if (!detail) return []

        const items = [
            // 第一项永远是提交申请
            {
                color: 'green',
                children: (
                    <>
                        <p>提交申请</p>
                        <p className="text-gray-500">
                            {formatTimestamp(detail.createdTimestamp)}
                        </p>
                    </>
                )
            }
        ]

        // 根据状态添加不同的后续流程项
        if (detail.status === 20) {
            items.push({
                color: 'blue',
                children: (
                    <>
                        <p>等待修改</p>
                        <p className="text-gray-500">
                            系统或审核人员要求修改申请信息
                        </p>
                    </>
                )
            })
        } else if (detail.status === 30) {
            items.push({
                color: 'green',
                children: (
                    <>
                        <p>申请通过</p>
                        <p className="text-gray-500">
                            {formatTimestamp(detail.updatedAt)}
                        </p>
                        {detail.oeId && <p>OE ID: {detail.oeId}</p>}
                    </>
                )
            })
        } else if (detail.status === 40) {
            items.push({
                color: 'red',
                children: (
                    <>
                        <p>申请被拒绝</p>
                        <p className="text-gray-500">
                            {formatTimestamp(detail.updatedAt)}
                        </p>
                        {detail.feedback && <p>拒绝原因: {detail.feedback}</p>}
                    </>
                )
            })
        }

        return items
    }

    if (loading) {
        return (
            <div className="flex min-h-[500px] items-center justify-center">
                <Spin size="large">
                    {/* <div className="p-12 text-center">加载中...</div> */}
                </Spin>
            </div>
        )
    }

    if (!detail) {
        return (
            <div className="flex min-h-[500px] flex-col items-center justify-center">
                <Text type="danger">未找到工单详情</Text>
                <Button
                    type="primary"
                    onClick={() => router.push('/application/record')}
                    className="mt-4"
                >
                    返回列表
                </Button>
            </div>
        )
    }

    const mediaAccountInfo = detail.mediaAccountInfos?.[0] || {}

    return (
        <StyleProvider layer>
            <ConfigProvider>
                <div className="space-y-6">
                    <Card className="shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <Title level={3} className="m-0">
                                    工单详情
                                </Title>
                                <Tag
                                    color={workOrderStatusInfo.color}
                                    className="px-3 py-1 text-base"
                                >
                                    {workOrderStatusInfo.text}
                                </Tag>
                            </div>
                            <Space>
                                <Button
                                    onClick={() =>
                                        router.push('/application/record')
                                    }
                                >
                                    返回列表
                                </Button>
                                {detail.status === 20 && (
                                    <Button type="primary" onClick={handleEdit}>
                                        修改申请
                                    </Button>
                                )}
                                <Button onClick={handleCopy}>复制申请</Button>
                            </Space>
                        </div>
                    </Card>

                    <Card className="shadow-sm">
                        <Steps
                            current={workOrderStatusInfo.step}
                            items={[
                                {
                                    title: '提交申请',
                                    description: '提交开户申请信息'
                                },
                                {
                                    title: '审核中',
                                    description: '申请信息审核中',
                                    status:
                                        detail.status === 20
                                            ? 'error'
                                            : detail.status === 40
                                              ? 'error'
                                              : undefined
                                },
                                {
                                    title: '申请完成',
                                    description: '开户申请处理完成'
                                }
                            ]}
                        />
                    </Card>

                    <Tabs
                        activeKey={activeTab}
                        onChange={setActiveTab}
                        type="card"
                        items={[
                            {
                                key: '1',
                                label: '基本信息',
                                children: (
                                    <>
                                        <Card className="shadow-sm">
                                            <Descriptions
                                                title="工单基本信息"
                                                bordered
                                                column={{
                                                    xxl: 4,
                                                    xl: 3,
                                                    lg: 3,
                                                    md: 2,
                                                    sm: 1,
                                                    xs: 1
                                                }}
                                            >
                                                <Descriptions.Item label="工单编号">
                                                    {detail.taskNumber}
                                                </Descriptions.Item>
                                                <Descriptions.Item label="申请ID">
                                                    {detail.taskId}
                                                </Descriptions.Item>
                                                <Descriptions.Item label="OE ID">
                                                    {detail.oeId || '-'}
                                                </Descriptions.Item>
                                                <Descriptions.Item label="媒体平台">
                                                    {detail.mediaPlatform === 2
                                                        ? 'Google'
                                                        : detail.mediaPlatform ===
                                                            5
                                                          ? 'TikTok'
                                                          : 'Facebook'}
                                                </Descriptions.Item>
                                                <Descriptions.Item label="工单状态">
                                                    <Tag
                                                        color={
                                                            workOrderStatusInfo.color
                                                        }
                                                        style={{
                                                            fontSize: '14px'
                                                        }}
                                                    >
                                                        {
                                                            workOrderStatusInfo.text
                                                        }
                                                    </Tag>
                                                </Descriptions.Item>
                                                <Descriptions.Item label="创建时间">
                                                    {detail.createdTimestamp
                                                        ? new Date(
                                                              Number(
                                                                  detail.createdTimestamp
                                                              ) * 1000
                                                          ).toLocaleString(
                                                              'zh-CN',
                                                              {
                                                                  hour12: false
                                                              }
                                                          )
                                                        : detail.createdAt
                                                          ? new Date(
                                                                detail.createdAt
                                                            ).toLocaleString(
                                                                'zh-CN',
                                                                {
                                                                    hour12: false
                                                                }
                                                            )
                                                          : '-'}
                                                </Descriptions.Item>
                                                <Descriptions.Item label="更新时间">
                                                    {detail.updatedAt
                                                        ? typeof detail.updatedAt ===
                                                          'number'
                                                            ? new Date(
                                                                  detail.updatedAt <
                                                                  10000000000
                                                                      ? detail.updatedAt *
                                                                        1000
                                                                      : detail.updatedAt
                                                              ).toLocaleString(
                                                                  'zh-CN',
                                                                  {
                                                                      hour12: false
                                                                  }
                                                              )
                                                            : new Date(
                                                                  Number(
                                                                      detail.updatedAt
                                                                  ) * 1000
                                                              ).toLocaleString(
                                                                  'zh-CN',
                                                                  {
                                                                      hour12: false
                                                                  }
                                                              )
                                                        : '-'}
                                                </Descriptions.Item>
                                                {detail.feedback && (
                                                    <Descriptions.Item
                                                        label="反馈信息"
                                                        span={2}
                                                    >
                                                        {detail.feedback}
                                                    </Descriptions.Item>
                                                )}
                                            </Descriptions>
                                        </Card>

                                        <Card className="mt-6 shadow-sm">
                                            <Descriptions
                                                title="账户信息"
                                                bordered
                                                column={{
                                                    xxl: 4,
                                                    xl: 3,
                                                    lg: 3,
                                                    md: 2,
                                                    sm: 1,
                                                    xs: 1
                                                }}
                                            >
                                                <Descriptions.Item label="账户名称">
                                                    {mediaAccountInfo.name}
                                                </Descriptions.Item>
                                                <Descriptions.Item label="开户状态">
                                                    {detail &&
                                                    detail.status &&
                                                    statusMap[detail.status] ? (
                                                        <Tag
                                                            color={
                                                                statusMap[
                                                                    detail
                                                                        .status
                                                                ].color
                                                            }
                                                        >
                                                            {
                                                                statusMap[
                                                                    detail
                                                                        .status
                                                                ].text
                                                            }
                                                        </Tag>
                                                    ) : (
                                                        '-'
                                                    )}
                                                </Descriptions.Item>
                                                <Descriptions.Item label="开户主体">
                                                    {detail?.company?.name ||
                                                        '-'}
                                                </Descriptions.Item>
                                                <Descriptions.Item label="产品类型">
                                                    {productTypeMap[
                                                        mediaAccountInfo
                                                            .productType
                                                    ] ||
                                                        mediaAccountInfo.productType}
                                                </Descriptions.Item>
                                                <Descriptions.Item label="货币类型">
                                                    {
                                                        mediaAccountInfo.currencyCode
                                                    }
                                                </Descriptions.Item>
                                                <Descriptions.Item label="时区">
                                                    {mediaAccountInfo.timezone}
                                                </Descriptions.Item>
                                                {mediaAccountInfo.rechargeAmount && (
                                                    <Descriptions.Item label="充值金额">
                                                        {
                                                            mediaAccountInfo.rechargeAmount
                                                        }
                                                    </Descriptions.Item>
                                                )}
                                                <Descriptions.Item
                                                    label="推广链接"
                                                    span={3}
                                                >
                                                    {mediaAccountInfo.promotionLinks?.map(
                                                        (
                                                            link: string,
                                                            index: number
                                                        ) => (
                                                            <div key={index}>
                                                                <a
                                                                    href={link}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                >
                                                                    {link}
                                                                </a>
                                                            </div>
                                                        )
                                                    )}
                                                </Descriptions.Item>
                                                {mediaAccountInfo.auths
                                                    ?.length > 0 && (
                                                    <Descriptions.Item
                                                        label="账户授权"
                                                        span={3}
                                                    >
                                                        {mediaAccountInfo.auths.map(
                                                            (
                                                                auth: any,
                                                                index: number
                                                            ) => (
                                                                <div
                                                                    key={index}
                                                                >
                                                                    角色:{' '}
                                                                    {roleMap[
                                                                        auth
                                                                            .role
                                                                    ] ||
                                                                        `未知(${auth.role})`}
                                                                    , 邮箱:{' '}
                                                                    {auth.value}
                                                                </div>
                                                            )
                                                        )}
                                                    </Descriptions.Item>
                                                )}
                                            </Descriptions>
                                        </Card>
                                    </>
                                )
                            },
                            {
                                key: '2',
                                label: '企业信息',
                                children: (
                                    <>
                                        <Card>
                                            {detail.company ? (
                                                <Descriptions
                                                    title="企业信息"
                                                    bordered
                                                    column={{
                                                        xxl: 3,
                                                        xl: 3,
                                                        lg: 2,
                                                        md: 2,
                                                        sm: 1,
                                                        xs: 1
                                                    }}
                                                >
                                                    <Descriptions.Item label="企业名称(中文)">
                                                        {
                                                            detail.company
                                                                .companyNameCN
                                                        }
                                                    </Descriptions.Item>
                                                    <Descriptions.Item label="企业名称(英文)">
                                                        {detail.company
                                                            .companyNameEN ||
                                                            '-'}
                                                    </Descriptions.Item>
                                                    <Descriptions.Item label="营业执照号">
                                                        {
                                                            detail.company
                                                                .businessLicenseNo
                                                        }
                                                    </Descriptions.Item>
                                                    <Descriptions.Item label="公司地址">
                                                        {detail.company
                                                            .location || '-'}
                                                    </Descriptions.Item>
                                                    <Descriptions.Item label="法人姓名">
                                                        {detail.company
                                                            .legalRepName ||
                                                            '-'}
                                                    </Descriptions.Item>
                                                    <Descriptions.Item label="证件类型">
                                                        {detail.company
                                                            .idType ===
                                                        'ID_CARD'
                                                            ? '身份证'
                                                            : detail.company
                                                                  .idType ||
                                                              '-'}
                                                    </Descriptions.Item>
                                                    <Descriptions.Item label="证件号码">
                                                        {detail.company
                                                            .idNumber || '-'}
                                                    </Descriptions.Item>
                                                    <Descriptions.Item label="法人电话">
                                                        {detail.company
                                                            .legalRepPhone ||
                                                            '-'}
                                                    </Descriptions.Item>
                                                    <Descriptions.Item label="银行卡号">
                                                        {detail.company
                                                            .legalRepBankCard ||
                                                            '-'}
                                                    </Descriptions.Item>
                                                </Descriptions>
                                            ) : (
                                                <div
                                                    style={{
                                                        textAlign: 'center',
                                                        padding: '40px 0'
                                                    }}
                                                >
                                                    <Text type="secondary">
                                                        无企业信息
                                                    </Text>
                                                </div>
                                            )}
                                        </Card>

                                        {activeTab === '2' &&
                                            detail.company?.attachments && (
                                                <Card
                                                    title="企业证件附件"
                                                    style={{
                                                        marginTop: '24px'
                                                    }}
                                                >
                                                    <Row gutter={[16, 16]}>
                                                        {detail.company.attachments.map(
                                                            (
                                                                attachment: any,
                                                                index: number
                                                            ) => {
                                                                // 检查文件URL是否有效
                                                                const hasValidUrl =
                                                                    attachment.fileUrl &&
                                                                    typeof attachment.fileUrl ===
                                                                        'string' &&
                                                                    (attachment.fileUrl.startsWith(
                                                                        'http://'
                                                                    ) ||
                                                                        attachment.fileUrl.startsWith(
                                                                            'https://'
                                                                        ))

                                                                // 默认图片URL (替换为您系统中的默认图片)
                                                                const defaultImgUrl =
                                                                    '/images/default-document.png'

                                                                // 安全的文件URL
                                                                const safeFileUrl =
                                                                    hasValidUrl
                                                                        ? attachment.fileUrl
                                                                        : defaultImgUrl

                                                                // 安全的文件大小
                                                                const safeFileSize =
                                                                    typeof attachment.fileSize ===
                                                                        'number' &&
                                                                    attachment.fileSize >
                                                                        0
                                                                        ? attachment.fileSize
                                                                        : 0

                                                                return (
                                                                    <Col
                                                                        xs={24}
                                                                        sm={12}
                                                                        md={8}
                                                                        key={
                                                                            index
                                                                        }
                                                                    >
                                                                        <Card
                                                                            hoverable
                                                                            style={{
                                                                                height: '100%'
                                                                            }}
                                                                        >
                                                                            <div
                                                                                style={{
                                                                                    textAlign:
                                                                                        'center',
                                                                                    marginBottom:
                                                                                        '16px'
                                                                                }}
                                                                            >
                                                                                {attachment.fileType?.startsWith(
                                                                                    'image/'
                                                                                ) ? (
                                                                                    <div
                                                                                        style={{
                                                                                            height: '200px',
                                                                                            position:
                                                                                                'relative',
                                                                                            overflow:
                                                                                                'hidden',
                                                                                            background:
                                                                                                '#f5f5f5',
                                                                                            display:
                                                                                                'flex',
                                                                                            alignItems:
                                                                                                'center',
                                                                                            justifyContent:
                                                                                                'center'
                                                                                        }}
                                                                                    >
                                                                                        {hasValidUrl ? (
                                                                                            <img
                                                                                                src={
                                                                                                    safeFileUrl
                                                                                                }
                                                                                                alt={
                                                                                                    attachment.fileName ||
                                                                                                    '企业证件'
                                                                                                }
                                                                                                style={{
                                                                                                    maxWidth:
                                                                                                        '100%',
                                                                                                    maxHeight:
                                                                                                        '100%',
                                                                                                    objectFit:
                                                                                                        'contain'
                                                                                                }}
                                                                                                onError={(
                                                                                                    e
                                                                                                ) => {
                                                                                                    // 图片加载失败时显示替代内容
                                                                                                    const target =
                                                                                                        e.target as HTMLImageElement
                                                                                                    target.onerror =
                                                                                                        null // 防止循环错误
                                                                                                    target.src =
                                                                                                        defaultImgUrl
                                                                                                    // 替代方案：可以完全移除并显示文本
                                                                                                    // target.style.display = 'none';
                                                                                                    // target.parentElement!.innerHTML = '图片加载失败';
                                                                                                }}
                                                                                            />
                                                                                        ) : (
                                                                                            <div>
                                                                                                无效图片路径
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                ) : (
                                                                                    <div
                                                                                        style={{
                                                                                            height: '200px',
                                                                                            display:
                                                                                                'flex',
                                                                                            alignItems:
                                                                                                'center',
                                                                                            justifyContent:
                                                                                                'center',
                                                                                            background:
                                                                                                '#f5f5f5'
                                                                                        }}
                                                                                    >
                                                                                        <Text>
                                                                                            非图片文件
                                                                                        </Text>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div>
                                                                                <Text
                                                                                    strong
                                                                                >
                                                                                    {attachment.description ||
                                                                                        attachment.fileName ||
                                                                                        '企业证件'}
                                                                                </Text>
                                                                                <div
                                                                                    style={{
                                                                                        marginTop:
                                                                                            '8px'
                                                                                    }}
                                                                                >
                                                                                    <Text
                                                                                        ellipsis
                                                                                        style={{
                                                                                            display:
                                                                                                'block'
                                                                                        }}
                                                                                    >
                                                                                        {attachment.fileName ||
                                                                                            '未命名文件'}
                                                                                    </Text>
                                                                                    <Text type="secondary">
                                                                                        {safeFileSize >
                                                                                        0
                                                                                            ? `${Math.round(safeFileSize / 1024)} KB`
                                                                                            : '大小未知'}
                                                                                    </Text>
                                                                                </div>
                                                                                <div
                                                                                    style={{
                                                                                        marginTop:
                                                                                            '8px'
                                                                                    }}
                                                                                >
                                                                                    {hasValidUrl ? (
                                                                                        <a
                                                                                            href={
                                                                                                safeFileUrl
                                                                                            }
                                                                                            target="_blank"
                                                                                            rel="noopener noreferrer"
                                                                                        >
                                                                                            查看/下载
                                                                                        </a>
                                                                                    ) : (
                                                                                        <Text type="warning">
                                                                                            文件链接无效
                                                                                        </Text>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </Card>
                                                                    </Col>
                                                                )
                                                            }
                                                        )}
                                                    </Row>
                                                </Card>
                                            )}
                                    </>
                                )
                            },
                            {
                                key: '3',
                                label: '处理记录',
                                children: (
                                    <>
                                        <Card className="shadow-sm">
                                            <Timeline
                                                items={buildTimelineItems()}
                                            />
                                        </Card>
                                    </>
                                )
                            }
                        ]}
                    />
                </div>
            </ConfigProvider>
        </StyleProvider>
    )
}
