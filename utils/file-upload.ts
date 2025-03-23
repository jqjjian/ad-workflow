import SSOService from '@/lib/sso-service'

// 默认的SSO账户信息
const DEFAULT_SSO_ACCOUNT = '13268125705'
const DEFAULT_SSO_PASSWORD = 'aa123456'

// 上传类型枚举
export enum UploadType {
    ACCOUNT_APPLICATION = 'account-application',
    RECHARGE = 'recharge',
    GENERAL = 'general'
}

// 上传结果类型
export interface UploadResult {
    fileUrl: string
    fileName: string
    fileSize?: number
    fileType?: string
}

/**
 * 文件上传工具类
 * 负责处理与SSO服务的交互并上传文件
 */
export class FileUploadUtil {
    private static ssoService: SSOService | null = null
    private static isInitialized = false

    /**
     * 初始化SSO服务
     * @param account SSO账号，可选
     * @param password SSO密码，可选
     * @returns Promise<void>
     */
    public static async initialize(
        account: string = DEFAULT_SSO_ACCOUNT,
        password: string = DEFAULT_SSO_PASSWORD
    ): Promise<void> {
        if (this.isInitialized) {
            return
        }

        try {
            this.ssoService = new SSOService()
            await this.ssoService.getToken(account, password)
            await this.ssoService.getSSOConfig()
            this.isInitialized = true
        } catch (error) {
            console.error('初始化SSO服务失败:', error)
            throw new Error(
                `初始化SSO服务失败: ${error instanceof Error ? error.message : '未知错误'}`
            )
        }
    }

    /**
     * 上传文件
     * @param file 文件对象
     * @param type 上传类型
     * @param customPath 自定义路径
     * @returns Promise<UploadResult>
     */
    public static async uploadFile(
        file: File,
        type: UploadType = UploadType.GENERAL,
        customPath?: string
    ): Promise<UploadResult> {
        if (!this.isInitialized || !this.ssoService) {
            await this.initialize()
        }

        // 根据上传类型确定目录路径
        let directory = customPath
        if (!directory) {
            const userId = 'user_' + Math.floor(Math.random() * 1000000) // 替换为实际用户ID
            const date = new Date().toISOString().split('T')[0]

            switch (type) {
                case UploadType.ACCOUNT_APPLICATION:
                    directory = `account-application/${userId}/${date}`
                    break
                case UploadType.RECHARGE:
                    directory = `recharge/${userId}/${date}`
                    break
                case UploadType.GENERAL:
                default:
                    directory = `general/${userId}/${date}`
                    break
            }
        }

        try {
            const result = await this.ssoService!.uploadFile(file, directory)

            if (!result) {
                throw new Error('上传文件失败')
            }

            return {
                fileUrl: result.fileUrl,
                fileName: result.fileName,
                fileSize: file.size,
                fileType: file.type
            }
        } catch (error) {
            console.error('上传文件失败:', error)
            throw new Error(
                `上传文件失败: ${error instanceof Error ? error.message : '未知错误'}`
            )
        }
    }

    /**
     * 批量上传文件
     * @param files 文件列表
     * @param type 上传类型
     * @param customPath 自定义路径
     * @returns Promise<UploadResult[]>
     */
    public static async uploadMultipleFiles(
        files: File[],
        type: UploadType = UploadType.GENERAL,
        customPath?: string
    ): Promise<UploadResult[]> {
        if (!this.isInitialized || !this.ssoService) {
            await this.initialize()
        }

        const uploadPromises = files.map((file) =>
            this.uploadFile(file, type, customPath)
        )
        return await Promise.all(uploadPromises)
    }
}

export default FileUploadUtil
