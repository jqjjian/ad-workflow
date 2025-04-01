import * as z from 'zod'

// 充值Schema定义
export const DepositSchema = z.object({
    mediaAccountId: z.string(),
    mediaAccountName: z.string(),
    mediaPlatform: z.number(),
    amount: z.number().positive(),
    currency: z.string().default('CNY'),
    exchangeRate: z.number().optional(),
    paymentMethod: z.string(),
    paymentChannel: z.string().optional(),
    remarks: z.string().optional()
})

// 减款Schema定义
export const WithdrawalSchema = z.object({
    mediaAccountId: z.string(),
    mediaAccountName: z.string(),
    mediaPlatform: z.number(),
    amount: z.number().positive(),
    currency: z.string().default('CNY'),
    remarks: z.string().optional()
})

// 转账Schema定义
export const TransferSchema = z.object({
    sourceAccountId: z.string(),
    sourceAccountName: z.string(),
    targetAccountId: z.string(),
    targetAccountName: z.string(),
    mediaPlatform: z.number(),
    amount: z.number().positive(),
    currency: z.string().default('CNY'),
    remarks: z.string().optional()
})

// 账户绑定Schema定义
export const AccountBindSchema = z.object({
    mediaAccountId: z.string(),
    mediaAccountName: z.string(),
    mediaPlatform: z.number(),
    userEmail: z.string().email(),
    bindRole: z.string(),
    remarks: z.string().optional()
})

// Pixel绑定Schema定义
export const PixelBindSchema = z.object({
    mediaAccountId: z.string(),
    mediaAccountName: z.string(),
    mediaPlatform: z.number(),
    pixelId: z.string(),
    pixelName: z.string().optional(),
    remarks: z.string().optional()
})

// 邮箱绑定Schema定义
export const EmailBindSchema = z.object({
    mediaAccountId: z.string(),
    mediaAccountName: z.string(),
    mediaPlatform: z.number(),
    email: z.string().email(),
    remarks: z.string().optional()
})

// 导出类型
export type Deposit = z.infer<typeof DepositSchema>
export type Withdrawal = z.infer<typeof WithdrawalSchema>
export type Transfer = z.infer<typeof TransferSchema>
export type AccountBind = z.infer<typeof AccountBindSchema>
export type PixelBind = z.infer<typeof PixelBindSchema>
export type EmailBind = z.infer<typeof EmailBindSchema>
