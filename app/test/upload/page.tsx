'use client'

import React, { useState, useEffect } from 'react'
import { Button, Card, Spin, message } from 'antd'
import { SSOService } from '@/lib/sso-service'
import FileUploader from '@/components/account-application/FileUploader'
import { UploadResult, UploadType } from '@/utils/file-upload'

// 使用新API获取OSS配置
async function initializeSSO() {
    try {
        const ssoService = new SSOService()
        const token = await ssoService.getToken('13268125705', 'aa123456')
        console.log('获取SSO Token成功:', token)

        // 从新API获取阿里云OSS配置
        const config = await ssoService.getSSOConfig()
        console.log('获取阿里云OSS配置成功:', config)

        return { success: true, token, config }
    } catch (error) {
        console.error('获取OSS配置失败:', error)
        return { success: false, error }
    }
}

export default function AttachmentUploadPage() {
    const [files, setFiles] = useState<UploadResult[]>([])
    const [ssoInitialized, setSsoInitialized] = useState(false)
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<any>(null)

    // 处理文件上传改变
    const handleFilesChange = (uploadedFiles: UploadResult[]) => {
        setFiles(uploadedFiles)
    }

    // 初始化SSO
    const handleInitSSO = async () => {
        setLoading(true)
        const initResult = await initializeSSO()
        setResult(initResult)
        setSsoInitialized(initResult.success)
        setLoading(false)
    }

    // 提交表单
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        // 模拟表单提交
        setLoading(true)
        setTimeout(() => {
            setResult({
                success: true,
                message: '附件上传成功',
                data: {
                    requestId: 'REQ' + Date.now(),
                    files
                }
            })
            setLoading(false)
        }, 1000)
    }

    return (
        <div className="mx-auto max-w-2xl p-6">
            <h1 className="mb-6 text-2xl font-bold">文件上传</h1>

            <Card className="mb-8">
                <h2 className="mb-4 text-lg font-medium">获取阿里云OSS配置</h2>
                <p className="mb-4 text-sm text-gray-500">
                    从 https://api.aivideo.aiseaer.com/video/file/temporaryUrl
                    获取阿里云OSS临时配置
                </p>
                <Button
                    type="primary"
                    onClick={handleInitSSO}
                    loading={loading && !ssoInitialized}
                    disabled={ssoInitialized}
                    className="mb-4"
                >
                    {ssoInitialized ? '已获取OSS配置' : '获取OSS配置'}
                </Button>

                {result && (
                    <div className="rounded border bg-white p-3 text-sm">
                        <pre className="max-h-60 overflow-auto whitespace-pre-wrap">
                            {JSON.stringify(result, null, 2)}
                        </pre>
                    </div>
                )}
            </Card>

            <Spin spinning={loading && ssoInitialized}>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <label className="block text-sm font-medium">
                            上传附件
                        </label>
                        <FileUploader
                            onChange={handleFilesChange}
                            uploadType={UploadType.GENERAL}
                            maxFiles={5}
                            acceptedFileTypes="*"
                            maxFileSize={10}
                        />
                        <p className="text-xs text-gray-500">
                            支持所有文件类型，每个文件不超过10MB
                        </p>
                    </div>

                    <Button
                        type="primary"
                        htmlType="submit"
                        disabled={
                            loading || !ssoInitialized || files.length === 0
                        }
                        block
                    >
                        {loading ? '上传中...' : '提交'}
                    </Button>
                </form>
            </Spin>

            {result?.success && result?.data && (
                <div className="mt-6 rounded border border-green-200 bg-green-50 p-4">
                    <h3 className="font-medium text-green-800">上传成功</h3>
                    <p className="mt-1 text-sm text-green-700">
                        请求ID: {result.data.requestId}
                    </p>
                    <p className="mb-2 text-sm text-green-700">
                        已上传 {files.length} 个文件
                    </p>

                    <div className="mt-2">
                        <h4 className="text-sm font-medium">文件列表:</h4>
                        <ul className="mt-1">
                            {files.map((file, index) => (
                                <li key={index} className="text-sm">
                                    <a
                                        href={file.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline"
                                    >
                                        {file.fileName}
                                    </a>
                                    {file.fileSize && (
                                        <span className="ml-2 text-gray-500">
                                            (
                                            {(
                                                file.fileSize /
                                                1024 /
                                                1024
                                            ).toFixed(2)}{' '}
                                            MB)
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    )
}
