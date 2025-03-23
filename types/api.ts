// API响应类型
export interface ApiResponse<T = any> {
    success: boolean
    code: string
    message: string
    data?: T
    traceId?: string
    timestamp: number
}

// 错误详情类型
export interface ErrorDetail {
    field?: string
    code: string
    message: string
}

// 带错误详情的响应类型
export interface ApiErrorResponse extends ApiResponse {
    errors?: ErrorDetail[]
}

// 分页响应数据类型
export interface PaginatedData<T> {
    items: T[]
    total: number
    pageNumber: number
    pageSize: number
}

// 分页查询参数类型
export interface PaginationQuery {
    pageNumber?: number
    pageSize?: number
}

// 时间范围查询参数类型
export interface DateRangeQuery {
    startDate?: Date
    endDate?: Date
}
