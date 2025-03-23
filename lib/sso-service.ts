import { z } from 'zod'

// 定义登录参数验证模型
const LoginSchema = z.object({
    account: z.string(),
    password: z.string()
})

// 定义SSO Token响应类型
interface SSOTokenResponse {
    code: number
    success: boolean
    message?: string
    data: {
        token: string
    } | null
}

// 定义SSO配置响应类型
interface SSOConfigResponse {
    code: number
    success: boolean
    message?: string
    data: {
        uploadUrl: string
        downloadUrl: string
        bucketName: string
        region: string
        accessKeyId: string
        accessKeySecret: string
        stsToken: string
    } | null
}

// 定义文件上传响应类型
interface FileUploadResponse {
    code: number
    success: boolean
    message?: string
    data: {
        fileUrl: string
        fileName: string
    } | null
}

/**
 * SSO服务类
 * 负责处理SSO Token的获取、配置查询以及文件上传功能
 */
export class SSOService {
    private token: string | null = null
    private ssoConfig: SSOConfigResponse['data'] | null = null
    private baseUrl = 'https://t.zhihuiyunqi.com'
    private policyData: string | null = null
    private ossConfigUrl =
        'https://api.aivideo.aiseaer.com/video/file/temporaryUrl'

    /**
     * 获取SSO Token
     * @param account 账号
     * @param password 密码
     * @returns Promise<string> SSO Token
     */
    public async getToken(account: string, password: string): Promise<string> {
        try {
            // 验证登录参数
            LoginSchema.parse({ account, password })

            const response = await fetch(`${this.baseUrl}/auth/login/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ account, password })
            })

            const result: SSOTokenResponse = await response.json()

            if (result.code !== 200 || !result.data?.token) {
                throw new Error(result.message || '获取SSO Token失败')
            }

            this.token = result.data.token
            return this.token
        } catch (error) {
            if (error instanceof z.ZodError) {
                throw new Error(`登录参数验证失败: ${error.message}`)
            }
            throw error
        }
    }

    /**
     * 获取SSO配置
     * @returns Promise<SSOConfigResponse['data']> SSO配置
     */
    public async getSSOConfig(): Promise<SSOConfigResponse['data']> {
        if (!this.token) {
            throw new Error('未获取SSO Token，请先调用getToken方法')
        }

        try {
            // 修改为从新API获取OSS配置
            const response = await fetch(this.ossConfigUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + this.token
                }
            })

            const result: SSOConfigResponse = await response.json()

            if (!result.success || !result.data) {
                throw new Error(result.message || '获取OSS配置失败')
            }

            this.ssoConfig = result.data
            return this.ssoConfig
        } catch (error) {
            throw new Error(
                `获取OSS配置失败: ${error instanceof Error ? error.message : '未知错误'}`
            )
        }
    }

    /**
     * 上传文件
     * @param file 文件对象
     * @param directory 目录路径（可选）
     * @returns Promise<FileUploadResponse['data']> 上传结果
     */
    public async uploadFile(
        file: File,
        directory?: string
    ): Promise<FileUploadResponse['data']> {
        if (!this.ssoConfig) {
            await this.getSSOConfig()
            if (!this.ssoConfig) {
                throw new Error('获取SSO配置失败')
            }
        }

        try {
            const {
                uploadUrl,
                bucketName,
                region,
                accessKeyId,
                accessKeySecret,
                stsToken
            } = this.ssoConfig

            // 构建OSS上传路径
            const filePath = directory
                ? `${directory}/${Date.now()}_${file.name}`
                : `uploads/${Date.now()}_${file.name}`

            // 生成Policy
            const policy = this.generatePolicy()
            // 生成签名
            const signature = this.generateSignature(accessKeySecret)

            const formData = new FormData()
            formData.append('key', filePath)
            formData.append('OSSAccessKeyId', accessKeyId)
            formData.append('policy', policy)
            formData.append('signature', signature)
            formData.append('success_action_status', '200')
            formData.append('x-oss-security-token', stsToken)
            formData.append('file', file)

            const response = await fetch(uploadUrl, {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                throw new Error(`文件上传失败: ${response.statusText}`)
            }

            // 构建文件下载URL
            const fileUrl = `${this.ssoConfig.downloadUrl}/${filePath}`

            return {
                fileUrl,
                fileName: file.name
            }
        } catch (error) {
            throw new Error(
                `文件上传失败: ${error instanceof Error ? error.message : '未知错误'}`
            )
        }
    }

    /**
     * 生成Policy
     * @returns string Base64编码的Policy
     */
    private generatePolicy(): string {
        const expiration = new Date()
        expiration.setHours(expiration.getHours() + 1) // 设置过期时间为1小时

        const policy = {
            expiration: expiration.toISOString(),
            conditions: [
                { bucket: this.ssoConfig?.bucketName },
                ['content-length-range', 0, 104857600] // 100MB 大小限制
            ]
        }

        this.policyData = btoa(JSON.stringify(policy))
        return this.policyData
    }

    /**
     * 生成签名
     * 注意：实际项目中应导入crypto-js或使用Node.js的crypto模块
     * @param accessKeySecret 访问密钥
     * @returns string 签名
     */
    private generateSignature(accessKeySecret: string): string {
        if (!this.policyData) {
            this.generatePolicy()
        }

        // 实际项目中的签名实现
        // 浏览器端可以使用crypto-js库
        // 服务端可以使用Node.js的crypto模块
        /*
        // 浏览器端示例:
        import CryptoJS from 'crypto-js'
        const hmac = CryptoJS.HmacSHA1(this.policyData!, accessKeySecret)
        return CryptoJS.enc.Base64.stringify(hmac)
        
        // Node.js服务端示例:
        const crypto = require('crypto')
        const hmac = crypto.createHmac('sha1', accessKeySecret)
        hmac.update(this.policyData!)
        return hmac.digest('base64')
        */

        // 这里提供一个临时实现，实际项目中应替换为上述真实实现之一
        // 模拟实现，用于演示
        const mockSignature = btoa(
            `${accessKeySecret}:${this.policyData}`
        ).substring(0, 28)
        console.log('警告: 使用模拟签名，生产环境请使用真实的加密算法')
        return mockSignature
    }
}

export default SSOService
