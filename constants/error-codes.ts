// 错误码前缀定义
export const ErrorPrefix = {
    SYSTEM: 'SYS', // 系统错误
    VALIDATION: 'VAL', // 验证错误
    BUSINESS: 'BIZ', // 业务错误
    THIRD_PARTY: 'TPE', // 第三方错误
    DATABASE: 'DB', // 数据库错误
    AUTH: 'AUTH' // 认证错误
} as const

// 错误码定义
export const ErrorCode = {
    // 系统级错误 (1000-1999)
    SYSTEM_ERROR: 'SYS1000', // 系统通用错误
    NETWORK_ERROR: 'SYS1001', // 网络错误
    DATABASE_ERROR: 'SYS1002', // 数据库错误
    CACHE_ERROR: 'SYS1003', // 缓存错误
    CONFIG_ERROR: 'SYS1004', // 配置错误

    // 验证错误 (2000-2999)
    VALIDATION_ERROR: 'VAL2000', // 通用验证错误
    INVALID_PARAMETER: 'VAL2001', // 无效参数
    MISSING_PARAMETER: 'VAL2002', // 缺少参数
    INVALID_FORMAT: 'VAL2003', // 格式错误

    // 业务错误 (3000-3999)
    BUSINESS_ERROR: 'BIZ3000', // 通用业务错误
    RESOURCE_NOT_FOUND: 'BIZ3001', // 资源不存在
    RESOURCE_EXISTS: 'BIZ3002', // 资源已存在
    STATUS_ERROR: 'BIZ3003', // 状态错误
    OPERATION_FAILED: 'BIZ3004', // 操作失败

    // 第三方错误 (4000-4999)
    THIRD_PARTY_ERROR: 'TPE4000', // 第三方通用错误
    API_CALL_FAILED: 'TPE4001', // API调用失败
    INVALID_RESPONSE: 'TPE4002', // 无效响应
    SERVICE_UNAVAILABLE: 'TPE4003', // 服务不可用

    // 认证错误 (5000-5999)
    AUTH_ERROR: 'AUTH5000', // 认证通用错误
    UNAUTHORIZED: 'AUTH5001', // 未授权
    TOKEN_EXPIRED: 'AUTH5002', // Token过期
    INVALID_TOKEN: 'AUTH5003', // 无效Token
    PERMISSION_DENIED: 'AUTH5004' // 权限不足
} as const

// 错误消息映射
export const ErrorMessage: Record<string, string> = {
    [ErrorCode.SYSTEM_ERROR]: '系统错误',
    [ErrorCode.NETWORK_ERROR]: '网络错误',
    [ErrorCode.DATABASE_ERROR]: '数据库错误',
    [ErrorCode.CACHE_ERROR]: '缓存错误',
    [ErrorCode.CONFIG_ERROR]: '配置错误',

    [ErrorCode.VALIDATION_ERROR]: '验证错误',
    [ErrorCode.INVALID_PARAMETER]: '无效参数',
    [ErrorCode.MISSING_PARAMETER]: '缺少参数',
    [ErrorCode.INVALID_FORMAT]: '格式错误',

    [ErrorCode.BUSINESS_ERROR]: '业务错误',
    [ErrorCode.RESOURCE_NOT_FOUND]: '资源不存在',
    [ErrorCode.RESOURCE_EXISTS]: '资源已存在',
    [ErrorCode.STATUS_ERROR]: '状态错误',
    [ErrorCode.OPERATION_FAILED]: '操作失败',

    [ErrorCode.THIRD_PARTY_ERROR]: '第三方服务错误',
    [ErrorCode.API_CALL_FAILED]: 'API调用失败',
    [ErrorCode.INVALID_RESPONSE]: '无效响应',
    [ErrorCode.SERVICE_UNAVAILABLE]: '服务不可用',

    [ErrorCode.AUTH_ERROR]: '认证错误',
    [ErrorCode.UNAUTHORIZED]: '未授权',
    [ErrorCode.TOKEN_EXPIRED]: 'Token已过期',
    [ErrorCode.INVALID_TOKEN]: '无效Token',
    [ErrorCode.PERMISSION_DENIED]: '权限不足'
}
