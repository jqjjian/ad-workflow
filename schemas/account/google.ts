import * as z from 'zod'
import { AuthItemSchema } from '../account-common'

// Google账户申请表单验证模式
export const GoogleAccountSchema = z
    .object({
        productType: z.number().int().optional(),
        currencyCode: z.string({ required_error: '货币代码不能为空' }),
        timezone: z.string({ required_error: '时区不能为空' }),
        promotionLinks: z
            .array(z.string().url('请输入有效的链接'))
            .min(1, '至少需要一个推广链接'),
        name: z.string({ required_error: '名称不能为空' }),
        rechargeAmount: z
            .string()
            .regex(/^\d+(\.\d{1,2})?$/, '请输入有效的金额格式')
            .optional(),
        auths: z.array(AuthItemSchema).optional().default([null])
    })
    .transform((data) => ({
        ...data,
        productType: data.productType || undefined
    }))

// 导出类型
export type GoogleAccount = z.infer<typeof GoogleAccountSchema>
export type AuthItem = z.infer<typeof AuthItemSchema>
