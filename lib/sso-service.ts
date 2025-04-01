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
    // success: boolean
    msg?: string
    data: {
        bucket: string
        durationSeconds: number
        region: string
        accessKeyId: string
        accessKeySecret: string
        securityToken: string
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
                },
                body: JSON.stringify({
                    file_type: 1
                })
            })

            const result: SSOConfigResponse = await response.json()

            // if (!result.success || !result.data) {
            //     throw new Error(result.message || '获取OSS配置失败')
            // }
            if (result.code !== 200 || !result.data) {
                throw new Error(result.msg || '获取OSS配置失败')
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
                bucket,
                region,
                accessKeyId,
                accessKeySecret,
                securityToken
            } = this.ssoConfig

            console.log('OSS配置：', {
                bucket,
                region,
                hasAccessKeyId: !!accessKeyId,
                hasSecurityToken: !!securityToken
            })

            // 构建OSS上传路径
            const filePath = directory
                ? `${directory}/${Date.now()}_${file.name}`
                : `uploads/${Date.now()}_${file.name}`

            console.log('上传路径：', filePath)
            console.log('文件信息：', {
                name: file.name,
                size: file.size,
                type: file.type
            })

            try {
                // 首先尝试使用SDK上传
                // 引入OSS SDK
                const OSS = (await import('ali-oss')).default

                // 创建OSS客户端
                const client = new OSS({
                    region: region,
                    accessKeyId,
                    accessKeySecret,
                    bucket,
                    stsToken: securityToken,
                    secure: true, // 使用HTTPS
                    timeout: 60000 // 60秒超时
                })

                // 使用OSS SDK上传文件
                console.log('开始SDK上传文件...')
                const result = await client.put(filePath, file, {
                    mime: file.type,
                    headers: {
                        'Content-Disposition': `attachment; filename=${encodeURIComponent(file.name)}`
                    }
                })
                console.log('SDK上传结果：', result)

                if (!result || !result.url) {
                    console.warn(
                        '警告：上传成功但未获取到URL，将使用构造URL',
                        result
                    )
                }

                // 构建文件URL
                const fileUrl =
                    result.url ||
                    `https://${bucket}.oss-${region}.aliyuncs.com/${filePath}`

                console.log('生成的文件URL：', fileUrl)

                return {
                    fileUrl,
                    fileName: file.name
                }
            } catch (sdkError) {
                // SDK上传失败，退回到表单上传
                console.warn('SDK上传失败，尝试使用表单直接上传', sdkError)

                // 生成Policy
                const expiration = new Date()
                expiration.setHours(expiration.getHours() + 1) // 设置过期时间为1小时

                const policy = {
                    expiration: expiration.toISOString(),
                    conditions: [
                        { bucket },
                        ['content-length-range', 0, 2097152] // 2MB 大小限制
                    ]
                }

                // 编码Policy
                const policyString = btoa(JSON.stringify(policy))

                // 计算签名 (简化版本)
                const signature = await this.calculateSignature(
                    policyString,
                    accessKeySecret
                )

                const formData = new FormData()
                formData.append('key', filePath)
                formData.append('OSSAccessKeyId', accessKeyId)
                formData.append('policy', policyString)
                formData.append('signature', signature)
                formData.append('success_action_status', '200')
                if (securityToken) {
                    formData.append('x-oss-security-token', securityToken)
                }
                formData.append(
                    'Content-Disposition',
                    `attachment; filename=${encodeURIComponent(file.name)}`
                )
                formData.append('file', file)

                // 构建上传URL
                const uploadUrl = `https://${bucket}.oss-${region}.aliyuncs.com`
                console.log('使用表单上传到:', uploadUrl)

                const response = await fetch(uploadUrl, {
                    method: 'POST',
                    body: formData
                })

                if (!response.ok) {
                    throw new Error(`表单上传失败: ${response.statusText}`)
                }

                // 表单上传成功，构建文件URL
                const fileUrl = `https://${bucket}.oss-${region}.aliyuncs.com/${filePath}`
                console.log('表单上传成功，文件URL:', fileUrl)

                return {
                    fileUrl,
                    fileName: file.name
                }
            }
        } catch (error) {
            console.error('文件上传错误详情：', error)
            // 检查是否为OSS特定错误
            if (error && typeof error === 'object' && 'code' in error) {
                throw new Error(
                    `OSS上传失败: 错误代码 ${(error as any).code}, 详情: ${(error as any).message}`
                )
            }
            throw new Error(
                `文件上传失败: ${error instanceof Error ? error.message : '未知错误'}`
            )
        }
    }

    /**
     * 计算签名 (使用简单方法，实际项目应使用crypto库)
     */
    private async calculateSignature(
        policyData: string,
        accessKeySecret: string
    ): Promise<string> {
        try {
            // 由于浏览器环境，我们使用内置方法
            // 注意：这不是标准的HMAC-SHA1算法，仅用于演示
            // 实际生产环境应当引入crypto-js库
            console.warn('使用简化签名方法，不推荐用于生产环境')
            const mockSignature = btoa(
                `${accessKeySecret}:${policyData}`
            ).substring(0, 28)
            return mockSignature
        } catch (e) {
            console.error('签名计算失败', e)
            return btoa(`${accessKeySecret}:${policyData}`).substring(0, 28)
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
                { bucket: this.ssoConfig?.bucket },
                ['content-length-range', 0, 2097152] // 2MB 大小限制
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
