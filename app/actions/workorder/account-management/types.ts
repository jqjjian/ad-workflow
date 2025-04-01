import * as z from 'zod'
import { MediaAccount } from '@/schemas/mediaAccount'
import { WorkOrderSubtype } from '@prisma/client'

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

// 定义工单状态枚举
export enum WorkOrderStatus {
    PENDING = 'PENDING', // 待处理
    APPROVED = 'APPROVED', // 已审核通过
    REJECTED = 'REJECTED', // 已拒绝
    PROCESSING = 'PROCESSING', // 处理中
    COMPLETED = 'COMPLETED', // 已完成
    FAILED = 'FAILED', // 失败
    CANCELED = 'CANCELED' // 已取消
}

// 工单类型枚举
export enum WorkOrderType {
    DEPOSIT = 'DEPOSIT', // 充值
    DEDUCTION = 'DEDUCTION', // 减款
    TRANSFER = 'TRANSFER', // 转账
    BIND = 'BIND' // 绑定
}

// 工单接口定义
export interface WorkOrder {
    id: string
    type: WorkOrderType // 工单类型
    status: WorkOrderStatus // 工单状态
    mediaAccountId: string
    mediaAccountName: string
    companyName: string
    mediaPlatform: number
    createdAt: string
    updatedAt: string
    createdBy: string
    updatedBy: string
    amount?: number
    dailyBudget?: number
    currency?: string
    remarks?: string
    taskId?: string
    reason?: string
    thirdPartyResponse?: string
}

// 充值工单参数
export interface DepositWorkOrderParams {
    mediaAccountId: string
    mediaAccountName: string
    mediaPlatform: number
    companyName: string
    amount: number | string // 支持字符串或数字类型
    dailyBudget?: number
    remarks?: string
}

// 充值工单更新参数
export interface UpdateDepositWorkOrderParams {
    workOrderId: string
    amount: number | string // 支持字符串或数字类型
    dailyBudget: number
}

// 工单审批参数
export interface ApproveWorkOrderParams {
    workOrderId: string
    approvedBy: string
    remarks?: string
}

// 工单拒绝参数
export interface RejectWorkOrderParams {
    workOrderId: string
    rejectedBy: string
    reason: string
}

// 第三方充值API响应
export interface ThirdPartyApiResponse {
    code: string
    message: string
    data?: {
        taskId: string
        paymentUrl?: string
        [key: string]: any
    }
}

// 媒体账户申请记录类型
export interface MediaAccountApplication {
    taskId: string
    status: number
    mediaAccountId?: string
    mediaAccountInfos?: Array<any>
}

// 定义第三方API响应类型
export interface MediaAccountApiResponse {
    code: string
    message: string
    data?: {
        total: number
        mediaAccounts: MediaAccount[]
    }
}

// 定义工单参数类型
export interface WorkOrderParams {
    newAccountName: string
    [key: string]: any
}

// 定义模拟工单类型
export interface MockWorkOrder {
    workOrderId: string
    systemStatus: WorkOrderStatus
    mediaPlatform: number
    mediaAccountId: string
    mediaAccountName: string
    workOrderParams: WorkOrderParams
}
