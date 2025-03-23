import { db } from '@/lib/db'
import { auth } from '@/auth'
import { ApiResponse, ApiResponseBuilder } from '@/utils/api-response'
import {
    UserCompanyInfoSchema,
    UserCompanyAttachmentSchema
} from '@/schemas/company-info'

/**
 * 创建或更新用户企业信息
 */
export async function saveUserCompanyInfo(
    data: UserCompanyInfo
): Promise<ApiResponse> {
    const session = await auth()
    if (!session) {
        return ApiResponseBuilder.error('401', '未登录')
    }

    const userId = session.user.id

    try {
        const validatedData = UserCompanyInfoSchema.parse(data)

        // 如果设置为默认，取消其他默认项
        if (validatedData.isDefault) {
            await db.tecdo_user_company_info.updateMany({
                where: { userId, isDefault: true },
                data: { isDefault: false }
            })
        }

        // 更新或创建
        if (validatedData.id) {
            // 验证所有权
            const existing = await db.tecdo_user_company_info.findUnique({
                where: { id: validatedData.id }
            })

            if (!existing || existing.userId !== userId) {
                return ApiResponseBuilder.error('403', '无权操作此企业信息')
            }

            // 更新企业信息
            const updated = await db.tecdo_user_company_info.update({
                where: { id: validatedData.id },
                data: {
                    companyNameCN: validatedData.companyNameCN,
                    companyNameEN: validatedData.companyNameEN,
                    businessLicenseNo: validatedData.businessLicenseNo,
                    location: validatedData.location,
                    legalRepName: validatedData.legalRepName,
                    idType: validatedData.idType,
                    idNumber: validatedData.idNumber,
                    legalRepPhone: validatedData.legalRepPhone,
                    legalRepBankCard: validatedData.legalRepBankCard,
                    isDefault: validatedData.isDefault
                }
            })

            return ApiResponseBuilder.success({
                id: updated.id,
                message: '企业信息更新成功'
            })
        } else {
            // 创建新企业信息
            const created = await db.tecdo_user_company_info.create({
                data: {
                    userId,
                    companyNameCN: validatedData.companyNameCN,
                    companyNameEN: validatedData.companyNameEN,
                    businessLicenseNo: validatedData.businessLicenseNo,
                    location: validatedData.location,
                    legalRepName: validatedData.legalRepName,
                    idType: validatedData.idType,
                    idNumber: validatedData.idNumber,
                    legalRepPhone: validatedData.legalRepPhone,
                    legalRepBankCard: validatedData.legalRepBankCard,
                    isDefault: validatedData.isDefault
                }
            })

            return ApiResponseBuilder.success({
                id: created.id,
                message: '企业信息创建成功'
            })
        }
    } catch (error) {
        return ApiResponseBuilder.error(
            '1',
            error instanceof Error ? error.message : '保存企业信息失败'
        )
    }
}

/**
 * 获取用户企业信息列表
 */
export async function getUserCompanyInfos(): Promise<ApiResponse> {
    const session = await auth()
    if (!session) {
        return ApiResponseBuilder.error('401', '未登录')
    }

    try {
        const companyInfos = await db.tecdo_user_company_info.findMany({
            where: { userId: session.user.id },
            include: { attachments: true },
            orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
        })

        return ApiResponseBuilder.success(companyInfos)
    } catch (error) {
        return ApiResponseBuilder.error(
            '1',
            error instanceof Error ? error.message : '获取企业信息失败'
        )
    }
}

/**
 * 获取单个企业信息详情
 */
export async function getUserCompanyInfo(id: string): Promise<ApiResponse> {
    const session = await auth()
    if (!session) {
        return ApiResponseBuilder.error('401', '未登录')
    }

    try {
        const companyInfo = await db.tecdo_user_company_info.findUnique({
            where: { id },
            include: { attachments: true }
        })

        if (!companyInfo) {
            return ApiResponseBuilder.error('404', '企业信息不存在')
        }

        // 验证所有权
        if (companyInfo.userId !== session.user.id) {
            return ApiResponseBuilder.error('403', '无权访问此企业信息')
        }

        return ApiResponseBuilder.success(companyInfo)
    } catch (error) {
        return ApiResponseBuilder.error(
            '1',
            error instanceof Error ? error.message : '获取企业信息失败'
        )
    }
}

/**
 * 上传企业附件
 */
export async function uploadUserCompanyAttachment(
    companyInfoId: string,
    fileData: any
): Promise<ApiResponse> {
    const session = await auth()
    if (!session) {
        return ApiResponseBuilder.error('401', '未登录')
    }

    try {
        // 验证文件数据
        const validatedFileData = UserCompanyAttachmentSchema.parse(fileData)

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

        // 创建附件记录
        const attachment = await db.tecdo_usersCompanyAttachment.create({
            data: {
                userCompanyInfoId: companyInfoId,
                fileName: validatedFileData.fileName,
                fileType: validatedFileData.fileType,
                fileSize: validatedFileData.fileSize,
                filePath: validatedFileData.filePath,
                ossObjectKey: validatedFileData.ossObjectKey,
                fileUrl: validatedFileData.fileUrl,
                description: validatedFileData.description,
                uploadStatus: 'SUCCESS'
            }
        })

        return ApiResponseBuilder.success({
            id: attachment.id,
            fileUrl: attachment.fileUrl,
            fileName: attachment.fileName
        })
    } catch (error) {
        return ApiResponseBuilder.error(
            '1',
            error instanceof Error ? error.message : '上传附件失败'
        )
    }
}

/**
 * 删除企业附件
 */
export async function deleteUserCompanyAttachment(
    attachmentId: string
): Promise<ApiResponse> {
    const session = await auth()
    if (!session) {
        return ApiResponseBuilder.error('401', '未登录')
    }

    try {
        // 获取附件信息及所属企业信息
        const attachment = await db.tecdo_usersCompanyAttachment.findUnique({
            where: { id: attachmentId },
            include: { userCompanyInfo: true }
        })

        if (!attachment) {
            return ApiResponseBuilder.error('404', '附件不存在')
        }

        // 验证所有权
        if (attachment.userCompanyInfo.userId !== session.user.id) {
            return ApiResponseBuilder.error('403', '无权删除此附件')
        }

        // 删除附件记录
        await db.tecdo_usersCompanyAttachment.delete({
            where: { id: attachmentId }
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

/**
 * 删除企业信息
 */
export async function deleteUserCompanyInfo(
    companyInfoId: string
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
            return ApiResponseBuilder.error('403', '无权删除此企业信息')
        }

        // 检查是否有关联工单
        const relatedWorkOrders = await db.tecdo_work_ordersCompanyInfo.findFirst({
            where: { userCompanyInfoId: companyInfoId }
        })

        if (relatedWorkOrders) {
            return ApiResponseBuilder.error(
                '400',
                '该企业信息已关联工单，无法删除'
            )
        }

        // 删除企业信息
        await db.tecdo_user_company_info.delete({
            where: { id: companyInfoId }
        })

        return ApiResponseBuilder.success({
            message: '企业信息删除成功'
        })
    } catch (error) {
        return ApiResponseBuilder.error(
            '1',
            error instanceof Error ? error.message : '删除企业信息失败'
        )
    }
}
