'use client'
import type { FormProps } from 'antd'
import { useTransition } from 'react'
// import { useRouter } from 'next/navigation'
import { Form, Input, Button, Checkbox, Select, Typography } from 'antd'
// import Option from 'antd/es/select'
// import { useState } from 'react'
// import { useForm } from 'react-hook-form'
// import { useForm } from 'antd/es/form/Form'
// import { zodResolver } from '@hookform/resolvers/zod'
// import Compact from 'antd/es/Space'
import Password from 'antd/es/input/Password'
import { EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons'
import { RegisterSchema } from '@/schemas/auth'
import * as z from 'zod'
import { createSchemaFieldRule } from 'antd-zod'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { register } from '@/app/actions/register'
import useMessage from '@/app/hooks/messages'
const { Title } = Typography
const { Item } = Form
type UserFormValue = z.infer<typeof RegisterSchema>

export default function UserRegisterForm() {
    const { showMessage } = useMessage()
    const [isPending, startTransition] = useTransition()
    const [form] = Form.useForm()
    // const [onSubmit] = useForm<UserFormValue>({
    //     resolver: zodResolver(LoginSchema)
    // })
    const rule = createSchemaFieldRule(RegisterSchema)
    // const [defaultValues, setDefaultValues] = useState<UserFormValue>({
    //     username: '',
    //     password: ''
    //     // remember: false
    // })
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
        startTransition(async () => {
            console.log('Success:', values)
            const res = await register(values)
            console.log('res', res)
            if (res?.success) {
                showMessage('success', res.success)
                form.resetFields()
            } else {
                showMessage('error', res?.error || '注册失败')
            }
        })
    }

    const validatePhoneNumber = (phoneNumber: string) => {
        console.log('phoneNumber', phoneNumber)
        const phoneNumberObj = parsePhoneNumberFromString(phoneNumber)
        return phoneNumberObj ? phoneNumberObj.isValid() : false
    }

    const handleGetCodeClick = () => {
        const phoneNumber = form.getFieldValue('username')
        if (!phoneNumber) {
            form.setFields([
                {
                    name: 'username',
                    errors: ['手机号不能为空']
                }
            ])
        } else if (validatePhoneNumber(phoneNumber)) {
            console.log(
                'Phone number is valid. Proceed to send verification code.'
            )
            // Add logic to send verification code
        } else {
            console.log('Invalid phone number.')
            // Optionally, set an error message in the form
            form.setFields([
                {
                    name: 'username',
                    errors: ['请输入有效的手机号码']
                }
            ])
        }
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
            form={form}
            // name="login"
            // initialValues={defaultValues}
            onFinish={onFinish}
            // onFinishFailed={onFinishFailed}
            style={{ width: '620px' }}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Item name="areaCode" rules={[rule]} initialValue="86">
                    <Select
                        showSearch
                        filterOption={(input, option) =>
                            (option?.label?.toString() ?? '')
                                .toLowerCase()
                                .includes(input.toLowerCase())
                        }
                        style={{ height: 40, fontSize: 16, width: '120px' }}
                        placeholder="请选择"
                        options={[
                            { label: '+86 中国', value: '86' },
                            { label: '+87 美国', value: '87' },
                            { label: '+88 英国', value: '88' },
                            { label: '+89 加拿大', value: '89' },
                            { label: '+90 澳大利亚', value: '90' }
                        ]}
                    />
                </Item>
                <Item name="username" rules={[rule]}>
                    {/* <Compact direction="horizontal" size={16}>
                    <Select
                        showSearch
                        filterOption={(input, option) =>
                            (option?.label?.toString() ?? '')
                                .toLowerCase()
                                .includes(input.toLowerCase())
                        }
                        style={{ height: 40, fontSize: 16, width: '120px' }}
                        placeholder="请选择"
                        options={[
                            { label: '+86 中国', value: '86' },
                            { label: '+87 美国', value: '87' },
                            { label: '+88 英国', value: '88' },
                            { label: '+89 加拿大', value: '89' },
                            { label: '+90 澳大利亚', value: '90' }
                        ]}
                    />
                </Compact> */}
                    <Input
                        prefix={
                            <span style={{ color: 'red', marginTop: 5 }}>
                                *
                            </span>
                        }
                        placeholder="请输入手机号"
                        style={{ height: 40, fontSize: 16, width: '482px' }}
                        // {...register('username')}
                    />
                </Item>
            </div>
            <Item
                name="verifyCode"
                rules={[rule]}
                // validateStatus={errors.username ? 'error' : ''}
                // help={errors.username?.message}
                // rules={[{ required: true, message: '验证码为能为空' }]}
            >
                <Input
                    prefix={
                        <span style={{ color: 'red', marginTop: 5 }}>*</span>
                    }
                    placeholder="请输入验证码"
                    style={{ height: 40, fontSize: 16 }}
                    suffix={
                        <Button
                            style={{ marginRight: '-8px' }}
                            onClick={handleGetCodeClick}
                        >
                            获取验证码
                        </Button>
                    }
                />
                {/* <Button style={{ marginRight: '-8px' }}>获取验证码</Button>
                    <Button style={{ marginRight: '-8px' }}>获取验证码</Button> */}
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
                    prefix={
                        <span style={{ color: 'red', marginTop: 5 }}>*</span>
                    }
                    style={{ height: 40, fontSize: 16 }}
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
                name="name"
                rules={[rule]}
                // validateStatus={errors.username ? 'error' : ''}
                // help={errors.username?.message}
                // rules={[{ required: true, message: '请输入登陆账号!' }]}
            >
                <Input
                    placeholder="请输入用户名"
                    style={{ height: 40, fontSize: 16 }}
                />
                {/* <Button style={{ marginRight: '-8px' }}>获取验证码</Button>
                    <Button style={{ marginRight: '-8px' }}>获取验证码</Button> */}
            </Item>
            <Item
                name="companyName"
                rules={[rule]}
                // validateStatus={errors.username ? 'error' : ''}
                // help={errors.username?.message}
                // rules={[{ required: true, message: '请输入登陆账号!' }]}
            >
                <Input
                    prefix={
                        <span style={{ color: 'red', marginTop: 5 }}>*</span>
                    }
                    placeholder="请输入公司名称"
                    style={{ height: 40, fontSize: 16 }}
                />
                {/* <Button style={{ marginRight: '-8px' }}>获取验证码</Button>
                    <Button style={{ marginRight: '-8px' }}>获取验证码</Button> */}
            </Item>
            <Item
                name="email"
                rules={[rule]}
                // validateStatus={errors.username ? 'error' : ''}
                // help={errors.username?.message}
                // rules={[{ required: true, message: '请输入登陆账号!' }]}
            >
                <Input
                    prefix={
                        <span style={{ color: 'red', marginTop: 5 }}>*</span>
                    }
                    placeholder="请输入邮箱"
                    style={{ height: 40, fontSize: 16 }}
                />
                {/* <Button style={{ marginRight: '-8px' }}>获取验证码</Button>
                    <Button style={{ marginRight: '-8px' }}>获取验证码</Button> */}
            </Item>
            <Item
                // validateStatus={errors.remember ? 'error' : ''}
                // help={errors.remember?.message}
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
                    loading={isPending}
                    type="primary"
                    htmlType="submit"
                    shape="round"
                    style={{ width: '100%', height: 40 }}
                >
                    <Title level={5} style={{ margin: 0, color: '#fff' }}>
                        注册
                    </Title>
                </Button>
            </Item>

            {/* <Item>
                <Flex justify="end">
                    <Button type="link" style={{ padding: 0 }}>
                        忘记密码？
                    </Button>
                </Flex>
            </Item> */}
        </Form>
    )
}
