import { ErrorCode } from '@/constants/error-codes'

export class BusinessError extends Error {
    code: string
    details?: any

    constructor(
        message: string,
        code: string = ErrorCode.BUSINESS_ERROR,
        details?: any
    ) {
        super(message)
        this.name = 'BusinessError'
        this.code = code
        this.details = details
    }
}

export class ValidationError extends BusinessError {
    constructor(message: string, details?: any) {
        super(message, ErrorCode.VALIDATION_ERROR, details)
        this.name = 'ValidationError'
    }
}

export class ThirdPartyError extends BusinessError {
    constructor(message: string, details?: any) {
        super(message, ErrorCode.THIRD_PARTY_ERROR, details)
        this.name = 'ThirdPartyError'
    }
}
