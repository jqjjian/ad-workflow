import * as z from 'zod'
import { AuthItemSchema } from '../account-common'

// TikTok业务schema
export const TiktokBusinessSchema = z.object({
    companyNameEN: z.string().optional(),
    companyName: z.string().optional(),
    businessLicenseNo: z
        .string({ required_error: '营业执照号不能为空' })
        .min(1, '营业执照号不能为空'),
    businessLicenseAttachment: z
        .string({ required_error: '营业执照附件不能为空' })
        .min(1, '营业执照附件不能为空'),
    type: z.number({ required_error: '类型不能为空' }).int(),
    timezone: z
        .string({ required_error: '时区不能为空' })
        .min(1, '时区不能为空'),
    productType: z.number().int().optional(),
    promotionLink: z
        .string({ required_error: '推广链接不能为空' })
        .min(1, '推广链接不能为空'),
    name: z.string({ required_error: '名称不能为空' }).min(1, '名称不能为空'),
    rechargeAmount: z.string().optional(),
    advertisingCountries: z
        .array(z.string({ required_error: '广告投放国家不能为空' }))
        .min(1, '至少需要一个广告投放国家'),
    auths: z
        .array(z.union([AuthItemSchema, z.null()]))
        .optional()
        .default([]),
    registrationDetails: z
        .object({
            companyName: z.string().optional(),
            companyNameEN: z.string().optional(),
            locationId: z.number({
                required_error: '企业所在地是必填项'
            }),
            legalRepName: z
                .string({
                    required_error: '法人姓名是必填项'
                })
                .min(2, '法人姓名至少2个字符')
                .max(50, '法人姓名最多50个字符'),
            idType: z.number({
                required_error: '证件类型是必填项'
            }),
            idNumber: z
                .string({
                    required_error: '证件号码是必填项'
                })
                .regex(/^[0-9X]{18}$/, '请输入有效的身份证号码'),
            legalRepPhone: z
                .string({
                    required_error: '法人手机号是必填项'
                })
                .regex(/^1[3-9]\d{9}$/, '请输入有效的手机号码'),
            legalRepBankCard: z
                .string({
                    required_error: '法人银行卡号是必填项'
                })
                .regex(/^\d{16,19}$/, '请输入有效的银行卡号')
        })
        .optional()
})

export type TiktokBusiness = z.infer<typeof TiktokBusinessSchema>
