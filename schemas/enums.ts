import { z } from 'zod'

// 媒体平台枚举
export const MediaPlatformEnum = z.enum([
    'FACEBOOK',
    'GOOGLE',
    'TIKTOK',
    'MICROSOFT_ADVERTISING'
])

// 币种枚举
export const CurrencyEnum = z.enum(['USD', 'HKD'])

// 工单类型枚举
export const WorkOrderTypeEnum = z.enum([
    'ACCOUNT_APPLICATION',
    'ACCOUNT_MANAGEMENT',
    'ATTACHMENT_MANAGEMENT',
    'PAYMENT'
])

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

// 工单状态枚举
export const WorkOrderStatusEnum = z.enum([
    'INIT',
    'PENDING',
    'SUCCESS',
    'FAILED',
    'CANCELLED'
])

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
export type Currency = z.infer<typeof CurrencyEnum>
export type WorkOrderType = z.infer<typeof WorkOrderTypeEnum>
export type WorkOrderSubtype = z.infer<typeof WorkOrderSubtypeEnum>
export type WorkOrderStatus = z.infer<typeof WorkOrderStatusEnum>
export type PaymentStatus = z.infer<typeof PaymentStatusEnum>
