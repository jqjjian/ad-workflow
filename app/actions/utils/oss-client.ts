'use server'

import OSS from 'ali-oss'
import { Logger } from '@/lib/logger'

// OSS客户端单例
let ossClient: OSS | null = null

// 初始化OSS客户端
export function getOssClient(): OSS {
    if (ossClient) {
        return ossClient
    }

    try {
        const region = process.env.OSS_REGION || 'oss-cn-hangzhou'
        const accessKeyId = process.env.OSS_ACCESS_KEY_ID
        const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET
        const bucket = process.env.OSS_BUCKET

        if (!accessKeyId || !accessKeySecret || !bucket) {
            throw new Error('OSS配置不完整')
        }

        ossClient = new OSS({
            region,
            accessKeyId,
            accessKeySecret,
            bucket
        })

        return ossClient
    } catch (error) {
        Logger.error(
            `初始化OSS客户端失败: ${error instanceof Error ? error.message : String(error)}`
        )
        throw new Error('初始化OSS客户端失败')
    }
}

/**
 * 生成临时上传凭证
 */
export async function generateUploadCredentials(
    dir: string = 'uploads',
    expiration: number = 3600
): Promise<{
    accessKeyId: string
    accessKeySecret: string
    securityToken: string
    expiration: string
    region: string
    bucket: string
}> {
    try {
        const client = getOssClient()

        // 创建STS（Security Token Service）临时凭证
        // 注意：这里简化了处理，实际上你可能需要调用阿里云STS服务
        // 或者使用签名URL的方式

        const policy = {
            Statement: [
                {
                    Action: ['oss:PutObject', 'oss:GetObject'],
                    Effect: 'Allow',
                    Resource: [`acs:oss:*:*:${client.options.bucket}/${dir}/*`]
                }
            ],
            Version: '1'
        }

        // 这里应该调用阿里云STS服务获取临时凭证
        // 为简化示例，返回模拟数据
        return {
            accessKeyId: 'STS.mockAccessKeyId',
            accessKeySecret: 'mockAccessKeySecret',
            securityToken: 'mockSecurityToken',
            expiration: new Date(Date.now() + expiration * 1000).toISOString(),
            region: client.options.region,
            bucket: client.options.bucket
        }
    } catch (error) {
        Logger.error(
            `生成上传凭证失败: ${error instanceof Error ? error.message : String(error)}`
        )
        throw new Error('生成上传凭证失败')
    }
}

/**
 * 生成文件访问URL
 */
export async function generateFileUrl(
    objectKey: string,
    expires: number = 3600
): Promise<string> {
    try {
        const client = getOssClient()
        const url = client.signatureUrl(objectKey, { expires })
        return url
    } catch (error) {
        Logger.error(
            `生成文件访问URL失败: ${error instanceof Error ? error.message : String(error)}`
        )
        throw new Error('生成文件访问URL失败')
    }
}

/**
 * 判断文件是否存在
 */
export async function checkFileExists(objectKey: string): Promise<boolean> {
    try {
        const client = getOssClient()
        await client.head(objectKey)
        return true
    } catch (error) {
        if ((error as OSS.RequestError).status === 404) {
            return false
        }
        Logger.error(
            `检查文件是否存在失败: ${error instanceof Error ? error.message : String(error)}`
        )
        throw error
    }
}

/**
 * 删除文件
 */
export async function deleteFile(objectKey: string): Promise<boolean> {
    try {
        const client = getOssClient()
        await client.delete(objectKey)
        return true
    } catch (error) {
        Logger.error(
            `删除文件失败: ${error instanceof Error ? error.message : String(error)}`
        )
        return false
    }
}
