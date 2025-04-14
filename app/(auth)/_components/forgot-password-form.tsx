'use client'
import { useState, useTransition } from 'react'
import { Form, Input, Button, Typography, Space } from 'antd'
import type { FormProps } from 'antd'
import { useRouter } from 'next/navigation'
import { EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons'
import Password from 'antd/es/input/Password'
import useMessage from '@/app/hooks/messages'
import { getVerificationCode } from '@/app/actions/verification'
import { resetPassword } from '@/app/actions/reset-password'
import { ForgotPasswordSchema } from '@/schemas/auth'
import * as z from 'zod'
import { createSchemaFieldRule } from 'antd-zod'

const { Title } = Typography
const { Item } = Form

type ForgotPasswordFormValues = z.infer<typeof ForgotPasswordSchema>

export default function ForgotPasswordForm() {
    const [isPending, startTransition] = useTransition()
    const { showMessage } = useMessage()
    const router = useRouter()
    const [countdown, setCountdown] = useState(0)
    const [form] = Form.useForm()
    const [defaultValues, setDefaultValues] = useState<ForgotPasswordFormValues>({
        phoneNumber: '',
        verificationCode: '123456',
        newPassword: '',
        confirmPassword: ''
    })
    // 创建表单校验规则
    const rule = createSchemaFieldRule(ForgotPasswordSchema)

    const handleSendCode = () => {
        // 验证手机号
        form.validateFields(['phoneNumber']).then(async ({ phoneNumber }) => {
            // 开始倒计时
            setCountdown(60)
            const timer = setInterval(() => {
                setCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(timer)
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)

            // 调用获取验证码API
            try {
                const result = await getVerificationCode({ phoneNumber })
                if (result.success) {
                    showMessage('success', result.success)
                    // 如果是开发环境且返回了验证码，自动填充
                    if (result.code) {
                        form.setFieldValue('verificationCode', result.code)
                    }
                } else if (result.error) {
                    showMessage('error', result.error)
                }
            } catch (error) {
                showMessage('error', '发送验证码失败')
            }
        }).catch(err => {
            showMessage('error', '请输入正确的手机号')
        })
    }

    const onFinish: FormProps<ForgotPasswordFormValues>['onFinish'] = (values) => {
        startTransition(async () => {
            try {
                // 调用重置密码API
                const result = await resetPassword(values)

                if (result.success) {
                    showMessage('success', result.success)
                    // 重置成功后跳转到登录页
                    setTimeout(() => {
                        router.push('/login')
                    }, 1500)
                } else if (result.error) {
                    showMessage('error', result.error)
                }
            } catch (error) {
                showMessage('error', '密码重置失败，请稍后再试')
            }
        })
    }

    return (
        <Form
            form={form}
            onFinish={onFinish}
            style={{ width: '488px' }}
        >
            <Item
                name="phoneNumber"
                rules={[rule]}
            >
                <Input
                    placeholder="请输入手机号"
                    style={{ height: 52, fontSize: 16 }}
                />
            </Item>

            {/* <Item
                name="verificationCode"
                rules={[rule]}
            >
                <Space.Compact style={{ width: '100%' }}>
                    <Input
                        placeholder="请输入验证码"
                        style={{ height: 52, fontSize: 16 }}
                    />
                    <Button
                        style={{ height: 52, fontSize: 16, width: 120 }}
                        disabled={countdown > 0}
                        onClick={handleSendCode}
                    >
                        {countdown > 0 ? `${countdown}秒后重发` : '获取验证码'}
                    </Button>
                </Space.Compact>
            </Item> */}

            <Item
                name="newPassword"
                rules={[rule]}
            >
                <Password
                    style={{ height: 52, fontSize: 16 }}
                    placeholder="请输入新密码"
                    iconRender={(visible) =>
                        visible ? (
                            <EyeTwoTone style={{ fontSize: 20 }} />
                        ) : (
                            <EyeInvisibleOutlined style={{ fontSize: 20 }} />
                        )
                    }
                />
            </Item>

            <Item
                name="confirmPassword"
                rules={[rule]}
            >
                <Password
                    style={{ height: 52, fontSize: 16 }}
                    placeholder="请再次输入新密码"
                    iconRender={(visible) =>
                        visible ? (
                            <EyeTwoTone style={{ fontSize: 20 }} />
                        ) : (
                            <EyeInvisibleOutlined style={{ fontSize: 20 }} />
                        )
                    }
                />
            </Item>

            <Item>
                <Button
                    type="primary"
                    htmlType="submit"
                    shape="round"
                    loading={isPending}
                    style={{
                        width: '100%',
                        height: 52,
                        fontSize: 16,
                        marginTop: 24
                    }}
                >
                    重置密码
                </Button>
            </Item>
        </Form>
    )
} 