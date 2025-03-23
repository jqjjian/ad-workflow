import { z } from 'zod'

// 设置API基础URL环境变量
const API_BASE_URL =
    process.env.NODE_ENV === 'production'
        ? 'https://business.uniagency.net/uni-agency'
        : 'https://test-ua-gw.tec-develop.cn/uni-agency'

const accessToken =
    process.env.NODE_ENV === 'production'
        ? process.env.ACCESS_TOKEN_SECRET
        : process.env.ACCESS_TOKEN_SECRET_TEST

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

        const data: ApiResponse<T> = await response.json()
        return {
            ...data,
            data: data.data || null
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new Error(`请求参数验证失败: ${error.message}`)
        }
        throw error // 其他错误直接抛出
    }
}
