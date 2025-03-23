import { z } from 'zod'
import {
    WorkOrderTypeEnum,
    WorkOrderSubtypeEnum,
    WorkOrderStatusEnum
} from './enums'

// 基础工单Schema
export const BaseWorkOrderSchema = z.object({
    id: z.string().uuid(),
    taskId: z.string(),
    taskNumber: z.string(),
    userId: z.string(),
    workOrderType: WorkOrderTypeEnum,
    workOrderSubtype: WorkOrderSubtypeEnum,
    status: WorkOrderStatusEnum,
    rawDataId: z.string().uuid(),
    businessDataId: z.string().uuid().optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
    remark: z.string().optional(),
    metadata: z.record(z.unknown()).optional()
})

// 原始数据Schema
export const RawDataSchema = z.object({
    id: z.string().uuid(),
    workOrderId: z.string().uuid(),
    requestData: z.string(),
    responseData: z.string().optional(),
    createdAt: z.date(),
    updatedAt: z.date()
})

export type BaseWorkOrder = z.infer<typeof BaseWorkOrderSchema>
export type RawData = z.infer<typeof RawDataSchema>

// 工单类型枚举
export const WorkOrderTypeEnum = z
    .enum([
        'BIND_BM', // 20: 绑定BM
        'UNBIND_BM', // 21: 解绑BM
        'BIND_MAILBOX', // 25: 绑定邮箱
        'RECHARGE', // 30: 充值
        'DEDUCTION', // 50: 减款
        'ZEROING', // 51: 清零
        'TRANSFER' // 60: 转账
    ])
    .transform((val) => {
        const typeMap: Record<string, number> = {
            BIND_BM: 20,
            UNBIND_BM: 21,
            BIND_MAILBOX: 25,
            RECHARGE: 30,
            DEDUCTION: 50,
            ZEROING: 51,
            TRANSFER: 60
        }
        return typeMap[val]
    })

// 工单状态枚举
export const WorkOrderStatusEnum = z
    .enum([
        'REVIEWING', // 100: 审核中
        'PENDING_REVISION', // 120: 待修改
        'RETURNED', // 130: 已驳回
        'COMPLETED', // 150: 已完成
        'FAILED' // 160: 已失败
    ])
    .transform((val) => {
        const statusMap: Record<string, number> = {
            REVIEWING: 100,
            PENDING_REVISION: 120,
            RETURNED: 130,
            COMPLETED: 150,
            FAILED: 160
        }
        return statusMap[val]
    })

// 工单查询请求Schema
export const WorkOrderQuerySchema = z.object({
    taskNumbers: z.array(z.string()).optional(),
    taskIds: z.array(z.string()).optional(),
    types: z.array(z.number()).optional(),
    mediaAccountIds: z.array(z.string()).optional(),
    mediaPlatforms: z.array(z.number()).optional(),
    mediaAccountNames: z.array(z.string()).optional(),
    statuses: z.array(z.number()).optional(),
    startCreatedTimestamp: z.number().optional(),
    endCreatedTimestamp: z.number().optional(),
    startUpdatedTimestamp: z.number().optional(),
    endUpdatedTimestamp: z.number().optional(),
    pageNumber: z.number().default(1),
    pageSize: z.number().min(1).max(250).default(50)
})

export type WorkOrderQuery = z.infer<typeof WorkOrderQuerySchema>
