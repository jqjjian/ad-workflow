'use client'

import { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Table, Spin, Typography } from 'antd'
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    ClockCircleOutlined,
    BarChartOutlined
} from '@ant-design/icons'
import { getWorkOrderStatistics } from '@/app/actions/workorder/common'

const { Title } = Typography

export default function DashboardPage() {
    const [stats, setStats] = useState({
        totalOrders: 0,
        pendingOrders: 0,
        successOrders: 0,
        failedOrders: 0,
        byType: {},
        recentActivity: []
    })

    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadStats() {
            setLoading(true)
            try {
                // 使用真实的用户ID
                const userId = 'current-user-id'
                const response = await getWorkOrderStatistics(userId)
                if (response.success && response.data) {
                    setStats(response.data)
                }
            } catch (error) {
                console.error('加载统计数据失败', error)
            } finally {
                setLoading(false)
            }
        }

        loadStats()
    }, [])

    // 设置表格列
    const recentActivityColumns = [
        {
            title: '工单编号',
            dataIndex: 'taskNumber',
            key: 'taskNumber'
        },
        {
            title: '工单类型',
            dataIndex: 'workOrderType',
            key: 'workOrderType'
        },
        {
            title: '子类型',
            dataIndex: 'workOrderSubtype',
            key: 'workOrderSubtype'
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                if (status === 'SUCCESS')
                    return <span style={{ color: 'green' }}>成功</span>
                if (status === 'FAILED')
                    return <span style={{ color: 'red' }}>失败</span>
                if (status === 'PENDING')
                    return <span style={{ color: 'orange' }}>处理中</span>
                return <span>{status}</span>
            }
        },
        {
            title: '创建时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date: string) => new Date(date).toLocaleString()
        }
    ]

    return (
        <div>
            <Title level={2}>仪表盘</Title>

            <Spin spinning={loading}>
                {/* 统计卡片 */}
                <Row gutter={16} style={{ marginBottom: 24 }}>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title="总工单数"
                                value={stats.totalOrders}
                                prefix={<BarChartOutlined />}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title="待处理工单"
                                value={stats.pendingOrders}
                                prefix={<ClockCircleOutlined />}
                                valueStyle={{ color: '#faad14' }}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title="成功工单"
                                value={stats.successOrders}
                                prefix={<CheckCircleOutlined />}
                                valueStyle={{ color: '#52c41a' }}
                            />
                        </Card>
                    </Col>
                    <Col span={6}>
                        <Card>
                            <Statistic
                                title="失败工单"
                                value={stats.failedOrders}
                                prefix={<CloseCircleOutlined />}
                                valueStyle={{ color: '#ff4d4f' }}
                            />
                        </Card>
                    </Col>
                </Row>

                {/* 最近活动 */}
                <Card title="最近工单活动" style={{ marginBottom: 24 }}>
                    <Table
                        dataSource={stats.recentActivity}
                        columns={recentActivityColumns}
                        rowKey="id"
                        pagination={false}
                    />
                </Card>
            </Spin>
        </div>
    )
}
