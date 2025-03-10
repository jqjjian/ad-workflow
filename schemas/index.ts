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

// Auth项的基础schema
const AuthItemSchema = z
    .object({
        role: z.number(),
        value: z.string().min(1, '授权邮箱不能为空')
    })
    .nullable()

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

// 使用更准确的类型定义
// const taskNumber = z.string().optional()
// const taskId = z.string().optional()
// const mediaPlatform = z.enum(['1', '2', '3']).optional() // Meta, Google, TikTok

const company = z.object({
    name: z.string().optional(),
    businessLicenseNo: z.string().optional()
})
//     .optional()

// const status = z.enum(['1', '2', '3', '4']).optional() // 审核中, 已通过, 待修改, 已驳回

// 修正拼写错误，改为正确的 oeId
// const oeId = z.string().optional()

// 使用更合适的时间戳类型
// const startCreatedAt = z.number().optional()
// const endCreatedAt = z.number().optional()
// const startUpdatedAt = z.number().optional()
// const endUpdatedAt = z.number().optional()

// const page = z.number().min(1).optional().default(1)
// const pageSize = z.number().min(1).optional().default(10)

export const QueryApplyRecordSchema = z.object({
    taskNumbers: z.union([z.string(), z.array(z.string())]).optional(),
    taskIds: z
        .union([
            z.number().int(),
            z.string(),
            z.array(z.string()),
            z.array(z.number().int())
        ])
        .optional(),
    mediaPlatforms: z
        .union([z.number().int(), z.array(z.number().int())])
        .optional(),
    company: z.union([company, z.array(company)]).optional(),
    statuses: z.union([z.number().int(), z.array(z.number().int())]).optional(),
    oeIds: z.union([z.string(), z.array(z.string())]).optional(),
    startCreatedAt: z.number().optional(),
    endCreatedAt: z.number().optional(),
    startUpdatedAt: z.number().optional(),
    endUpdatedAt: z.number().optional(),
    page: z.number().optional(),
    pageSize: z.number().optional()
})

export type QueryApplyRecordDto = z.infer<typeof QueryApplyRecordSchema>

// 公司信息类型
const CompanySchema = z.object({
    name: z.string(),
    businessLicenseNo: z.string()
})

const MediaAccountInfoSchema = z.array(
    z.object({
        productType: z.number(),
        currencyCode: z.string(),
        timezone: z.string(),
        rechargeAmount: z.string(),
        promotionLinks: z.array(z.string()),
        name: z.string(),
        auths: z.array(AuthItemSchema)
    })
)

type MediaAccountInfo = z.infer<typeof MediaAccountInfoSchema>

export { MediaAccountInfoSchema, type MediaAccountInfo }

// 单条申请记录类型
const ApplicationRecordSchema = z.array(
    z.object({
        taskNumber: z.string(), // 外部工单ID
        taskId: z.string(), // 工单ID
        oeId: z.string(), // FB的oe ID
        mediaAccountInfos: MediaAccountInfoSchema, // 媒体账户信息
        mediaPlatform: z
            .number()
            .int() // 媒体平台：1(Facebook)、2(Google)、5(TikTok)
            .refine((v) => [1, 2, 5].includes(v)),
        status: z
            .number()
            .int() // 工单状态：10(审核中)、20(已通过)、30(待修改)、40(已驳回)
            .refine((v) => [10, 20, 30, 40].includes(v)),
        feedback: z.string().optional(), // 反馈信息
        company: CompanySchema, // 公司信息
        createdAt: z.number().int(), // 创建时间
        updatedAt: z.number().int() // 更新时间
    })
)

const ApplyRecordDataSchema = z.object({
    total: z.number().int(),
    pages: z.number().int(),
    pageNumber: z.number().int(),
    pageSize: z.number().int(),
    mediaAccountApplications: ApplicationRecordSchema
})
// 完整的API响应类型
const ApplyRecordResponseSchema = z.object({
    code: z.string(),
    message: z.string().optional(),
    data: ApplyRecordDataSchema
})
export type ApplyRecordData = z.infer<typeof ApplyRecordDataSchema>
export type ApplicationRecord = z.infer<typeof ApplicationRecordSchema>
// export type ApplyRecordResponse = z.infer<typeof ApplicationRecordSchema>

const mediaPlatform = z.number().int().optional()
const mediaAccountId = z.string().optional()
const mediaAccountName = z.string().optional()
const companyName = z.string().optional()
const status = z.number().int().optional()
const pageNumber = z.number().int().optional()
const pageSize = z.number().int().optional()

export const MediaAccountsearchFormSchema = z.object({
    mediaPlatform,
    mediaAccountId,
    mediaAccountName,
    companyName,
    status,
    pageNumber,
    pageSize
})

export type MediaAccountsearch = z.infer<typeof MediaAccountsearchFormSchema>
