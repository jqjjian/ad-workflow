'use client'

import { useState, useEffect } from 'react'
import { getUsers, updateUserRole, updateUserStatus, updateUserPassword, deleteUser } from '@/app/actions/user'
import { UserRole } from '@prisma/client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, Table, Tag, Button, Space, Input, Form, Select, Modal, Typography, message, Flex, Popconfirm } from 'antd'
import { SearchOutlined, EditOutlined, DeleteOutlined, LockOutlined, UserSwitchOutlined } from '@ant-design/icons'
import { TablePaginationConfig } from 'antd'
import { UserData, UserQuery } from '@/schemas/user'

const { Title } = Typography
const { Option } = Select

export default function UsersManagementPage() {
    const { data: session } = useSession()
    const router = useRouter()
    const [users, setUsers] = useState<UserData[]>([])
    const [loading, setLoading] = useState(false)
    const [searchParams, setSearchParams] = useState<Partial<UserQuery>>({
        username: '',
        role: undefined,
        status: undefined
    })
    const [pagination, setPagination] = useState<TablePaginationConfig>({
        current: 1,
        pageSize: 10,
        total: 0
    })

    // 修改密码Modal
    const [passwordModal, setPasswordModal] = useState(false)
    const [currentUser, setCurrentUser] = useState<UserData | null>(null)
    const [passwordForm] = Form.useForm()

    // 修改角色Modal
    const [roleModal, setRoleModal] = useState(false)
    const [roleForm] = Form.useForm()

    // 检查当前用户是否为超级管理员
    const isSuperAdmin = session?.user?.role === 'SUPER_ADMIN'

    useEffect(() => {
        if (session && !isSuperAdmin) {
            message.error('只有超级管理员才能访问此页面')
            router.push('/')
        } else {
            fetchUsers()
        }
    }, [session, pagination.current, pagination.pageSize])

    const fetchUsers = async () => {
        if (!isSuperAdmin) return

        setLoading(true)
        try {
            const result = await getUsers({
                ...searchParams,
                page: pagination.current as number,
                pageSize: pagination.pageSize as number
            })

            if (result.success) {
                setUsers(result.data)
                setPagination({
                    ...pagination,
                    total: result.total
                })
            } else {
                message.error(result.error || '获取用户列表失败')
            }
        } catch (error) {
            console.error('获取用户列表失败:', error)
            message.error('获取用户列表失败')
        } finally {
            setLoading(false)
        }
    }

    const handleSearch = () => {
        setPagination({
            ...pagination,
            current: 1
        })
        fetchUsers()
    }

    const handleTableChange = (newPagination: TablePaginationConfig) => {
        setPagination(newPagination)
    }

    // 处理修改密码
    const showPasswordModal = (user: UserData) => {
        setCurrentUser(user)
        setPasswordModal(true)
        passwordForm.resetFields()
    }

    const handlePasswordCancel = () => {
        setPasswordModal(false)
        setCurrentUser(null)
        passwordForm.resetFields()
    }

    const handlePasswordUpdate = async (values: { password: string }) => {
        if (!currentUser || !isSuperAdmin) return

        try {
            const result = await updateUserPassword({
                userId: currentUser.id,
                newPassword: values.password
            })

            if (result.success) {
                message.success('密码修改成功')
                setPasswordModal(false)
                setCurrentUser(null)
                passwordForm.resetFields()
            } else {
                message.error(result.error || '密码修改失败')
            }
        } catch (error) {
            console.error('密码修改失败:', error)
            message.error('密码修改失败')
        }
    }

    // 处理修改角色
    const showRoleModal = (user: UserData) => {
        setCurrentUser(user)
        setRoleModal(true)
        roleForm.setFieldsValue({
            role: user.role
        })
    }

    const handleRoleCancel = () => {
        setRoleModal(false)
        setCurrentUser(null)
        roleForm.resetFields()
    }

    const handleRoleUpdate = async (values: { role: UserRole }) => {
        if (!currentUser || !isSuperAdmin) return

        try {
            const result = await updateUserRole({
                userId: currentUser.id,
                role: values.role
            })

            if (result.success) {
                message.success('角色修改成功')
                setRoleModal(false)
                setCurrentUser(null)
                roleForm.resetFields()
                fetchUsers()
            } else {
                message.error(result.error || '角色修改失败')
            }
        } catch (error) {
            console.error('角色修改失败:', error)
            message.error('角色修改失败')
        }
    }

    // 处理状态更改
    const handleStatusChange = async (userId: string, newStatus: string) => {
        if (!isSuperAdmin) return

        try {
            const result = await updateUserStatus({
                userId,
                status: newStatus as 'ACTIVE' | 'INACTIVE' | 'DELETED'
            })

            if (result.success) {
                message.success(`用户状态已${newStatus === 'ACTIVE' ? '启用' : '禁用'}`)
                fetchUsers()
            } else {
                message.error(result.error || '更新用户状态失败')
            }
        } catch (error) {
            console.error('更新用户状态失败:', error)
            message.error('更新用户状态失败')
        }
    }

    // 处理用户删除
    const handleUserDelete = async (userId: string) => {
        if (!isSuperAdmin) return

        try {
            const result = await deleteUser({
                userId
            })

            if (result.success) {
                message.success('用户已删除')
                fetchUsers()
            } else {
                message.error(result.error || '删除用户失败')
            }
        } catch (error) {
            console.error('删除用户失败:', error)
            message.error('删除用户失败')
        }
    }

    const columns = [
        {
            title: '用户名',
            dataIndex: 'username',
            key: 'username',
        },
        {
            title: '姓名',
            dataIndex: 'name',
            key: 'name',
        },
        {
            title: '邮箱',
            dataIndex: 'email',
            key: 'email',
        },
        {
            title: '角色',
            dataIndex: 'role',
            key: 'role',
            render: (role: UserRole) => {
                let color = 'blue'
                if (role === 'SUPER_ADMIN') color = 'red'
                if (role === 'ADMIN') color = 'orange'
                return <Tag color={color}>{role}</Tag>
            }
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: string) => {
                const color = status === 'ACTIVE' ? 'green' : 'red'
                const text = status === 'ACTIVE' ? '启用' : '禁用'
                return <Tag color={color}>{text}</Tag>
            }
        },
        {
            title: '注册时间',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date: Date) => new Date(date).toLocaleString('zh-CN')
        },
        {
            title: '最后登录',
            dataIndex: 'lastLoginAt',
            key: 'lastLoginAt',
            render: (date: Date | null) => date ? new Date(date).toLocaleString('zh-CN') : '从未登录'
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: UserData) => (
                <Space size="small">
                    <Button
                        icon={<LockOutlined />}
                        size="small"
                        onClick={() => showPasswordModal(record)}
                        disabled={!isSuperAdmin}
                    >
                        修改密码
                    </Button>
                    <Button
                        icon={<UserSwitchOutlined />}
                        size="small"
                        onClick={() => showRoleModal(record)}
                        disabled={!isSuperAdmin}
                    >
                        修改角色
                    </Button>
                    {record.status === 'ACTIVE' ? (
                        <Button
                            danger
                            size="small"
                            onClick={() => handleStatusChange(record.id, 'INACTIVE')}
                            disabled={!isSuperAdmin || record.role === 'SUPER_ADMIN'}
                        >
                            禁用
                        </Button>
                    ) : (
                        <Button
                            type="primary"
                            size="small"
                            onClick={() => handleStatusChange(record.id, 'ACTIVE')}
                            disabled={!isSuperAdmin}
                        >
                            启用
                        </Button>
                    )}
                    <Popconfirm
                        title="确定要删除此用户吗?"
                        description="此操作不可逆, 用户将被永久删除."
                        onConfirm={() => handleUserDelete(record.id)}
                        okText="是"
                        cancelText="否"
                        disabled={!isSuperAdmin || record.role === 'SUPER_ADMIN'}
                    >
                        <Button
                            danger
                            icon={<DeleteOutlined />}
                            size="small"
                            disabled={!isSuperAdmin || record.role === 'SUPER_ADMIN'}
                        >
                            删除
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ]

    return (
        <>
            <Title level={3}>账户管理</Title>

            <Card style={{ marginBottom: 16 }}>
                <Form layout="inline" onFinish={handleSearch}>
                    <Form.Item label="用户名">
                        <Input
                            placeholder="输入用户名"
                            value={searchParams.username}
                            onChange={(e) => setSearchParams({ ...searchParams, username: e.target.value })}
                            allowClear
                        />
                    </Form.Item>
                    <Form.Item label="角色">
                        <Select
                            style={{ width: 120 }}
                            placeholder="选择角色"
                            value={searchParams.role}
                            onChange={(value) => setSearchParams({ ...searchParams, role: value })}
                            allowClear
                        >
                            <Option value="USER">普通用户</Option>
                            <Option value="ADMIN">管理员</Option>
                            <Option value="SUPER_ADMIN">超级管理员</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item label="状态">
                        <Select
                            style={{ width: 120 }}
                            placeholder="选择状态"
                            value={searchParams.status}
                            onChange={(value) => setSearchParams({ ...searchParams, status: value })}
                            allowClear
                        >
                            <Option value="ACTIVE">启用</Option>
                            <Option value="INACTIVE">禁用</Option>
                        </Select>
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                            查询
                        </Button>
                    </Form.Item>
                </Form>
            </Card>

            <Card>
                <Table
                    columns={columns}
                    dataSource={users}
                    rowKey="id"
                    loading={loading}
                    pagination={pagination}
                    onChange={handleTableChange}
                />
            </Card>

            {/* 修改密码Modal */}
            <Modal
                title="修改密码"
                open={passwordModal}
                onCancel={handlePasswordCancel}
                footer={null}
            >
                <Form
                    form={passwordForm}
                    layout="vertical"
                    onFinish={handlePasswordUpdate}
                >
                    <Form.Item
                        name="password"
                        label="新密码"
                        rules={[
                            { required: true, message: '请输入新密码' },
                            { min: 6, message: '密码长度至少为6位' }
                        ]}
                    >
                        <Input.Password />
                    </Form.Item>
                    <Form.Item
                        name="confirmPassword"
                        label="确认密码"
                        dependencies={['password']}
                        rules={[
                            { required: true, message: '请确认新密码' },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue('password') === value) {
                                        return Promise.resolve()
                                    }
                                    return Promise.reject(new Error('两次输入的密码不一致!'))
                                },
                            }),
                        ]}
                    >
                        <Input.Password />
                    </Form.Item>
                    <Flex justify="end" gap="small">
                        <Button onClick={handlePasswordCancel}>取消</Button>
                        <Button type="primary" htmlType="submit">确定</Button>
                    </Flex>
                </Form>
            </Modal>

            {/* 修改角色Modal */}
            <Modal
                title="修改角色"
                open={roleModal}
                onCancel={handleRoleCancel}
                footer={null}
            >
                <Form
                    form={roleForm}
                    layout="vertical"
                    onFinish={handleRoleUpdate}
                >
                    <Form.Item
                        name="role"
                        label="用户角色"
                        rules={[{ required: true, message: '请选择用户角色' }]}
                    >
                        <Select>
                            <Option value="USER">普通用户</Option>
                            <Option value="ADMIN">管理员</Option>
                            <Option value="SUPER_ADMIN">超级管理员</Option>
                        </Select>
                    </Form.Item>
                    <Flex justify="end" gap="small">
                        <Button onClick={handleRoleCancel}>取消</Button>
                        <Button type="primary" htmlType="submit">确定</Button>
                    </Flex>
                </Form>
            </Modal>
        </>
    )
} 