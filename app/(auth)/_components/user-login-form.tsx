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
import { useRouter } from 'next/navigation'
const { Title } = Typography

const { Item } = Form
type UserFormValue = z.infer<typeof LoginSchema>

export default function UserLoginForm() {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const { showMessage } = useMessage()
    const { update } = useSession()
    // const [form] = Form.useForm()
    // const [onSubmit] = useForm<UserFormValue>({
    //     resolver: zodResolver(LoginSchema)
    // })
    const rule = createSchemaFieldRule(LoginSchema)

    const defaultValues = {
        username: '',
        password: ''
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
        console.log('开始登录流程:', values)
        startTransition(async () => {
            try {
                const res = await login(values)
                console.log('登录API响应:', res)

                if (res?.success) {
                    showMessage('success', res.success)

                    try {
                        // 更新会话并等待完成
                        console.log('开始更新会话，用户角色:', res.user?.role)
                        await update()

                        // 获取最新的会话状态并确认角色信息
                        const session = await fetch('/api/auth/session').then(
                            (r) => r.json()
                        )
                        console.log('会话更新完成，获取到会话:', session)
                        console.log('用户角色检查:', {
                            loginRes: res.user?.role,
                            sessionRole: session?.user?.role
                        })

                        // 记录登录状态，防止重定向循环
                        sessionStorage.setItem('justLoggedIn', 'true')
                        const userRole = session?.user?.role || res.user?.role
                        sessionStorage.setItem('userRole', userRole)

                        // 设置cookie，确保中间件能获取到角色
                        document.cookie = `userRole=${userRole}; path=/; max-age=86400;`

                        console.log(
                            '已设置justLoggedIn标记和角色信息:',
                            userRole
                        )

                        // 获取重定向URL
                        const urlParams = new URLSearchParams(
                            window.location.search
                        )
                        const returnUrl =
                            urlParams.get('returnUrl') || '/application/apply'
                        console.log('登录成功，准备重定向到', returnUrl)

                        // 强制全页面刷新而不是客户端路由
                        window.location.href = returnUrl
                    } catch (error) {
                        console.error('会话更新出错', error)
                        showMessage('error', '登录过程中出错，但将继续重定向')

                        // 即使出错也尝试重定向
                        const returnUrl =
                            new URLSearchParams(window.location.search).get(
                                'returnUrl'
                            ) || '/application/apply'
                        forceRedirect(returnUrl)
                    }
                } else {
                    showMessage('error', res.error ?? '登录失败')
                }
            } catch (loginError) {
                console.error('登录过程发生错误:', loginError)
                showMessage('error', '登录请求失败')
            }
        })
    }

    // 独立的重定向函数，确保一定会执行
    const forceRedirect = (url: string) => {
        console.log('开始执行强制重定向到:', url)

        // 方法1: location.replace
        try {
            window.location.replace(url)
            console.log('location.replace已执行')
        } catch (e) {
            console.error('location.replace失败:', e)
        }

        // 方法2: 备用重定向(如果方法1失败)
        setTimeout(() => {
            try {
                console.log('执行备用重定向方法')
                document.location.href = url
                console.log('document.location.href已执行')
            } catch (e) {
                console.error('备用重定向也失败:', e)

                // 方法3: 最后尝试
                setTimeout(() => {
                    window.open(url, '_self')
                    console.log('尝试window.open')
                }, 100)
            }
        }, 200)
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
                    <Button
                        type="link"
                        style={{ padding: 0 }}
                        onClick={() => router.push('/forgot-password')}
                    >
                        忘记密码？
                    </Button>
                </Flex>
            </Item>
        </Form>
    )
}
