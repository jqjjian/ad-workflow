import * as z from 'zod'

// 产品类型枚举
export const ProductTypeEnum = {
    GAME: 1, // 游戏
    APP: 2, // App
    ECOMMERCE: 3, // 电商
    OTHER: 0 // 其他
} as const

// 授权角色枚举
export const AuthRoleEnum = {
    STANDARD: 1, // 标准
    READONLY: 2, // 只读
    ADMIN: 3 // 管理员
} as const

// 媒体平台枚举
export const MediaPlatformEnum = {
    FACEBOOK: 1,
    GOOGLE: 2,
    TIKTOK: 3
} as const

// 工单状态枚举 - 对应于数据库中的状态值
export const WorkOrderStatusEnum = {
    PENDING: 10, // 审核中
    APPROVED: 20, // 已通过
    PENDING_MODIFICATION: 30, // 待修改
    REJECTED: 40, // 已驳回
    FAILED: 50 // 失败
} as const

// 附件验证模式
export const AttachmentSchema = z.object({
    fileName: z.string().min(1, '文件名不能为空'),
    fileType: z.string().min(1, '文件类型不能为空'),
    fileSize: z.number().int().positive('文件大小必须大于0'),
    filePath: z.string().min(1, '文件路径不能为空'),
    ossObjectKey: z.string().min(1, 'OSS对象Key不能为空'),
    fileUrl: z.string().min(1, '文件URL不能为空'),
    description: z.string().optional()
})

// 授权信息验证模式
export const AuthItemSchema = z
    .object({
        role: z.number(),
        value: z.string().email('请输入有效的邮箱地址')
    })
    .nullable()

// 验证推广链接
export const validatePromotionLinks = (links: string[]) => {
    const totalLength = links.reduce((sum, link) => sum + link.length, 0)
    return totalLength <= 1800 // 所有推广链接加起来长度不超过1800
}

// 通用基础账户信息验证模式
export const BaseAccountSchema = z.object({
    productType: z.number().int().optional(),
    currencyCode: z.string({ required_error: '货币代码不能为空' }),
    timezone: z.string({ required_error: '时区不能为空' }),
    promotionLinks: z
        .array(z.string().url('请输入有效的链接'))
        .min(1, '至少需要一个推广链接')
        .refine(validatePromotionLinks, {
            message: '推广链接总长度不能超过1800'
        }),
    name: z
        .string({ required_error: '名称不能为空' })
        .max(64, '账户名称不能超过64个字符'),
    rechargeAmount: z.string().optional(),
    auths: z.array(AuthItemSchema).optional().default([null])
})

// 公司信息基础schema
export const CompanyBaseSchema = z.object({
    name: z.string().optional(),
    businessLicenseNo: z.string().optional()
})

// 媒体账户信息schema
export const MediaAccountInfoBaseSchema = z.object({
    productType: z.number(),
    currencyCode: z.string(),
    timezone: z.string(),
    rechargeAmount: z.string(),
    promotionLinks: z.array(z.string()),
    name: z.string(),
    auths: z.array(AuthItemSchema)
})

// 媒体账户查询schema
export const MediaAccountSearchBaseSchema = z.object({
    mediaPlatform: z.number().int().optional(),
    mediaAccountId: z.string().optional(),
    mediaAccountName: z.string().optional(),
    companyName: z.string().optional(),
    status: z.number().int().optional(),
    pageNumber: z.number().int().optional(),
    pageSize: z.number().int().optional()
})

// 导出类型定义
export type Attachment = z.infer<typeof AttachmentSchema>
export type AuthItem = z.infer<typeof AuthItemSchema>
export type BaseAccount = z.infer<typeof BaseAccountSchema>
export type CompanyBase = z.infer<typeof CompanyBaseSchema>
export type MediaAccountInfoBase = z.infer<typeof MediaAccountInfoBaseSchema>
export type MediaAccountSearchBase = z.infer<
    typeof MediaAccountSearchBaseSchema
>
