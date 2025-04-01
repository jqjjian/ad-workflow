'use client'

import { useState, useEffect } from 'react'
import {
    Button,
    Form,
    Input,
    Card,
    Select,
    Space,
    Typography,
    Divider,
    message,
    Alert,
    Switch
} from 'antd'
import {
    googleApply,
    updateGoogleApply,
    getGoogleApplyRecord
} from '@/app/actions/workorder/google-account-application'
import { GoogleAccountWithCompany } from '@/schemas/google-account'
import { TestConfig } from './config'

const { Title, Text, Paragraph } = Typography
const { Option } = Select

export default function GoogleAccountTestPage() {
    const [form] = Form.useForm()
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [taskId, setTaskId] = useState<string>('')
    const [queryResult, setQueryResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [useMockApi, setUseMockApi] = useState(TestConfig.useMockApi)

    // 生成随机默认值
    useEffect(() => {
        // 生成随机ID
        const randomId = Math.floor(Math.random() * 10000)
            .toString()
            .padStart(4, '0')

        // 设置默认值
        form.setFieldsValue({
            name: `测试账户-${randomId}`,
            currencyCode: Math.random() > 0.5 ? 'USD' : 'CNY',
            timezone: 'Asia/Shanghai',
            productType: String(Math.floor(Math.random() * 4)),
            // rechargeAmount: String(Math.floor(Math.random() * 10000) + 1000),
            promotionLink: `https://example.com/promo-${randomId}`,
            useCompanyInfo: true,
            companyNameCN: `测试公司中文名称-${randomId}`,
            companyNameEN: `Test Company EN-${randomId}`,
            businessLicenseNo: `9135010${randomId}88126732`,
            legalRepName: `测试法人-${randomId}`,
            idNumber: `3101${randomId}199001011234`,
            legalRepPhone: `1381234${randomId}`
        })
    }, [form])

    // 更新模拟API配置
    useEffect(() => {
        TestConfig.useMockApi = useMockApi
        console.log('模拟API设置已更新:', useMockApi)
    }, [useMockApi])

    // 申请表单提交
    const handleSubmit = async (values: any) => {
        try {
            setLoading(true)
            setError(null)

            // 构建申请数据
            const applicationData: GoogleAccountWithCompany = {
                name: values.name,
                currencyCode: values.currencyCode,
                timezone: values.timezone,
                productType: Number(values.productType),
                rechargeAmount: values.rechargeAmount,
                promotionLinks: [values.promotionLink], // 简化为单个链接
                auths: [null], // 添加默认的auths字段
                companyInfo: values.useCompanyInfo
                    ? {
                          companyNameCN: values.companyNameCN,
                          companyNameEN: values.companyNameEN,
                          businessLicenseNo: values.businessLicenseNo,
                          location: 0, // 默认为境内
                          legalRepName: values.legalRepName,
                          idType: 1, // 默认为身份证
                          idNumber: values.idNumber,
                          legalRepPhone: values.legalRepPhone,
                          attachments: []
                      }
                    : undefined
            }

            console.log('提交申请数据:', applicationData)

            // 添加更多详细日志，帮助调试
            console.log(
                '使用真实API发送请求，用户ID: a8b5ab9d-8a39-4801-ad8c-a90d4e349e26'
            )

            // 调用申请接口
            const response = await googleApply(
                applicationData,
                'a8b5ab9d-8a39-4801-ad8c-a90d4e349e26'
            )

            console.log('API完整响应:', response)
            setResult(response)

            if (response.success && response.data?.taskId) {
                setTaskId(response.data.taskId.toString())
                message.success('申请提交成功!')
            } else {
                // 显示更详细的错误信息
                const errorMsg = response.message || '申请失败'
                console.error('API错误详情:', errorMsg)
                setError(errorMsg)
                message.error('申请失败: ' + errorMsg)
            }
        } catch (err: any) {
            // 捕获并显示更详细的错误信息
            console.error('申请异常完整错误:', err)
            const errorDetail = err.message || '申请过程中发生错误'
            setError(`${errorDetail}\n\n堆栈: ${err.stack || '无堆栈信息'}`)
            message.error('申请过程中发生错误: ' + errorDetail)
        } finally {
            setLoading(false)
        }
    }

    // 查询申请记录
    const handleQuery = async () => {
        if (!taskId) {
            message.warning('请输入任务ID')
            return
        }

        try {
            setLoading(true)
            console.log('查询任务ID:', taskId)

            const response = await getGoogleApplyRecord(taskId)
            console.log('查询响应:', response)

            setQueryResult(response)

            if (!response.success) {
                setError(response.message || '查询失败')
                message.error('查询失败: ' + response.message)
            }
        } catch (err: any) {
            console.error('查询出错:', err)
            setError(err.message || '查询过程中发生错误')
            message.error('查询过程中发生错误: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    // 修改申请
    const handleUpdate = async () => {
        if (!taskId) {
            message.warning('请先创建或输入任务ID')
            return
        }

        try {
            setLoading(true)
            const values = form.getFieldsValue()

            // 构建更新数据
            const updateData: GoogleAccountWithCompany = {
                name: values.name,
                currencyCode: values.currencyCode,
                timezone: values.timezone,
                productType: Number(values.productType),
                rechargeAmount: values.rechargeAmount,
                promotionLinks: [values.promotionLink],
                auths: [null], // 添加默认的auths字段
                companyInfo: values.useCompanyInfo
                    ? {
                          companyNameCN: values.companyNameCN,
                          companyNameEN: values.companyNameEN,
                          businessLicenseNo: values.businessLicenseNo,
                          location: 0,
                          legalRepName: values.legalRepName,
                          idType: 1,
                          idNumber: values.idNumber,
                          legalRepPhone: values.legalRepPhone,
                          attachments: []
                      }
                    : undefined
            }

            console.log('更新申请数据:', updateData)

            const response = await updateGoogleApply(
                updateData,
                'test-user-id',
                taskId
            )
            console.log('更新响应:', response)

            setResult(response)

            if (response.success) {
                message.success('申请更新成功!')
            } else {
                setError(response.message || '更新失败')
                message.error('更新失败: ' + response.message)
            }
        } catch (err: any) {
            console.error('更新出错:', err)
            setError(err.message || '更新过程中发生错误')
            message.error('更新过程中发生错误: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div
            style={{
                height: '100vh',
                overflow: 'auto',
                width: '100%'
            }}
        >
            <div
                style={{
                    padding: '20px',
                    maxWidth: '1200px',
                    margin: '0 auto',
                    backgroundColor: '#ccc'
                }}
            >
                <Title level={2}>Google账号申请测试</Title>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        marginBottom: '20px'
                    }}
                >
                    <Paragraph>
                        此页面用于测试Google账号申请的完整业务流程，包括创建申请、查询和修改功能。
                    </Paragraph>
                    <Space>
                        <Text>使用模拟API:</Text>
                        <Switch
                            checked={useMockApi}
                            onChange={setUseMockApi}
                            checkedChildren="开"
                            unCheckedChildren="关"
                        />
                    </Space>
                </div>

                {error && (
                    <Alert
                        message="错误"
                        description={error}
                        type="error"
                        showIcon
                        closable
                        style={{ marginBottom: '20px' }}
                    />
                )}

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '20px'
                    }}
                >
                    <div style={{ flex: 1 }}>
                        <Card title="申请表单">
                            <Form
                                form={form}
                                layout="vertical"
                                onFinish={handleSubmit}
                            >
                                <Title level={4}>账户信息</Title>
                                <Form.Item
                                    name="name"
                                    label="账户名称"
                                    rules={[{ required: true }]}
                                >
                                    <Input placeholder="Google广告账户名称" />
                                </Form.Item>

                                <Form.Item
                                    name="productType"
                                    label="产品类型"
                                    rules={[{ required: true }]}
                                >
                                    <Select>
                                        <Option value="1">游戏</Option>
                                        <Option value="2">App</Option>
                                        <Option value="3">电商</Option>
                                        <Option value="0">其他</Option>
                                    </Select>
                                </Form.Item>

                                <Form.Item
                                    name="currencyCode"
                                    label="货币"
                                    rules={[{ required: true }]}
                                >
                                    <Select>
                                        <Option value="CNY">
                                            人民币 (CNY)
                                        </Option>
                                        <Option value="USD">美元 (USD)</Option>
                                    </Select>
                                </Form.Item>

                                <Form.Item
                                    name="timezone"
                                    label="时区"
                                    rules={[{ required: true }]}
                                >
                                    <Select>
                                        <Option value="Asia/Shanghai">
                                            中国标准时间 (GMT+8)
                                        </Option>
                                        <Option value="America/New_York">
                                            美国东部时间
                                        </Option>
                                    </Select>
                                </Form.Item>

                                <Form.Item
                                    name="rechargeAmount"
                                    label="充值金额"
                                >
                                    <Input placeholder="充值金额" />
                                </Form.Item>

                                <Form.Item
                                    name="promotionLink"
                                    label="推广链接"
                                    rules={[{ required: true }]}
                                >
                                    <Input placeholder="https://example.com" />
                                </Form.Item>

                                <Divider />

                                <Form.Item
                                    name="useCompanyInfo"
                                    valuePropName="checked"
                                >
                                    <div>
                                        <Title level={4}>公司信息</Title>
                                    </div>
                                </Form.Item>

                                <Form.Item
                                    name="companyNameCN"
                                    label="公司中文名称"
                                    rules={[{ required: true }]}
                                >
                                    <Input placeholder="公司中文名称" />
                                </Form.Item>

                                <Form.Item
                                    name="companyNameEN"
                                    label="公司英文名称"
                                    rules={[{ required: true }]}
                                >
                                    <Input placeholder="公司英文名称" />
                                </Form.Item>

                                <Form.Item
                                    name="businessLicenseNo"
                                    label="统一社会信用代码"
                                    rules={[{ required: true }]}
                                >
                                    <Input placeholder="统一社会信用代码" />
                                </Form.Item>

                                <Form.Item
                                    name="legalRepName"
                                    label="法人姓名"
                                    rules={[{ required: true }]}
                                >
                                    <Input placeholder="法人姓名" />
                                </Form.Item>

                                <Form.Item
                                    name="idNumber"
                                    label="证件号码"
                                    rules={[{ required: true }]}
                                >
                                    <Input placeholder="法人身份证号" />
                                </Form.Item>

                                <Form.Item
                                    name="legalRepPhone"
                                    label="法人手机号"
                                    rules={[{ required: true }]}
                                >
                                    <Input placeholder="法人手机号" />
                                </Form.Item>

                                <Divider />

                                <Form.Item>
                                    <Space>
                                        <Button
                                            type="primary"
                                            htmlType="submit"
                                            loading={loading}
                                        >
                                            提交申请
                                        </Button>
                                        <Button
                                            onClick={handleUpdate}
                                            loading={loading}
                                            disabled={!taskId}
                                        >
                                            修改申请
                                        </Button>
                                    </Space>
                                </Form.Item>
                            </Form>
                        </Card>
                    </div>

                    <div style={{ flex: 1 }}>
                        <Card title="申请结果与查询">
                            <Form
                                layout="inline"
                                style={{ marginBottom: '20px' }}
                            >
                                <Form.Item label="任务ID">
                                    <Input
                                        value={taskId}
                                        onChange={(e) =>
                                            setTaskId(e.target.value)
                                        }
                                        placeholder="输入任务ID"
                                        style={{ width: '200px' }}
                                    />
                                </Form.Item>
                                <Form.Item>
                                    <Button
                                        type="primary"
                                        onClick={handleQuery}
                                        loading={loading}
                                    >
                                        查询
                                    </Button>
                                </Form.Item>
                            </Form>

                            <Divider />

                            {result && (
                                <>
                                    <Title level={4}>申请/修改结果:</Title>
                                    <div
                                        style={{
                                            background: '#f5f5f5',
                                            padding: '10px',
                                            borderRadius: '4px',
                                            marginBottom: '20px'
                                        }}
                                    >
                                        <pre
                                            style={{
                                                margin: 0,
                                                whiteSpace: 'pre-wrap'
                                            }}
                                        >
                                            {JSON.stringify(result, null, 2)}
                                        </pre>
                                    </div>
                                </>
                            )}

                            {queryResult && (
                                <>
                                    <Title level={4}>查询结果:</Title>
                                    <div
                                        style={{
                                            background: '#f5f5f5',
                                            padding: '10px',
                                            borderRadius: '4px'
                                        }}
                                    >
                                        <pre
                                            style={{
                                                margin: 0,
                                                whiteSpace: 'pre-wrap'
                                            }}
                                        >
                                            {JSON.stringify(
                                                queryResult,
                                                null,
                                                2
                                            )}
                                        </pre>
                                    </div>
                                </>
                            )}
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}
