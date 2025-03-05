'use client'

import React, { useState, useEffect } from 'react'
import {
    Table,
    Button,
    Modal,
    Form,
    Input,
    Select,
    Switch,
    InputNumber,
    Space,
    message
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import {
    CreateDictionaryDto,
    UpdateDictionaryDto,
    QueryDictionaryDto,
    Dictionary,
    DictionaryItem
} from '@/schemas'
import {
    getDictionaries,
    createDictionary,
    updateDictionary,
    deleteDictionary,
    initDictionaryData
} from '@/app/actions/dictionary'
// import { DictType } from '@/schemas'

const DictionaryPage: React.FC = () => {
    const [form] = Form.useForm()
    const [visible, setVisible] = useState(false)
    const [loading, setLoading] = useState(false)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [data, setData] = useState<Dictionary[]>([])
    const [pagination, setPagination] = useState({
        current: 1,
        pageSize: 10,
        total: 0
    })

    // 获取字典列表
    const fetchDictionaries = async (params = pagination) => {
        setLoading(true)
        try {
            const { list, total } = await getDictionaries({
                // dictType: 'BUSINESS',
                page: params.current,
                pageSize: params.pageSize
            })
            setData(list as Dictionary[])
            setPagination((prev) => ({
                ...prev,
                total
            }))
        } catch (error) {
            message.error('获取字典列表失败')
        }
        setLoading(false)
    }

    useEffect(() => {
        // initDictionaryData()
        fetchDictionaries()
    }, [])

    // 表单提交
    const handleSubmit = async (
        values: CreateDictionaryDto | UpdateDictionaryDto
    ) => {
        try {
            if (editingId) {
                await updateDictionary(editingId, values as UpdateDictionaryDto)
            } else {
                await createDictionary(values as CreateDictionaryDto)
            }
            message.success(`${editingId ? '更新' : '创建'}成功`)
            setVisible(false)
            form.resetFields()
            fetchDictionaries()
        } catch (error) {
            console.error(error)
            message.error(`${editingId ? '更新' : '创建'}失败`)
        }
    }

    const columns = [
        {
            title: '字典名称',
            dataIndex: 'dictName',
            key: 'dictName'
        },
        {
            title: '字典类型',
            dataIndex: 'dictType',
            key: 'dictType'
        },
        {
            title: '字典编码',
            dataIndex: 'dictCode',
            key: 'dictCode'
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: boolean) => <Switch checked={status} disabled />
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: Dictionary) => (
                <Space>
                    <Button
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => handleEdit(record)}
                    >
                        编辑
                    </Button>
                    <Button
                        type="link"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(record.id ?? 0)}
                    >
                        删除
                    </Button>
                </Space>
            )
        }
    ]

    // 编辑字典
    const handleEdit = (record: Dictionary) => {
        setEditingId(record.id ?? 0)
        form.setFieldsValue(record)
        setVisible(true)
    }

    // 删除字典
    const handleDelete = async (id: number) => {
        try {
            await deleteDictionary(id)
            message.success('删除成功')
            fetchDictionaries()
        } catch (error) {
            message.error('删除失败')
        }
    }

    // 处理表格分页变化
    const handleTableChange = (pagination: any) => {
        setPagination(pagination)
        fetchDictionaries(pagination)
    }

    return (
        <div>
            <div style={{ marginBottom: 16 }}>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                        setEditingId(null)
                        form.resetFields()
                        setVisible(true)
                    }}
                >
                    添加字典
                </Button>
            </div>

            <Table
                columns={columns}
                dataSource={data}
                loading={loading}
                rowKey="id"
                pagination={pagination}
                onChange={handleTableChange}
                expandable={{
                    expandedRowRender: (record) => (
                        <DictionaryItemList items={record.items ?? []} />
                    )
                }}
            />

            <Modal
                title={editingId ? '编辑字典' : '添加字典'}
                open={visible}
                onCancel={() => setVisible(false)}
                onOk={() => form.submit()}
                width={800}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Form.Item
                        name="dictType"
                        label="字典类型"
                        rules={[{ required: true }]}
                    >
                        <Select>
                            <Select.Option value="SYSTEM">
                                系统配置
                            </Select.Option>
                            <Select.Option value="BUSINESS">
                                业务配置
                            </Select.Option>
                            <Select.Option value="USER">用户配置</Select.Option>
                            <Select.Option value="OTHER">
                                其他配置
                            </Select.Option>
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="dictCode"
                        label="字典编码"
                        rules={[{ required: true }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        name="dictName"
                        label="字典名称"
                        rules={[{ required: true }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item name="description" label="描述">
                        <Input.TextArea />
                    </Form.Item>

                    <Form.Item
                        name="status"
                        label="状态"
                        valuePropName="checked"
                    >
                        <Switch />
                    </Form.Item>

                    <Form.Item name="sort" label="排序">
                        <InputNumber min={0} />
                    </Form.Item>

                    <Form.List name="items">
                        {(fields, { add, remove }) => (
                            <>
                                {fields.map((field, index) => {
                                    const { key, ...restField } = field
                                    return (
                                        <div
                                            key={key}
                                            style={{ display: 'flex', gap: 8 }}
                                        >
                                            <Form.Item
                                                {...restField}
                                                name={[field.name, 'itemCode']}
                                                label="字典项编码"
                                                rules={[{ required: true }]}
                                            >
                                                <Input />
                                            </Form.Item>

                                            <Form.Item
                                                {...restField}
                                                name={[field.name, 'itemName']}
                                                label="字典项名称"
                                                rules={[{ required: true }]}
                                            >
                                                <Input />
                                            </Form.Item>

                                            <Form.Item
                                                {...restField}
                                                name={[field.name, 'itemValue']}
                                                label="字典项值"
                                                rules={[{ required: true }]}
                                            >
                                                <Input />
                                            </Form.Item>

                                            <Button
                                                type="link"
                                                danger
                                                onClick={() =>
                                                    remove(field.name)
                                                }
                                            >
                                                删除
                                            </Button>
                                        </div>
                                    )
                                })}

                                <Form.Item>
                                    <Button
                                        type="dashed"
                                        onClick={() => add()}
                                        block
                                    >
                                        添加字典项
                                    </Button>
                                </Form.Item>
                            </>
                        )}
                    </Form.List>
                </Form>
            </Modal>
        </div>
    )
}

// 字典项列表组件
const DictionaryItemList: React.FC<{ items: DictionaryItem[] }> = ({
    items
}) => {
    const columns = [
        {
            title: '字典项编码',
            dataIndex: 'itemCode',
            key: 'itemCode'
        },
        {
            title: '字典项名称',
            dataIndex: 'itemName',
            key: 'itemName'
        },
        {
            title: '字典项值',
            dataIndex: 'itemValue',
            key: 'itemValue'
        },
        {
            title: '状态',
            dataIndex: 'status',
            key: 'status',
            render: (status: boolean) => <Switch checked={status} disabled />
        },
        {
            title: '排序',
            dataIndex: 'sort',
            key: 'sort'
        }
    ]

    return (
        <Table
            columns={columns}
            dataSource={items}
            pagination={false}
            rowKey="id"
        />
    )
}

export default DictionaryPage
