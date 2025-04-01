import { z } from 'zod'
import { WorkOrderCompanyInfoSchema } from './company-info'
import {
    BaseAccountSchema,
    AuthItemSchema,
    AttachmentSchema,
    AuthRoleEnum,
    ProductTypeEnum
} from './account-common'

// 重新导出枚举以便在其他地方使用
export { AuthRoleEnum, ProductTypeEnum }

// 继承BaseAccountSchema，可以按需添加Google特有的字段
export const GoogleAccountSchema = BaseAccountSchema

// 公司信息验证模式 (对应GoogleAccountWithCompany.companyInfo)
export const CompanyInfoSchema = z.object({
    userCompanyInfoId: z.string().optional(),
    companyNameCN: z.string().min(1, '公司中文名称不能为空'),
    companyNameEN: z.string().min(1, '公司英文名称不能为空'),
    businessLicenseNo: z.string().min(1, '统一社会信用代码不能为空'),
    location: z.number().int().min(0).max(1),
    legalRepName: z.string().min(1, '法人姓名不能为空'),
    idType: z.number().int().min(1).max(5),
    idNumber: z.string().min(1, '证件号码不能为空'),
    legalRepPhone: z.string().min(1, '法人手机号不能为空'),
    legalRepBankCard: z.string().optional(),
    attachments: z.array(AttachmentSchema).optional()
})

// 授权项目验证模式
export const AuthItemValidationSchema = z.object({
    role: z.number().int().min(1).max(3).optional(),
    value: z.string().email().optional()
})

// 公司注册详情验证模式
export const RegistrationDetailsSchema = z.object({
    companyName: z.string().min(1, '公司名称不能为空'),
    legalRepName: z.string().optional(),
    idType: z.number().int().optional(),
    idNumber: z.string().optional(),
    legalRepPhone: z.string().optional(),
    legalRepBankCard: z.string().optional()
})

// Google账户申请验证模式
export const GoogleAccountApplicationSchema = z.object({
    productType: z.number().int().optional(),
    currencyCode: z.string().min(1, '币种不能为空'),
    timezone: z.string().min(1, '时区不能为空'),
    promotionLinks: z.array(z.string().url('请输入有效的URL')),
    name: z.string().min(1, '账户名称不能为空'),
    rechargeAmount: z.string().optional(),
    auths: z.array(AuthItemValidationSchema.nullable()),
    businessLicenseNo: z.string().min(1, '营业执照号不能为空'),
    businessLicenseAttachment: z.any(),
    companyNameEN: z.string().min(1, '公司英文名称不能为空'),
    registrationDetails: RegistrationDetailsSchema
})

export type GoogleAccount = z.infer<typeof GoogleAccountSchema>

export type GoogleAccountWithCompany = GoogleAccount & {
    companyInfo?: z.infer<typeof WorkOrderCompanyInfoSchema>
}

export type GoogleAccountApplication = z.infer<
    typeof GoogleAccountApplicationSchema
>

// 用于API返回的公司信息类型
export interface ApplicationCompanyInfo {
    name?: string
    companyNameCN?: string
    companyNameEN?: string
    businessLicenseNo?: string
    legalRepName?: string
    idType?: number
    idNumber?: string
    legalRepPhone?: string
    legalRepBankCard?: string
    attachments?: Array<{
        fileName?: string
        fileType?: string
        fileSize?: number
        filePath?: string
        ossObjectKey?: string
        fileUrl?: string
        description?: string
    }>
}
