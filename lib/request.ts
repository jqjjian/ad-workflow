import { z } from 'zod'

// 设置API基础URL环境变量
// 添加日志记录环境变量状态
console.log('NODE_ENV:', process.env.NODE_ENV)
console.log('OPEN_API_URL:', process.env.OPEN_API_URL)
console.log('OPEN_API_URL_TEST:', process.env.OPEN_API_URL_TEST)

// 修改API_BASE_URL的获取方式，增加默认值
const API_BASE_URL =
    process.env.NODE_ENV === 'production'
        ? process.env.OPEN_API_URL ||
          'https://test-ua-gw.tec-develop.cn/uni-agency' // 提供默认值
        : process.env.OPEN_API_URL_TEST ||
          'https://test-ua-gw.tec-develop.cn/uni-agency' // 提供默认值

console.log('最终使用的API_BASE_URL:', API_BASE_URL)

// 同样为accessToken添加默认值
const accessToken =
    process.env.NODE_ENV === 'production'
        ? process.env.ACCESS_TOKEN_SECRET || 'ad776656d49f4adb840ef6187115fb8b'
        : process.env.ACCESS_TOKEN_SECRET_TEST ||
          'ad776656d49f4adb840ef6187115fb8b'

// 定义请求参数的类型
export const ExternalApiRequestSchema = z.object({
    url: z.string().url(),
    headers: z.record(z.string()).optional(),
    body: z.any().optional()
})

// 导出API基础URL，以便在业务方法中使用
export { API_BASE_URL }

// 定义响应类型
interface ApiResponse<T = any> {
    code: string
    success: boolean
    message?: string
    data: T | null // 明确指定可能为 null
}

export async function callExternalApi<T>(params: {
    url: string
    headers?: Record<string, string>
    body?: Record<string, any>
}): Promise<ApiResponse<T>> {
    console.log('request', params)
    try {
        // 验证不通过会抛出 ZodError
        ExternalApiRequestSchema.parse(params)
        console.log('params', params)
        const response = await fetch(params.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Access-Token': accessToken || '',
                ...params.headers
            },
            body: params.body ? JSON.stringify(params.body) : undefined
        })

        // 输出HTTP响应状态和头信息
        console.log(`HTTP响应状态: ${response.status} ${response.statusText}`)

        // 以兼容方式获取响应头
        const headers: Record<string, string> = {}
        response.headers.forEach((value, key) => {
            headers[key] = value
        })
        console.log('响应头:', headers)

        // 检查响应类型
        const contentType = response.headers.get('content-type') || ''
        console.log('响应Content-Type:', contentType)

        if (!contentType.includes('application/json')) {
            console.error('警告: 响应不是JSON格式', contentType)
            // 获取响应文本用于调试
            const text = await response.text()
            console.error('非JSON响应内容:', text)
            throw new Error(
                `服务器返回了非JSON响应: ${contentType}, 响应内容: ${text.substring(0, 200)}...`
            )
        }

        // 克隆响应以避免"已使用的响应体"错误
        const responseClone = response.clone()

        try {
            const data: ApiResponse<T> = await response.json()
            console.log('响应数据结构:', {
                code: data.code,
                success: data.success,
                hasMessage: !!data.message,
                hasData: data.data !== null && data.data !== undefined
            })
            return {
                ...data,
                data: data.data || null
            }
        } catch (jsonError) {
            // JSON解析失败，尝试读取原始文本
            const text = await responseClone.text()
            console.error('JSON解析失败, 原始响应:', text)
            throw new Error(
                `解析JSON响应失败: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}, 原始响应: ${text.substring(0, 200)}...`
            )
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(`请求参数验证失败: ${error.message}`)
        }
        console.error('API请求失败:', error)
        // 重新包装错误，确保它包含调用信息
        throw error instanceof Error
            ? error
            : new Error(`API请求失败: ${String(error)}`)
    }
}
