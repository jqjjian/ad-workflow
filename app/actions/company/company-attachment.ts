import { db } from '@/lib/db'
import { auth } from '@/auth'
import { ApiResponse, ApiResponseBuilder } from '@/utils/api-response'
import { uploadToOSS } from '@/lib/oss-upload' // 假设已存在的OSS上传函数

/**
 * 上传企业附件
 */
export async function uploadCompanyAttachment(
    companyInfoId: string,
    file: File,
    description?: string
): Promise<ApiResponse> {
    const session = await auth()
    if (!session) {
        return ApiResponseBuilder.error('401', '未登录')
    }

    try {
        // 验证企业信息所有权
        const companyInfo = await db.tecdo_user_company_info.findUnique({
            where: { id: companyInfoId }
        })

        if (!companyInfo) {
            return ApiResponseBuilder.error('404', '企业信息不存在')
        }

        if (companyInfo.userId !== session.user.id) {
            return ApiResponseBuilder.error('403', '无权为此企业信息上传附件')
        }

        // 上传至OSS
        const ossResult = await uploadToOSS(file)

        // 保存附件记录
        const attachment = await db.companyAttachment.create({
            data: {
                companyInfoId,
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size,
                filePath: ossResult.filePath,
                ossObjectKey: ossResult.objectKey,
                fileUrl: ossResult.fileUrl,
                description,
                uploadStatus: 'SUCCESS'
            }
        })

        return ApiResponseBuilder.success({
            id: attachment.id,
            fileUrl: attachment.fileUrl,
            fileName: attachment.fileName,
            message: '附件上传成功'
        })
    } catch (error) {
        return ApiResponseBuilder.error(
            '1',
            error instanceof Error ? error.message : '附件上传失败'
        )
    }
}

/**
 * 删除企业附件
 */
export async function deleteCompanyAttachment(
    id: string
): Promise<ApiResponse> {
    const session = await auth()
    if (!session) {
        return ApiResponseBuilder.error('401', '未登录')
    }

    try {
        // 获取附件信息及所属企业信息
        const attachment = await db.companyAttachment.findUnique({
            where: { id },
            include: { companyInfo: true }
        })

        if (!attachment) {
            return ApiResponseBuilder.error('404', '附件不存在')
        }

        // 验证所有权
        if (attachment.companyInfo.userId !== session.user.id) {
            return ApiResponseBuilder.error('403', '无权删除此附件')
        }

        // 从OSS删除文件
        // const deleteResult = await deleteFromOSS(attachment.ossObjectKey)

        // 删除数据库记录
        await db.companyAttachment.delete({
            where: { id }
        })

        return ApiResponseBuilder.success({
            message: '附件删除成功'
        })
    } catch (error) {
        return ApiResponseBuilder.error(
            '1',
            error instanceof Error ? error.message : '删除附件失败'
        )
    }
}
