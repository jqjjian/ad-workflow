'use client'

import { useState } from 'react'
import { Form, Input, Button, Space, Card, Select, message } from 'antd'
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons'

const { Option } = Select

interface TiktokAccountFormProps {
    onSubmit: (data: any) => Promise<void>
    loading: boolean
    initialData?: any
}

export default function TiktokAccountForm({
    onSubmit,
    loading,
    initialData
}: TiktokAccountFormProps) {
    const [form] = Form.useForm()

    const handleSubmit = async (values: any) => {
        try {
            await onSubmit(values)
            message.success('表单提交成功')
        } catch (error) {
            console.error('表单提交失败:', error)
            message.error(
                '表单提交失败: ' +
                    (error instanceof Error ? error.message : '未知错误')
            )
        }
    }

    const handleReset = () => {
        form.resetFields()
    }

    return (
        <Form
            form={form}
            layout="vertical"
            initialValues={
                initialData || {
                    promotionLink: '',
                    registrationDetails: {
                        companyName: '',
                        companyNameEN: '',
                        locationId: 1,
                        legalRepName: '',
                        idType: 1,
                        idNumber: '',
                        legalRepPhone: '',
                        legalRepBankCard: ''
                    }
                }
            }
            onFinish={handleSubmit}
        >
            <Card title="基本信息" style={{ marginBottom: 24 }}>
                <Form.Item
                    label="推广链接"
                    name="promotionLink"
                    rules={[{ required: true, message: '请输入推广链接' }]}
                >
                    <Input placeholder="请输入推广链接" />
                </Form.Item>
            </Card>

            <Card title="公司注册信息" style={{ marginBottom: 24 }}>
                <Form.Item
                    label="公司名称"
                    name={['registrationDetails', 'companyName']}
                    rules={[{ required: true, message: '请输入公司中文名称' }]}
                >
                    <Input placeholder="请输入公司中文名称" />
                </Form.Item>

                <Form.Item
                    label="公司英文名称"
                    name={['registrationDetails', 'companyNameEN']}
                    rules={[{ required: true, message: '请输入公司英文名称' }]}
                >
                    <Input placeholder="请输入公司英文名称" />
                </Form.Item>

                <Form.Item
                    label="法人姓名"
                    name={['registrationDetails', 'legalRepName']}
                    rules={[{ required: true, message: '请输入法人姓名' }]}
                >
                    <Input placeholder="请输入法人姓名" />
                </Form.Item>

                <Form.Item
                    label="证件类型"
                    name={['registrationDetails', 'idType']}
                    rules={[{ required: true, message: '请选择证件类型' }]}
                >
                    <Select placeholder="请选择证件类型">
                        <Option value={1}>身份证</Option>
                        <Option value={2}>护照</Option>
                    </Select>
                </Form.Item>

                <Form.Item
                    label="证件号码"
                    name={['registrationDetails', 'idNumber']}
                    rules={[{ required: true, message: '请输入证件号码' }]}
                >
                    <Input placeholder="请输入证件号码" />
                </Form.Item>

                <Form.Item
                    label="法人手机号"
                    name={['registrationDetails', 'legalRepPhone']}
                    rules={[{ required: true, message: '请输入法人手机号' }]}
                >
                    <Input placeholder="请输入法人手机号" />
                </Form.Item>

                <Form.Item
                    label="法人银行卡号"
                    name={['registrationDetails', 'legalRepBankCard']}
                    rules={[{ required: true, message: '请输入法人银行卡号' }]}
                >
                    <Input placeholder="请输入法人银行卡号" />
                </Form.Item>

                <Form.Item
                    label="公司所在地"
                    name={['registrationDetails', 'locationId']}
                    rules={[{ required: true, message: '请选择公司所在地' }]}
                >
                    <Select placeholder="请选择公司所在地">
                        <Option value={1}>中国大陆</Option>
                        <Option value={2}>中国香港</Option>
                        <Option value={3}>其他</Option>
                    </Select>
                </Form.Item>
            </Card>

            <div style={{ textAlign: 'right' }}>
                <Space>
                    <Button
                        onClick={handleReset}
                        disabled={loading}
                        icon={<ReloadOutlined />}
                    >
                        重置
                    </Button>
                    <Button
                        type="primary"
                        htmlType="submit"
                        loading={loading}
                        icon={<SaveOutlined />}
                    >
                        提交申请
                    </Button>
                </Space>
            </div>
        </Form>
    )
}
