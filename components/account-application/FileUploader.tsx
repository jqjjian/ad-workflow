'use client'

import React, { useState, useRef, useCallback } from 'react'
import { FileUploadUtil, UploadType, UploadResult } from '@/utils/file-upload'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface FileUploaderProps {
    onChange: (files: UploadResult[]) => void
    maxFiles?: number
    acceptedFileTypes?: string
    maxFileSize?: number // 单位 MB
    uploadType?: UploadType
    customPath?: string
}

const FileUploader: React.FC<FileUploaderProps> = ({
    onChange,
    maxFiles = 5,
    acceptedFileTypes = '*',
    maxFileSize = 10, // 默认10MB
    uploadType = UploadType.ACCOUNT_APPLICATION,
    customPath
}) => {
    const [uploadedFiles, setUploadedFiles] = useState<UploadResult[]>([])
    const [uploading, setUploading] = useState<boolean>(false)
    const [progress, setProgress] = useState<number>(0)
    const [error, setError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleFileSelection = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            if (!e.target.files || e.target.files.length === 0) {
                return
            }

            // 检查文件数量是否超过最大值
            if (uploadedFiles.length + e.target.files.length > maxFiles) {
                setError(`最多只能上传${maxFiles}个文件`)
                return
            }

            setError(null)
            setUploading(true)

            const files = Array.from(e.target.files)
            let validFiles: File[] = []
            let invalidFiles: string[] = []

            // 验证文件类型和大小
            files.forEach((file) => {
                const isValidType =
                    acceptedFileTypes === '*' ||
                    (file.type &&
                        acceptedFileTypes
                            .split(',')
                            .some((type) => file.type.match(type.trim())))
                const isValidSize = file.size <= maxFileSize * 1024 * 1024

                if (isValidType && isValidSize) {
                    validFiles.push(file)
                } else {
                    if (!isValidType) {
                        invalidFiles.push(`${file.name}: 不支持的文件类型`)
                    } else {
                        invalidFiles.push(
                            `${file.name}: 文件大小超过${maxFileSize}MB限制`
                        )
                    }
                }
            })

            if (invalidFiles.length > 0) {
                setError(invalidFiles.join(', '))
                setUploading(false)
                return
            }

            try {
                // 模拟进度
                const progressInterval = setInterval(() => {
                    setProgress((prev) => {
                        const newProgress = prev + Math.random() * 10
                        return newProgress > 90 ? 90 : newProgress
                    })
                }, 200)

                // 上传文件
                const results = await FileUploadUtil.uploadMultipleFiles(
                    validFiles,
                    uploadType,
                    customPath
                )

                clearInterval(progressInterval)
                setProgress(100)

                // 更新已上传文件列表
                const newUploadedFiles = [...uploadedFiles, ...results]
                setUploadedFiles(newUploadedFiles)
                onChange(newUploadedFiles)

                // 重置文件输入
                if (fileInputRef.current) {
                    fileInputRef.current.value = ''
                }
            } catch (err) {
                setError(
                    `上传失败: ${err instanceof Error ? err.message : '未知错误'}`
                )
            } finally {
                setTimeout(() => {
                    setUploading(false)
                    setProgress(0)
                }, 500)
            }
        },
        [
            uploadedFiles,
            maxFiles,
            maxFileSize,
            acceptedFileTypes,
            uploadType,
            customPath,
            onChange
        ]
    )

    const removeFile = useCallback(
        (index: number) => {
            const newFiles = [...uploadedFiles]
            newFiles.splice(index, 1)
            setUploadedFiles(newFiles)
            onChange(newFiles)
        },
        [uploadedFiles, onChange]
    )

    const handleButtonClick = useCallback(() => {
        if (fileInputRef.current) {
            fileInputRef.current.click()
        }
    }, [])

    return (
        <div className="w-full space-y-4">
            <div className="flex items-center justify-between">
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelection}
                    accept={acceptedFileTypes}
                    multiple={maxFiles > 1}
                    className="hidden"
                    disabled={uploading}
                />
                <Button
                    type="button"
                    onClick={handleButtonClick}
                    disabled={uploading || uploadedFiles.length >= maxFiles}
                    variant="outline"
                    className="w-full"
                >
                    {uploading ? '上传中...' : '选择文件'}
                </Button>
            </div>

            {uploading && (
                <div className="w-full space-y-2">
                    <Progress value={progress} className="h-2 w-full" />
                    <p className="text-center text-sm text-gray-500">
                        {Math.round(progress)}%
                    </p>
                </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                    <p className="text-sm font-medium">
                        已上传文件 ({uploadedFiles.length}/{maxFiles})
                    </p>
                    <ul className="space-y-2">
                        {uploadedFiles.map((file, index) => (
                            <li
                                key={index}
                                className="flex items-center justify-between rounded bg-gray-50 p-2"
                            >
                                <div className="flex items-center space-x-2 truncate">
                                    <span className="truncate text-sm">
                                        {file.fileName}
                                    </span>
                                    {file.fileSize && (
                                        <span className="text-xs text-gray-500">
                                            {(
                                                file.fileSize /
                                                1024 /
                                                1024
                                            ).toFixed(2)}{' '}
                                            MB
                                        </span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeFile(index)}
                                    className="text-red-500 hover:text-red-700"
                                >
                                    删除
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}

export default FileUploader
