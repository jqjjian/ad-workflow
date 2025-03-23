import { z } from 'zod'
import { WorkOrderCompanyInfoSchema } from './company-info'
import { BaseAccountSchema } from './account-common'

// 账户权限枚举
export enum AuthRoleEnum {
    STANDARD = 1,
    ADMIN = 2,
    READONLY = 3
}

// 产品类型枚举
export enum ProductTypeEnum {
    GAME = 1,
    APP = 2,
    ECOMMERCE = 3,
    OTHER = 4
}

// 授权项目的schema
export const AuthItemSchema = z.object({
    role: z.number().optional(),
    value: z.string().optional()
})

export type AuthItem = z.infer<typeof AuthItemSchema>

// 继承BaseAccountSchema，可以按需添加Facebook特有的字段
export const FacebookAccountSchema = BaseAccountSchema.extend({
    productType: z.number().optional(),
    currencyCode: z.string().optional(),
    timezone: z.string().optional(),
    rechargeAmount: z.string().optional(),
    promotionLinks: z.array(z.string()).optional(),
    name: z.string().optional(),
    auths: z.array(AuthItemSchema.nullable()).optional()
})

// Facebook账户申请的schema，包含更多字段
export const FacebookAccountApplicationSchema = FacebookAccountSchema.extend({
    businessLicenseNo: z.string().optional(),
    businessLicenseAttachment: z.any().optional(),
    companyNameEN: z.string().optional(),
    registrationDetails: z
        .object({
            companyName: z.string().optional(),
            legalRepName: z.string().optional(),
            idType: z.number().optional(),
            idNumber: z.string().optional(),
            legalRepPhone: z.string().optional(),
            legalRepBankCard: z.string().optional()
        })
        .optional()
})

export type FacebookAccount = z.infer<typeof FacebookAccountSchema>
export type FacebookAccountApplication = z.infer<
    typeof FacebookAccountApplicationSchema
>

export type FacebookAccountWithCompany = FacebookAccount & {
    companyInfo?: z.infer<typeof WorkOrderCompanyInfoSchema>
}

// 公司信息类型
export type ApplicationCompanyInfo = {
    companyNameCN: string
    companyNameEN: string
    businessLicenseNo: string
    location: number
    legalRepName?: string
    idType?: number
    idNumber?: string
    legalRepPhone?: string
    legalRepBankCard?: string
    attachments?: Array<{
        fileName: string
        fileType: string
        fileSize: number
        filePath: string
        ossObjectKey: string
        fileUrl: string
        description: string
    }>
}
