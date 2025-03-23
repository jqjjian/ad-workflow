import { z } from 'zod'

// 媒体平台枚举 - 添加数字映射
export const MediaPlatformEnum = z.enum([
    'FACEBOOK',
    'GOOGLE',
    'TIKTOK',
    'MICROSOFT_ADVERTISING'
])

// 媒体平台数字枚举 (用于API请求)
export const MediaPlatformNumberEnum = z.nativeEnum({
    FACEBOOK: 1,
    GOOGLE: 2,
    TIKTOK: 5,
    MICROSOFT_ADVERTISING: 7
})

// 媒体账户状态枚举
export const MediaAccountStatusEnum = z.nativeEnum({
    REVIEWING: 1, // 审核中
    ACTIVE: 2, // 生效中
    SUSPENDED: 3, // 封户
    INACTIVE: 4 // 失效
})

// 币种枚举
export const CurrencyEnum = z.enum(['USD', 'HKD'])

// 工单类型枚举 - 修正为与业务一致
export const WorkOrderTypeEnum = z.enum([
    'ACCOUNT_APPLICATION', // 账户申请
    'ACCOUNT_MANAGEMENT', // 账户管理
    'ATTACHMENT_MANAGEMENT', // 附件管理
    'PAYMENT', // 支付相关
    'BIND_BM', // 绑定BM
    'UNBIND_BM', // 解绑BM
    'BIND_MAILBOX', // 绑定邮箱
    'RECHARGE', // 充值
    'DEDUCTION', // 减款
    'ZEROING', // 清零
    'TRANSFER' // 转账
])

// 工单类型数字映射(用于第三方API)
export const WorkOrderTypeNumberMap = {
    BIND_BM: 20,
    UNBIND_BM: 21,
    BIND_MAILBOX: 25,
    RECHARGE: 30,
    DEDUCTION: 50,
    ZEROING: 51,
    TRANSFER: 60
}

// 工单子类型枚举
export const WorkOrderSubtypeEnum = z.enum([
    'GOOGLE_ACCOUNT',
    'TIKTOK_ACCOUNT',
    'FACEBOOK_ACCOUNT',
    'BIND_ACCOUNT',
    'UNBIND_ACCOUNT',
    'BIND_PIXEL',
    'UNBIND_PIXEL',
    'BIND_EMAIL',
    'UNBIND_EMAIL',
    'GENERAL_MANAGEMENT',
    'DOCUMENT_UPLOAD',
    'IMAGE_UPLOAD',
    'OTHER_ATTACHMENT',
    'DEPOSIT',
    'WITHDRAWAL',
    'TRANSFER',
    'ZEROING'
])

// 工单状态枚举 - 整合两个文件中的不同状态
export const WorkOrderStatusEnum = z.enum([
    'INIT', // 初始化
    'PENDING', // 待处理
    'REVIEWING', // 审核中
    'PENDING_REVISION', // 待修改
    'RETURNED', // 已驳回
    'SUCCESS', // 成功
    'COMPLETED', // 已完成
    'FAILED', // 失败
    'CANCELLED' // 已取消
])

// 工单状态数字映射(用于第三方API)
export const WorkOrderStatusNumberMap = {
    REVIEWING: 100,
    PENDING_REVISION: 120,
    RETURNED: 130,
    COMPLETED: 150,
    FAILED: 160
}

// 第三方工单状态映射(申请记录状态)
export const ThirdPartyStatusEnum = z.nativeEnum({
    SUBMITTED: 10, // 已提交
    PROCESSING: 20, // 处理中
    APPROVED: 30, // 已批准
    REJECTED: 40 // 已拒绝
})

// 支付状态枚举
export const PaymentStatusEnum = z.enum([
    'INIT',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'CANCELLED'
])

// 导出类型定义
export type MediaPlatform = z.infer<typeof MediaPlatformEnum>
export type MediaPlatformNumber = z.infer<typeof MediaPlatformNumberEnum>
export type MediaAccountStatus = z.infer<typeof MediaAccountStatusEnum>
export type Currency = z.infer<typeof CurrencyEnum>
export type WorkOrderType = z.infer<typeof WorkOrderTypeEnum>
export type WorkOrderSubtype = z.infer<typeof WorkOrderSubtypeEnum>
export type WorkOrderStatus = z.infer<typeof WorkOrderStatusEnum>
export type ThirdPartyStatus = z.infer<typeof ThirdPartyStatusEnum>
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>

// 工单类型映射助手函数
export function getWorkOrderTypeNumber(type: string): number | undefined {
    return WorkOrderTypeNumberMap[type as keyof typeof WorkOrderTypeNumberMap]
}

// 工单状态映射助手函数
export function getWorkOrderStatusNumber(status: string): number | undefined {
    return WorkOrderStatusNumberMap[
        status as keyof typeof WorkOrderStatusNumberMap
    ]
}
