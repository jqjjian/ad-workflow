import { AccountApplicationHandler } from '../base/account-application-handler'
import {
    GoogleAccountSchema,
    type GoogleAccountRequest
} from '@/schemas/google-account'
import { ThirdPartyError, ValidationError } from '@/utils/business-error'
import { ErrorCode } from '@/constants/error-codes'
import { generateTaskNumber } from '@/lib/utils'

export class GoogleAccountHandler extends AccountApplicationHandler {
    protected readonly platform = 'GOOGLE'
    protected readonly apiEndpoint =
        '/openApi/v1/mediaAccountApplication/google/create'

    protected async validateInput(input: unknown) {
        try {
            return await GoogleAccountSchema.parseAsync(input)
        } catch (error) {
            throw new ValidationError('Google账户申请数据验证失败', error)
        }
    }

    protected async callThirdPartyApi(validatedInput: GoogleAccountRequest) {
        try {
            const response = await fetch(
                `${process.env.OPEN_API_URL}${this.apiEndpoint}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Token': process.env.ACCESS_TOKEN_SECRET || '',
                        'Trace-Id': this.traceId
                    },
                    body: JSON.stringify({
                        taskNumber:
                            validatedInput.taskNumber || generateTaskNumber(),
                        mediaAccountInfos: validatedInput.mediaAccountInfos.map(
                            (info) => ({
                                productType: info.productType,
                                timezone: info.timezone,
                                currencyCode: info.currencyCode,
                                promotionLinks: info.promotionLinks,
                                name: info.name,
                                rechargeAmount: info.rechargeAmount,
                                auths: info.auths
                            })
                        )
                    })
                }
            )

            const data = await response.json()

            if (data.code !== '0' || !data.data?.taskId) {
                throw new ThirdPartyError(
                    data.message || 'Google账户申请API调用失败',
                    ErrorCode.API_CALL_FAILED
                )
            }

            return data
        } catch (error) {
            throw new ThirdPartyError(
                `调用Google账户申请API失败: ${error instanceof Error ? error.message : '未知错误'}`,
                ErrorCode.API_CALL_FAILED
            )
        }
    }

    protected getWorkOrderSubtype(): string {
        return 'GOOGLE_ACCOUNT'
    }

    protected async createBusinessData(
        workOrderId: string,
        validatedInput: GoogleAccountRequest,
        thirdPartyResponse: any
    ) {
        const accountInfo = validatedInput.mediaAccountInfos[0] // 处理第一个账户信息

        return await prisma.accountApplicationBusinessData.create({
            data: {
                workOrderId,
                mediaPlatform: 'GOOGLE',
                accountName: accountInfo.name,
                currency: accountInfo.currencyCode,
                timezone: accountInfo.timezone,
                productType: accountInfo.productType,
                rechargeAmount: accountInfo.rechargeAmount,
                promotionLinks: accountInfo.promotionLinks,
                authorizations: accountInfo.auths,
                applicationStatus:
                    thirdPartyResponse.code === '0' ? 'PENDING' : 'FAILED',
                failureReason:
                    thirdPartyResponse.code === '0'
                        ? null
                        : thirdPartyResponse.message,
                metadata: {
                    taskNumber: validatedInput.taskNumber,
                    platformTaskId: thirdPartyResponse.data?.taskId
                },
                createdAt: new Date(),
                updatedAt: new Date()
            }
        })
    }

    // 格式化响应数据
    protected formatResponse(
        workOrder: any,
        businessData: any,
        thirdPartyResponse: any
    ) {
        return {
            taskId: workOrder.taskId,
            taskNumber: workOrder.taskNumber,
            status: workOrder.status,
            accountInfo: {
                name: businessData.accountName,
                productType: businessData.productType,
                timezone: businessData.timezone,
                currencyCode: businessData.currency,
                promotionLinks: businessData.promotionLinks,
                rechargeAmount: businessData.rechargeAmount,
                auths: businessData.authorizations
            },
            createdAt: workOrder.createdAt
        }
    }
}
