import { SSOService } from './sso-service'
import { UploadResult, UploadType } from '@/utils/file-upload'
import { db } from '@/lib/db'

export class AttachmentService {
    private ssoService: SSOService

    constructor() {
        this.ssoService = new SSOService()
    }

    // 初始化SSO配置
    async initializeSSO(token?: string) {
        try {
            let ssoToken = token
            if (!ssoToken) {
                // 如果没有传入token，使用默认账号获取
                ssoToken = await this.ssoService.getToken(
                    '13268125705',
                    'aa123456'
                )
            }
            console.log('获取SSO Token成功:', ssoToken)

            // 获取阿里云OSS配置
            const config = await this.ssoService.getSSOConfig()
            console.log('获取阿里云OSS配置成功:', config)

            return { success: true, token: ssoToken, config }
        } catch (error) {
            console.error('获取OSS配置失败:', error)
            return { success: false, error }
        }
    }

    // 创建附件记录
    async createAttachmentRecord(data: {
        workOrderCompanyInfoId: string
        fileName: string
        fileType: string
        fileSize: number
        filePath: string
        ossObjectKey: string
        fileUrl: string
        description?: string
    }) {
        try {
            const attachment =
                await db.tecdo_workorder_company_attachments.create({
                    data: {
                        workOrderCompanyInfoId: data.workOrderCompanyInfoId,
                        fileName: data.fileName,
                        fileType: data.fileType,
                        fileSize: data.fileSize,
                        filePath: data.filePath,
                        ossObjectKey: data.ossObjectKey,
                        fileUrl: data.fileUrl,
                        description: data.description
                    }
                })
            return { success: true, data: attachment }
        } catch (error) {
            console.error('创建附件记录失败:', error)
            return { success: false, error }
        }
    }

    // 批量创建附件记录
    async createAttachmentRecords(
        records: {
            workOrderCompanyInfoId: string
            fileName: string
            fileType: string
            fileSize: number
            filePath: string
            ossObjectKey: string
            fileUrl: string
            description?: string
        }[]
    ) {
        try {
            const attachments =
                await db.tecdo_workorder_company_attachments.createMany({
                    data: records
                })
            return { success: true, data: attachments }
        } catch (error) {
            console.error('批量创建附件记录失败:', error)
            return { success: false, error }
        }
    }
}
