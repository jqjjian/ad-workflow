import * as z from 'zod'
export const LoginSchema = z.object({
    username: z.string({ required_error: '用户名不能为空' }),
    // .min(11, {
    //     message: '手机号不能少于11位'
    // }),
    password: z.string({ required_error: '密码不能为空' }).min(6, {
        message: '密码不能少于6位'
    })
    // remember: z.boolean().optional()
})

export const RegisterSchema = z.object({
    email: z.string({ required_error: '邮箱不能为空' }).email({
        message: '邮箱格式不正确'
    }),
    password: z.string({ required_error: '密码不能为空' }).min(6, {
        message: '密码不能少于6位'
    }),
    verifyCode: z.string({ required_error: '验证码不能为空' }),
    username: z.string({ required_error: '手机号不能为空' }),
    name: z.string(),
    companyName: z.string({ required_error: '公司名称不能为空' }),
    areaCode: z.string({ required_error: '区号不能为空' })
})

// 字典类型枚举
export const DictTypeEnum = z.enum(['SYSTEM', 'BUSINESS', 'USER', 'OTHER'])
export type DictType = z.infer<typeof DictTypeEnum>

// 字典项验证模式
export const DictionaryItemSchema = z.object({
    id: z.number().int().optional(), // 创建时可选，更新时必填
    itemCode: z.string().min(1, '字典项编码不能为空'),
    itemName: z.string().min(1, '字典项名称不能为空'),
    itemValue: z.string().min(1, '字典项值不能为空'),
    description: z.string().optional(),
    status: z.boolean().default(true),
    sort: z.number().int().default(0)
})

// 字典主表验证模式
export const DictionarySchema = z.object({
    id: z.number().int().optional(),
    dictType: DictTypeEnum,
    dictCode: z.string().min(1, '字典编码不能为空'),
    dictName: z.string().min(1, '字典名称不能为空'),
    description: z.string().optional(),
    status: z.boolean().default(true),
    sort: z.number().int().default(0),
    items: z.array(DictionaryItemSchema).optional()
})

// 创建字典的验证模式
export const CreateDictionarySchema = DictionarySchema.omit({ id: true })

// 更新字典的验证模式
export const UpdateDictionarySchema = DictionarySchema.partial().extend({
    id: z.number().int().min(1, '字典ID不能为空')
})

// 查询字典的验证模式
export const QueryDictionarySchema = z.object({
    dictType: DictTypeEnum.optional(),
    dictCode: z.string().optional(),
    dictName: z.string().optional(),
    status: z.boolean().optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).default(10)
})

// 导出类型
export type DictionaryItem = z.infer<typeof DictionaryItemSchema>
export type Dictionary = z.infer<typeof DictionarySchema>
export type CreateDictionaryDto = z.infer<typeof CreateDictionarySchema>
export type UpdateDictionaryDto = z.infer<typeof UpdateDictionarySchema>
export type QueryDictionaryDto = z.infer<typeof QueryDictionarySchema>

// 权限角色枚举
export const AuthRoleEnum = z.enum(['1', '2', '3'])

// 权限项验证模式
export const AuthItemSchema = z.object({
    value: z.string().min(1, '权限值不能为空'),
    role: z.number().int().min(1, '角色ID不能为空')
})

// Google账户申请表单验证模式
export const GoogleAccountSchema = z.object({
    productType: z
        .number({ required_error: '产品类型不能为空' })
        .int()
        .min(1, '产品类型不能为空'),
    // .string({ required_error: '产品类型不能为空' })
    // .min(1, '产品类型不能为空'),
    timezone: z
        .string({ required_error: '时区不能为空' })
        .min(1, '时区不能为空'),
    currencyCode: z
        .string({ required_error: '币种不能为空' })
        .min(1, '币种不能为空'),
    promotionLinks: z
        .array(
            z
                .string({ required_error: '推广链接不能为空' })
                .url('请输入有效的链接')
        )
        .min(1, '至少需要一个推广链接'),
    name: z.string({ required_error: '名称不能为空' }).min(1, '名称不能为空'),
    rechargeAmount: z
        .string()
        .regex(/^\d+(\.\d{1,2})?$/, '请输入有效的金额格式')
        .optional(),
    auths: z
        .array(z.union([AuthItemSchema, z.null()]))
        .optional()
        .default([])
})

// 导出类型
export type GoogleAccount = z.infer<typeof GoogleAccountSchema>
export type AuthItem = z.infer<typeof AuthItemSchema>

export const TiktokBusinessSchema = z.object({
    companyNameEN: z.string().optional(),
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
    productType: z.number({ required_error: '产品类型不能为空' }).int(),
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
