'use client'

import { useState, useEffect } from 'react'
import { Modal, Form, Button, message, Spin, Tabs } from 'antd'
import { updateMediaAccountApplication } from '@/app/actions/workorder/account-application'
import GoogleAccountForm from './GoogleAccountForm'
import TiktokAccountForm from './TiktokAccountForm'
// import FacebookAccountForm from './FacebookAccountForm' // 暂未实现FacebookAccountForm组件

// 定义组件属性类型
export interface EditApplicationModalProps {
    visible: boolean
    onCancel: () => void
    onSuccess: () => void
    taskId: string
    mediaPlatform: number // 1: Facebook, 2: Google, 5: TikTok
    initialData?: any // 预填充的表单数据
}

/**
 * 账户申请修改模态窗组件
 * 用于在弹窗中修改账户申请信息
 */
export default function EditApplicationModal({
    visible,
    onCancel,
    onSuccess,
    taskId,
    mediaPlatform,
    initialData
}: EditApplicationModalProps) {
    const [form] = Form.useForm()
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState<string>(getDefaultTabKey())

    // 根据mediaPlatform获取默认的Tab key
    function getDefaultTabKey() {
        switch (mediaPlatform) {
            case 1:
                return 'facebook'
            case 2:
                return 'google'
            case 5:
                return 'tiktok'
            default:
                return 'google'
        }
    }

    // 处理表单提交
    const handleSubmit = async (values: any) => {
        if (!taskId) {
            message.error('任务ID不能为空')
            return
        }

        setLoading(true)
        try {
            // 处理表单数据
            const formData = { ...values }

            // 调用更新接口
            const response = await updateMediaAccountApplication(
                formData,
                taskId,
                mediaPlatform
            )

            if (response.success) {
                message.success('申请修改成功')
                onSuccess()
            } else {
                message.error(response.message || '修改失败')
            }
        } catch (error: any) {
            message.error(error.message || '修改过程中发生错误')
        } finally {
            setLoading(false)
        }
    }

    // 返回不同平台对应的表单组件
    const renderFormByPlatform = () => {
        const commonProps = {
            onSubmit: handleSubmit,
            loading,
            initialData
        }

        switch (mediaPlatform) {
            case 1:
                // Facebook暂不支持
                return <div>Facebook账户申请修改暂未实现</div>
            case 2:
                return <GoogleAccountForm {...commonProps} />
            case 5:
                return <TiktokAccountForm {...commonProps} />
            default:
                return <div>不支持的媒体平台</div>
        }
    }

    // 模态窗标题
    const getModalTitle = () => {
        switch (mediaPlatform) {
            case 1:
                return 'Facebook账户申请修改'
            case 2:
                return 'Google账户申请修改'
            case 5:
                return 'TikTok账户申请修改'
            default:
                return '账户申请修改'
        }
    }

    return (
        <Modal
            title={getModalTitle()}
            open={visible}
            onCancel={onCancel}
            width={1000}
            footer={null}
            destroyOnClose
        >
            <Spin spinning={loading}>{renderFormByPlatform()}</Spin>
        </Modal>
    )
}
