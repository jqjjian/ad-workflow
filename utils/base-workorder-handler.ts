import { db } from '@/lib/db'
import { ApiResponse } from '@/types/api'
import { ApiResponseBuilder } from '@/utils/api-response'
import {
    BusinessError,
    ValidationError,
    ThirdPartyError
} from '@/utils/business-error'
import { generateTraceId } from '@/lib/utils'

export abstract class BaseWorkOrderHandler {
    protected traceId: string
    protected userId: string

    constructor(userId: string) {
        this.traceId = generateTraceId()
        this.userId = userId
    }

    // 抽象方法：验证输入参数
    protected abstract validateInput(input: unknown): Promise<any>

    // 抽象方法：调用第三方API
    protected abstract callThirdPartyApi(validatedInput: any): Promise<any>

    // 抽象方法：创建业务数据
    protected abstract createBusinessData(
        workOrderId: string,
        validatedInput: any,
        thirdPartyResponse: any
    ): Promise<any>

    // 通用的工单创建流程
    async createWorkOrder(input: unknown): Promise<ApiResponse> {
        try {
            // 验证输入
            const validatedInput = await this.validateInput(input)

            // 执行事务
            const result = await db.$transaction(async (tx) => {
                // 调用第三方API
                const thirdPartyResponse =
                    await this.callThirdPartyApi(validatedInput)

                // 创建原始数据记录
                const rawData = await this.createRawData(
                    tx,
                    validatedInput,
                    thirdPartyResponse
                )

                // 创建工单记录
                const workOrder = await this.createWorkOrderRecord(
                    tx,
                    validatedInput,
                    thirdPartyResponse,
                    rawData.id
                )

                // 创建业务数据
                const businessData = await this.createBusinessData(
                    workOrder.id,
                    validatedInput,
                    thirdPartyResponse
                )

                // 更新工单业务数据ID
                await this.updateWorkOrderBusinessData(
                    tx,
                    workOrder.id,
                    businessData.id
                )

                return this.formatResponse(
                    workOrder,
                    businessData,
                    thirdPartyResponse
                )
            })

            return ApiResponseBuilder.success(result)
        } catch (error) {
            return this.handleError(error)
        }
    }

    // 错误处理
    protected handleError(error: unknown): ApiResponse {
        if (error instanceof ValidationError) {
            return ApiResponseBuilder.validationError([
                {
                    code: ErrorCode.VALIDATION_ERROR,
                    message: error.message,
                    details: error.details
                }
            ])
        }

        if (error instanceof ThirdPartyError) {
            return ApiResponseBuilder.thirdPartyError(
                error.message,
                error.details
            )
        }

        if (error instanceof BusinessError) {
            return ApiResponseBuilder.businessError(error.code, error.message)
        }

        return ApiResponseBuilder.error(
            ErrorCode.SYSTEM_ERROR,
            error instanceof Error ? error.message : '系统错误'
        )
    }

    // 其他通用方法...
}
