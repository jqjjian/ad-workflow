import { z } from 'zod'

// 用户企业信息验证规则
export const UserCompanyInfoSchema = z.object({
    id: z.string().optional(), // 更新时使用
    companyNameCN: z
        .string()
        .min(1, '公司中文名称不能为空')
        .max(100, '公司中文名称不能超过100个字符'),
    companyNameEN: z
        .string()
        .min(1, '公司英文名称不能为空')
        .max(100, '公司英文名称不能超过100个字符'),
    businessLicenseNo: z
        .string()
        .min(1, '统一社会信用代码不能为空')
        .max(50, '统一社会信用代码长度不正确'),
    location: z.number().int().min(0).max(1),
    legalRepName: z
        .string()
        .min(1, '法人姓名不能为空')
        .max(50, '法人姓名不能超过50个字符'),
    idType: z.number().int().min(1).max(5),
    idNumber: z
        .string()
        .min(1, '证件号码不能为空')
        .max(50, '证件号码长度不正确'),
    legalRepPhone: z
        .string()
        .min(1, '法人手机号不能为空')
        .max(20, '法人手机号格式不正确'),
    legalRepBankCard: z.string().max(30, '银行卡号格式不正确').optional(),
    isDefault: z.boolean().default(false)
})

// 企业附件验证规则
export const UserCompanyAttachmentSchema = z.object({
    fileName: z.string().min(1, '文件名不能为空'),
    fileType: z.string().min(1, '文件类型不能为空'),
    fileSize: z.number().int().positive('文件大小必须大于0'),
    filePath: z.string().min(1, '文件路径不能为空'),
    ossObjectKey: z.string().min(1, 'OSS对象Key不能为空'),
    fileUrl: z.string().min(1, '文件URL不能为空'),
    description: z.string().optional()
})

// 工单企业信息验证规则
export const WorkOrderCompanyInfoSchema = z.object({
    userCompanyInfoId: z.string().optional(), // 可选的用户企业信息ID
    companyNameCN: z
        .string()
        .min(1, '公司中文名称不能为空')
        .max(100, '公司中文名称不能超过100个字符'),
    companyNameEN: z
        .string()
        .min(1, '公司英文名称不能为空')
        .max(100, '公司英文名称不能超过100个字符'),
    businessLicenseNo: z
        .string()
        .min(1, '统一社会信用代码不能为空')
        .max(50, '统一社会信用代码长度不正确'),
    location: z.number().int().min(0).max(1),
    legalRepName: z
        .string()
        .min(1, '法人姓名不能为空')
        .max(50, '法人姓名不能超过50个字符'),
    idType: z.number().int().min(1).max(5),
    idNumber: z
        .string()
        .min(1, '证件号码不能为空')
        .max(50, '证件号码长度不正确'),
    legalRepPhone: z
        .string()
        .min(1, '法人手机号不能为空')
        .max(20, '法人手机号格式不正确'),
    legalRepBankCard: z.string().max(30, '银行卡号格式不正确').optional(),
    attachments: z.array(UserCompanyAttachmentSchema).optional()
})

// 导出类型定义
export type UserCompanyInfo = z.infer<typeof UserCompanyInfoSchema>
export type UserCompanyAttachment = z.infer<typeof UserCompanyAttachmentSchema>
export type WorkOrderCompanyInfo = z.infer<typeof WorkOrderCompanyInfoSchema>
