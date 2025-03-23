import { z } from 'zod'
import { WorkOrderCompanyInfoSchema } from './company-info'
import { BaseAccountSchema } from './account-common'

// 定义TikTok账户的授权角色枚举
export enum AuthRoleEnum {
    STANDARD = 1,
    ADMIN = 2,
    READONLY = 3
}

// 定义产品类型枚举
export enum ProductTypeEnum {
    GAME = 1,
    APP = 2,
    ECOMMERCE = 3,
    OTHER = 4
}

// 授权项Schema
export const AuthItemSchema = z
    .object({
        value: z.string().email({ message: '请输入有效的邮箱地址' }).optional(),
        role: z.nativeEnum(AuthRoleEnum).optional()
    })
    .nullable()

// 定义TikTok账户申请的Schema
export const TikTokAccountApplicationSchema = z.object({
    productType: z.number().optional(),
    currencyCode: z.string().min(1, { message: '币种不能为空' }),
    timezone: z.string().min(1, { message: '时区不能为空' }),
    name: z.string().min(1, { message: '账户名称不能为空' }),
    rechargeAmount: z.string().optional(),
    promotionLinks: z
        .array(z.string())
        .min(1, { message: '至少需要一个推广链接' }),
    auths: z.array(AuthItemSchema),
    businessLicenseNo: z
        .string()
        .min(15, { message: '营业执照统一社会信用代码不能少于15位' }),
    businessLicenseAttachment: z.any(), // 处理上传文件
    companyNameEN: z.string().min(1, { message: '公司英文名称不能为空' }),
    registrationDetails: z.object({
        companyName: z.string().min(1, { message: '公司中文名称不能为空' }),
        legalRepName: z.string().min(1, { message: '法人姓名不能为空' }),
        idType: z.number().optional(),
        idNumber: z.string().min(1, { message: '证件号码不能为空' }),
        legalRepPhone: z.string().min(1, { message: '法人手机号不能为空' }),
        legalRepBankCard: z.string().min(1, { message: '法人银行卡号不能为空' })
    })
})

// 继承BaseAccountSchema，可以按需添加TikTok特有的字段
export const TikTokAccountSchema = BaseAccountSchema

export type TikTokAccount = z.infer<typeof TikTokAccountSchema>

export type TikTokAccountWithCompany = TikTokAccount & {
    companyInfo?: z.infer<typeof WorkOrderCompanyInfoSchema>
}

// 企业信息类型
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
    attachments: Array<{
        fileName: string
        fileType: string
        fileSize: number
        filePath: string
        ossObjectKey: string
        fileUrl: string
        description?: string
    }>
}

// 定义前端表单使用的TikTok账户申请类型
export type TikTokAccountApplication = {
    productType: number | undefined
    currencyCode: string
    timezone: string
    name: string
    rechargeAmount: string
    promotionLinks: string[]
    auths: ({ value: string; role: number } | null)[]
    businessLicenseNo: string
    businessLicenseAttachment: any[]
    companyNameEN: string
    registrationDetails: {
        companyName: string
        legalRepName: string
        idType: number | undefined
        idNumber: string
        legalRepPhone: string
        legalRepBankCard: string
    }
}
