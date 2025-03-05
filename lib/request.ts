import { z } from 'zod'

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
// 定义响应类型
export interface ApiResponse<T> {
    code: string
    message: string
    data: T
}

export async function callExternalApi<T>(
    request: z.infer<typeof ExternalApiRequestSchema>
): Promise<ApiResponse<T>> {
    console.log('request', request)
    try {
        // 验证请求参数
        const validatedRequest = ExternalApiRequestSchema.parse(request)
        console.log('validatedRequest', validatedRequest)
        // console.log('accessToken', accessToken)
        // console.log('headers', validatedRequest.headers)
        // 发起请求
        // console.log('JSON', JSON.stringify(validatedRequest.body))
        const response = await fetch(validatedRequest.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
                'Access-Token': accessToken || '',
                ...validatedRequest.headers
            },
            body: validatedRequest.body
                ? JSON.stringify(validatedRequest.body)
                : undefined
        })
        // if (!response.ok) {
        //     throw new Error(`HTTP error! status: ${response.status}`)
        // }

        const data = await response.json()
        return data
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                code: '400',
                message: '请求参数验证失败',
                data: null as T
            }
        }
        return {
            code: '500',
            message: error instanceof Error ? error.message : '请求失败',
            data: null as T
        }
    }
}
