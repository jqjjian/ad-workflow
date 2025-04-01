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
    workOrderType: z.string(),
    workOrderSubtype: z.string(),
    status: z.string(),
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

// 工单查询请求Schema
export const WorkOrderQuerySchema = z.object({
    workOrderType: z.string().optional(),
    status: z.string().optional(),
    startTime: z.date().optional(),
    endTime: z.date().optional(),
    pageNumber: z.number().int().default(1),
    pageSize: z.number().int().max(100).default(10)
})

export type WorkOrderQuery = z.infer<typeof WorkOrderQuerySchema>
