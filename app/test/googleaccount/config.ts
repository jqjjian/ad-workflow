'use client'

// 定义API映射类型
type ApiMappingType = {
    [key: string]: string
    '/openApi/v1/mediaAccountApplication/google/create': string
    '/openApi/v1/mediaAccountApplication/google/update': string
    '/openApi/v1/mediaAccountApplication/google/getDetail': string
}

// 测试配置
export const TestConfig = {
    // 是否使用模拟API
    useMockApi: false,

    // 模拟API基础路径
    mockApiBasePath: '/api/mock',

    // API映射关系，用于将正式API路径映射到模拟API路径
    apiMapping: {
        '/openApi/v1/mediaAccountApplication/google/create':
            '/api/mock/google-account',
        '/openApi/v1/mediaAccountApplication/google/update':
            '/api/mock/google-account',
        '/openApi/v1/mediaAccountApplication/google/getDetail':
            '/api/mock/google-account'
    } as ApiMappingType
}

/**
 * 获取API路径
 * @param originalPath 原始API路径
 * @returns 根据配置返回实际应使用的API路径
 */
export function getApiPath(originalPath: string): string {
    if (TestConfig.useMockApi && originalPath in TestConfig.apiMapping) {
        return TestConfig.apiMapping[originalPath]
    }
    return originalPath
}

// 添加全局请求拦截器，用于在测试页面中模拟API
if (typeof window !== 'undefined') {
    const originalFetch = window.fetch
    window.fetch = async function (
        input: RequestInfo | URL,
        init?: RequestInit
    ) {
        // 判断是否为API请求
        if (
            typeof input === 'string' &&
            input.includes('/openApi/v1/mediaAccountApplication/google/')
        ) {
            console.log('拦截API请求:', input)

            // 如果启用了模拟API，修改请求路径
            if (TestConfig.useMockApi) {
                const newPath = getApiPath(input)
                console.log('重定向到模拟API:', newPath)

                // 根据原始路径判断HTTP方法
                let method = init?.method || 'GET'
                if (input.includes('/create')) {
                    method = 'POST'
                } else if (input.includes('/update')) {
                    method = 'PUT'
                } else if (input.includes('/getDetail')) {
                    method = 'GET'
                }

                // 克隆init对象并修改method
                const newInit = init ? { ...init, method } : { method }
                return originalFetch(newPath, newInit)
            }
        }

        // 对于其他请求，使用原始fetch
        return originalFetch(input, init)
    }
}
