import { ApiResponse, ApiErrorResponse, ErrorDetail } from '@/types/api'
import { ErrorCode, ErrorMessage } from '@/constants/error-codes'

export class ApiResponseBuilder {
    // 成功响应
    static success<T>(data?: T, message: string = '操作成功'): ApiResponse<T> {
        return {
            success: true,
            code: '0',
            message,
            data,
            timestamp: Date.now()
        }
    }

    // 错误响应
    static error(
        code: string = ErrorCode.SYSTEM_ERROR,
        message?: string,
        errors?: ErrorDetail[]
    ): ApiErrorResponse {
        return {
            success: false,
            code,
            message: message || ErrorMessage[code] || '系统错误',
            errors,
            timestamp: Date.now()
        }
    }

    // 业务错误响应
    static businessError(
        code: string = ErrorCode.BUSINESS_ERROR,
        message?: string,
        errors?: ErrorDetail[]
    ): ApiErrorResponse {
        return this.error(code, message, errors)
    }

    // 验证错误响应
    static validationError(errors: ErrorDetail[]): ApiErrorResponse {
        return this.error(ErrorCode.VALIDATION_ERROR, '参数验证失败', errors)
    }

    // 第三方服务错误响应
    static thirdPartyError(
        message: string,
        originalError?: any
    ): ApiErrorResponse {
        return this.error(ErrorCode.THIRD_PARTY_ERROR, message, [
            {
                code: ErrorCode.THIRD_PARTY_ERROR,
                message: originalError?.message || message
            }
        ])
    }
}
