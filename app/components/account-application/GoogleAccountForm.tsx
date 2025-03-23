'use client'

import { useState } from 'react'
import { Form, Input, Button, Space, Card, message } from 'antd'
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons'

interface GoogleAccountFormProps {
    onSubmit: (data: any) => Promise<void>
    loading: boolean
    initialData?: any
}

export default function GoogleAccountForm({
    onSubmit,
    loading,
    initialData
}: GoogleAccountFormProps) {
    const [form] = Form.useForm()

    const handleSubmit = async (values) => {
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
                    companyName: '',
                    companyNameEN: '',
                    promotionLinks: ''
                }
            }
            onFinish={handleSubmit}
        >
            <Card title="基本信息" style={{ marginBottom: 24 }}>
                <Form.Item
                    label="公司名称"
                    name="companyName"
                    rules={[{ required: true, message: '请输入公司中文名称' }]}
                >
                    <Input placeholder="请输入公司中文名称" />
                </Form.Item>

                <Form.Item
                    label="公司英文名称"
                    name="companyNameEN"
                    rules={[{ required: true, message: '请输入公司英文名称' }]}
                >
                    <Input placeholder="请输入公司英文名称" />
                </Form.Item>

                <Form.Item
                    label="推广链接"
                    name="promotionLinks"
                    rules={[{ required: true, message: '请输入推广链接' }]}
                >
                    <Input placeholder="请输入推广链接" />
                </Form.Item>

                {/* 其他表单字段... */}
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
