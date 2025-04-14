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
    private static readonly STORAGE_KEY = 'sso_initialized_state'

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
        // 检查是否已经初始化
        if (this.isInitialized) {
            console.log('SSO服务已初始化，无需重复初始化')
            return
        }

        // 尝试从sessionStorage恢复状态
        try {
            const storedState = sessionStorage.getItem(this.STORAGE_KEY)
            if (storedState === 'true') {
                console.log('从sessionStorage恢复SSO初始化状态')
                this.isInitialized = true

                // 即使从存储恢复了状态，仍然需要重新创建服务实例
                this.ssoService = new SSOService()

                // 尝试恢复Token和配置
                try {
                    await this.ssoService.getToken(account, password)
                    await this.ssoService.getSSOConfig()
                    console.log('成功恢复SSO服务状态')
                    return
                } catch (restoreError) {
                    console.warn('恢复SSO状态失败，将重新初始化:', restoreError)
                    this.isInitialized = false
                    sessionStorage.removeItem(this.STORAGE_KEY)
                }
            }
        } catch (storageError) {
            console.warn('读取sessionStorage失败:', storageError)
        }

        // 正常初始化流程
        try {
            console.log('开始初始化SSO服务...')
            this.ssoService = new SSOService()
            await this.ssoService.getToken(account, password)
            await this.ssoService.getSSOConfig()
            this.isInitialized = true

            // 保存初始化状态到sessionStorage
            try {
                sessionStorage.setItem(this.STORAGE_KEY, 'true')
                console.log('SSO初始化状态已保存到sessionStorage')
            } catch (storageError) {
                console.warn('保存到sessionStorage失败:', storageError)
            }

            console.log('SSO服务初始化完成')
        } catch (error) {
            console.error('初始化SSO服务失败:', error)
            this.isInitialized = false

            // 清除可能存在的错误状态
            try {
                sessionStorage.removeItem(this.STORAGE_KEY)
            } catch (e) {
                /* 忽略清除错误 */
            }

            throw new Error(
                `初始化SSO服务失败: ${error instanceof Error ? error.message : '未知错误'}`
            )
        }
    }

    /**
     * 重置初始化状态
     * 当出现问题需要强制重新初始化时使用
     */
    public static resetInitializationState(): void {
        this.isInitialized = false
        this.ssoService = null

        try {
            sessionStorage.removeItem(this.STORAGE_KEY)
            console.log('SSO初始化状态已重置')
        } catch (e) {
            console.warn('清除sessionStorage状态失败:', e)
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

    /**
     * 格式化上传结果为Antd UploadFile格式
     * @param files 上传结果
     * @returns UploadFile格式的文件列表
     */
    public static formatToUploadFileList(files: UploadResult[] | any[]): any[] {
        return files.map((file) => {
            const fileUrl = file.fileUrl || file.url || file.response?.url
            const fileName =
                file.fileName ||
                file.name ||
                file.response?.fileName ||
                'file.jpg'

            return {
                uid: fileUrl || `-${Date.now()}`,
                name: fileName,
                status: 'done',
                url: fileUrl,
                type: file.fileType || file.type,
                size: file.fileSize || file.size
            }
        })
    }
}

export default FileUploadUtil
