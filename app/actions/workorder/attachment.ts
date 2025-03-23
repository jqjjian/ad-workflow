'use server'

import { db } from '@/lib/db'
import { withAuth } from '@/lib/auth-actions'
import { generateWorkOrderNumber } from '../utils/workorder-utils'
import { Logger } from '@/lib/logger'
import { ApiResponse } from '@/schemas/third-party-type'
import { WorkOrderType, WorkOrderSubtype } from '@prisma/client'
import { getOssClient } from '../utils/oss-client'

/**
 * 获取OSS上传凭证
 */
export async function getOssUploadCredentials(params: {
    fileName: string
    fileType: string
    userId: string | undefined
}): Promise<
    ApiResponse<{ uploadUrl: string; formData: Record<string, string> }>
> {
    return withAuth(async () => {
        const { fileName, fileType, userId } = params

        if (!userId) {
            return { code: '401', success: false, message: '用户ID不能为空' }
        }

        try {
            // 获取OSS上传凭证
            const ossClient = getOssClient()
            const now = new Date()
            const ossPath = `users/${userId}/${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}/${fileName}`

            // 这里应该调用阿里云OSS的SDK获取上传凭证
            // 具体实现会依赖于您使用的OSS客户端
            const credentials = {
                uploadUrl: 'https://your-bucket.oss-cn-region.aliyuncs.com',
                formData: {
                    key: ossPath,
                    policy: 'base64-policy',
                    OSSAccessKeyId: 'your-access-key',
                    signature: 'generated-signature'
                }
            }

            return {
                code: '0',
                success: true,
                data: credentials
            }
        } catch (error) {
            Logger.error(
                `获取OSS上传凭证失败: ${error instanceof Error ? error.message : String(error)}`
            )
            return {
                code: '1',
                success: false,
                message: error instanceof Error ? error.message : '未知错误'
            }
        }
    })
}

/**
 * 创建附件记录
 */
export async function createAttachmentRecord(
    data: {
        fileName: string
        fileType: string
        fileSize: number
        filePath: string
        ossObjectKey: string
        fileUrl: string
        description?: string
        relatedTaskId?: string // 关联的其他任务ID（可选）
    },
    userId: string | undefined
): Promise<ApiResponse<{ attachmentId: number; taskId: string }>> {
    return withAuth(async () => {
        if (!userId) {
            return { code: '401', success: false, message: '用户ID不能为空' }
        }

        try {
            // 1. 生成工单编号
            const taskNumber = generateWorkOrderNumber(
                WorkOrderType.ATTACHMENT_MANAGEMENT,
                WorkOrderSubtype.DOCUMENT_UPLOAD
            )

            // 2. 创建附件任务
            const task = await db.tecdo_third_party_tasks.create({
                data: {
                    taskNumber,
                    taskId: taskNumber,
                    typeId: 4, // 附件管理类型ID
                    workOrderType: WorkOrderType.ATTACHMENT_MANAGEMENT,
                    workOrderSubtype: data.fileType.startsWith('image/')
                        ? WorkOrderSubtype.IMAGE_UPLOAD
                        : WorkOrderSubtype.DOCUMENT_UPLOAD,
                    status: 'SUCCESS', // 附件上传通常是直接成功
                    userId,
                    rawData: JSON.stringify(data)
                }
            })

            // 3. 创建附件记录
            const attachment = await db.attachmentRecord.create({
                data: {
                    taskId: task.taskId,
                    userId,
                    fileName: data.fileName,
                    fileType: data.fileType,
                    fileSize: data.fileSize,
                    filePath: data.filePath,
                    ossObjectKey: data.ossObjectKey,
                    fileUrl: data.fileUrl,
                    description: data.description,
                    uploadStatus: 'SUCCESS'
                }
            })

            // 4. 如果有关联的其他任务，创建关联
            if (data.relatedTaskId) {
                // 这里需要实现关联逻辑，可能需要添加一个关联表
            }

            return {
                code: '0',
                success: true,
                data: {
                    attachmentId: attachment.id,
                    taskId: task.taskId
                }
            }
        } catch (error) {
            Logger.error(
                `创建附件记录失败: ${error instanceof Error ? error.message : String(error)}`
            )
            return {
                code: '1',
                success: false,
                message: error instanceof Error ? error.message : '未知错误'
            }
        }
    })
}

/**
 * 查询附件列表
 */
export async function getAttachments(params: {
    page?: number
    pageSize?: number
    userId?: string
    fileType?: string
    dateRange?: { start: Date; end: Date }
    relatedTaskId?: string
}): Promise<ApiResponse<{ total: number; items: any[] }>> {
    return withAuth(async () => {
        try {
            const {
                page = 1,
                pageSize = 10,
                userId,
                fileType,
                dateRange,
                relatedTaskId
            } = params

            // 构建查询条件
            const where = {
                ...(userId && { userId }),
                ...(fileType && { fileType: { contains: fileType } }),
                ...(dateRange && {
                    createdAt: {
                        gte: dateRange.start,
                        lte: dateRange.end
                    }
                })
            }

            // 如果有关联任务ID，添加过滤条件
            // 这里需要根据您的具体关联表结构调整

            // 查询总数
            const total = await db.attachmentRecord.count({ where })

            // 查询数据
            const items = await db.attachmentRecord.findMany({
                where,
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: {
                    task: true
                },
                orderBy: { createdAt: 'desc' }
            })

            return {
                code: '0',
                success: true,
                data: { total, items }
            }
        } catch (error) {
            Logger.error(
                `查询附件列表失败: ${error instanceof Error ? error.message : String(error)}`
            )
            return {
                code: '1',
                success: false,
                message: error instanceof Error ? error.message : '未知错误'
            }
        }
    })
}

/**
 * 软删除附件
 */
export async function deleteAttachment(
    attachmentId: number,
    userId: string | undefined
): Promise<ApiResponse<void>> {
    return withAuth(async () => {
        if (!userId) {
            return { code: '401', success: false, message: '用户ID不能为空' }
        }

        try {
            // 1. 查找附件
            const attachment = await db.attachmentRecord.findFirst({
                where: { id: attachmentId, userId },
                include: { task: true }
            })

            if (!attachment) {
                return { code: '404', success: false, message: '找不到附件' }
            }

            // 2. 软删除附件（更新状态）
            await db.attachmentRecord.update({
                where: { id: attachmentId },
                data: {
                    uploadStatus: 'DELETED'
                }
            })

            // 3. 更新对应的工单状态
            if (attachment.task) {
                await db.tecdo_third_party_tasks.update({
                    where: { taskId: attachment.taskId },
                    data: {
                        status: 'CANCELLED'
                    }
                })
            }

            return {
                code: '0',
                success: true,
                message: '附件已删除'
            }
        } catch (error) {
            Logger.error(
                `删除附件失败: ${error instanceof Error ? error.message : String(error)}`
            )
            return {
                code: '1',
                success: false,
                message: error instanceof Error ? error.message : '未知错误'
            }
        }
    })
}

/**
 *
 */
