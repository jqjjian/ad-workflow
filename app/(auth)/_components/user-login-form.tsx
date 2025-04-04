'use client'
import type { FormProps } from 'antd'
import { Form, Input, Button, Checkbox, Flex, Typography } from 'antd'
import { useTransition } from 'react'
// import { useState } from 'react'
// import { useForm } from 'react-hook-form'
// import { useForm } from 'antd/es/form/Form'
// import { zodResolver } from '@hookform/resolvers/zod'
import { useSession } from 'next-auth/react'
import Password from 'antd/es/input/Password'
import { EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons'
import { LoginSchema } from '@/schemas/auth'
import * as z from 'zod'
import { createSchemaFieldRule } from 'antd-zod'
import { login } from '@/app/actions/login'
import useMessage from '@/app/hooks/messages'
const { Title } = Typography
const { Item } = Form
type UserFormValue = z.infer<typeof LoginSchema>

export default function UserLoginForm() {
    const [isPending, startTransition] = useTransition()
    const { showMessage } = useMessage()
    const { update } = useSession()
    // const [form] = Form.useForm()
    // const [onSubmit] = useForm<UserFormValue>({
    //     resolver: zodResolver(LoginSchema)
    // })
    const rule = createSchemaFieldRule(LoginSchema)

    const defaultValues = {
        username: '15977716954',
        password: 'Aa123123'
    }
    // const {
    //     // control,
    //     register,
    //     handleSubmit,
    //     formState: { errors },
    //     setError
    // } = useForm<UserFormValue>({
    //     resolver: zodResolver(LoginSchema)
    //     // defaultValues
    // })

    // const onSubmit = async (data: UserFormValue) => {
    //     console.log('data', data)
    //     try {
    //         // Zod 严格验证
    //         const validatedData = LoginSchema.parse(data)
    //         console.log('验证通过的数据:', validatedData)
    //         // 这里执行提交操作...
    //     } catch (error) {
    //         console.log('error', error)
    //         if (error instanceof z.ZodError) {
    //             // 4. 将 Zod 错误转换为 antd 表单错误
    //             error.errors.forEach((err) => {
    //                 const fieldName = err.path.join('.')
    //                 setError(fieldName as any, {
    //                     type: 'manual',
    //                     message: err.message
    //                 })
    //             })
    //         }
    //     }
    // }

    // const [checked, setChecked] = useState(true)
    const onFinish: FormProps['onFinish'] = (values: UserFormValue) => {
        console.log('Success:', values)
        startTransition(async () => {
            const res = await login(values)
            if (res.success) {
                showMessage('success', res.success)
                // 更新会话并等待完成
                await update()
                // 增加短暂延迟确保会话状态完全更新
                setTimeout(() => {
                    window.location.href = '/dashboard' // 使用直接跳转确保完整页面加载
                }, 300)
            } else {
                showMessage('error', res.error ?? '登录失败')
            }
        })
    }

    // const onFinishFailed: FormProps<UserFormValue>['onFinishFailed'] = (
    //     errorInfo: any
    // ) => {
    //     console.log('Failed:', errorInfo)
    // }
    // const onChange: CheckboxProps['onChange'] = (e) => {
    //     console.log('checked = ', e.target.checked)
    //     setChecked(e.target.checked)
    // }
    return (
        <Form
            // form={form}
            // name="login"
            initialValues={defaultValues}
            onFinish={onFinish}
            // onFinishFailed={onFinishFailed}
            style={{ width: '488px' }}
        >
            {/* <div
                style={{
                    height: 37,
                    width: '100%'
                }}
            >
                LOGO
            </div>
            <Title level={1} style={{ margin: '48px 0  24px' }}>
                欢迎使用Ad-Workflow
            </Title> */}
            <Item
                name="username"
                rules={[rule]}
                // validateStatus={errors.username ? 'error' : ''}
                // help={errors.username?.message}
                // rules={[{ required: true, message: '请输入登陆账号!' }]}
            >
                <Input
                    placeholder="请输入登录账号"
                    style={{ height: 52, fontSize: 16 }}
                    // {...register('username')}
                />
            </Item>

            <Item
                name="password"
                rules={[rule]}
                // validateStatus={errors.password ? 'error' : ''}
                // help={errors.password?.message}
                // name="password"
                // rules={[{ required: true, message: '请输入密码!' }]}
            >
                <Password
                    style={{ height: 52, fontSize: 16 }}
                    placeholder="请输入密码"
                    iconRender={(visible) =>
                        visible ? (
                            <EyeTwoTone style={{ fontSize: 20 }} />
                        ) : (
                            <EyeInvisibleOutlined style={{ fontSize: 20 }} />
                        )
                    }
                    // {...register('password')}
                />
            </Item>

            <Item
                // validateStatus={errors.remember ? 'error' : ''}
                // help={errors.remember?.message}
                initialValue={true}
                name="remember"
                valuePropName="checked"
                rules={[
                    {
                        // 必须勾选验证
                        validator: (_, value) =>
                            value
                                ? Promise.resolve()
                                : Promise.reject('请勾选同意系统用户协议')
                    }
                ]}
            >
                <Checkbox>我已阅读并同意平台协议</Checkbox>
            </Item>

            <Item>
                <Button
                    type="primary"
                    htmlType="submit"
                    shape="round"
                    loading={isPending}
                    style={{ width: '100%', height: 52, marginTop: 16 }}
                >
                    <Title level={5} style={{ margin: 0, color: '#fff' }}>
                        登录
                    </Title>
                </Button>
            </Item>

            <Item>
                <Flex justify="end">
                    <Button type="link" style={{ padding: 0 }}>
                        忘记密码？
                    </Button>
                </Flex>
            </Item>
        </Form>
    )
}
