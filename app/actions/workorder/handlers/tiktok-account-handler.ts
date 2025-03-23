import { AccountApplicationHandler } from '../base/account-application-handler'
import { TiktokBusinessSchema } from '@/schemas'
import { ThirdPartyError } from '@/utils/business-error'
import { ErrorCode } from '@/constants/error-codes'

export class TiktokAccountHandler extends AccountApplicationHandler {
    protected readonly platform = 'TIKTOK'
    protected readonly apiEndpoint =
        '/openApi/v1/mediaAccountApplication/tt/create'

    protected async validateInput(input: unknown) {
        try {
            return await TiktokBusinessSchema.parseAsync(input)
        } catch (error) {
            throw new ValidationError('TikTok账户申请数据验证失败', error)
        }
    }

    protected async callThirdPartyApi(validatedInput: any) {
        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Trace-Id': this.traceId
                },
                body: JSON.stringify({
                    taskNumber: validatedInput.taskNumber,
                    ...validatedInput
                })
            })

            const data = await response.json()

            if (data.code !== '0' || !data.data?.taskId) {
                throw new ThirdPartyError(
                    data.message || 'TikTok账户申请API调用失败',
                    ErrorCode.API_CALL_FAILED
                )
            }

            return data
        } catch (error) {
            throw new ThirdPartyError(
                `调用TikTok账户申请API失败: ${error instanceof Error ? error.message : '未知错误'}`,
                ErrorCode.API_CALL_FAILED
            )
        }
    }

    protected getWorkOrderSubtype(): string {
        return 'TIKTOK_ACCOUNT'
    }

    protected async createBusinessData(
        workOrderId: string,
        validatedInput: any,
        thirdPartyResponse: any
    ) {
        return await prisma.accountApplicationBusinessData.create({
            data: {
                workOrderId,
                mediaPlatform: 'TIKTOK',
                accountName: validatedInput.name,
                companyName: validatedInput.companyName,
                companyNameEN: validatedInput.companyNameEN,
                businessLicenseNo: validatedInput.businessLicenseNo,
                businessLicenseAttachment:
                    validatedInput.businessLicenseAttachment,
                timezone: validatedInput.timezone,
                productType: validatedInput.productType,
                rechargeAmount: validatedInput.rechargeAmount,
                advertisingCountries: validatedInput.advertisingCountries,
                applicationStatus:
                    thirdPartyResponse.code === '0' ? 'PENDING' : 'FAILED',
                failureReason:
                    thirdPartyResponse.code === '0'
                        ? null
                        : thirdPartyResponse.message,
                registrationDetails: validatedInput.registrationDetails,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        })
    }

    protected async updateBusinessData(
        tx: any,
        workOrderId: string,
        validatedInput: any,
        thirdPartyResponse: any
    ) {
        return await tx.tecdo_account_application_business_data.update({
            where: { workOrderId },
            data: {
                accountName: validatedInput.name,
                companyName: validatedInput.companyName,
                companyNameEN: validatedInput.companyNameEN,
                businessLicenseNo: validatedInput.businessLicenseNo,
                businessLicenseAttachment:
                    validatedInput.businessLicenseAttachment,
                timezone: validatedInput.timezone,
                productType: validatedInput.productType,
                rechargeAmount: validatedInput.rechargeAmount,
                advertisingCountries: validatedInput.advertisingCountries,
                applicationStatus:
                    thirdPartyResponse.code === '0' ? 'PENDING' : 'FAILED',
                failureReason:
                    thirdPartyResponse.code === '0'
                        ? null
                        : thirdPartyResponse.message,
                registrationDetails: validatedInput.registrationDetails,
                updatedAt: new Date()
            }
        })
    }
}
