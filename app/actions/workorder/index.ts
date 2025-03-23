'use server'

import { db } from '@/lib/db'
import { WorkOrderQuerySchema } from '@/schemas/workorder'
import { z } from 'zod'

export async function queryWorkOrders(input: unknown) {
    try {
        // 验证输入参数
        const validatedInput = WorkOrderQuerySchema.parse(input)

        // 构建查询条件
        const where: any = {
            isDeleted: false
        }

        // 添加条件过滤
        if (validatedInput.taskNumbers?.length) {
            where.taskNumber = { in: validatedInput.taskNumbers }
        }

        if (validatedInput.taskIds?.length) {
            where.taskId = { in: validatedInput.taskIds }
        }

        if (validatedInput.types?.length) {
            where.workOrderSubtype = { in: validatedInput.types }
        }

        if (validatedInput.mediaAccountIds?.length) {
            where.OR = [
                {
                    depositData: {
                        mediaAccountId: { in: validatedInput.mediaAccountIds }
                    }
                },
                {
                    withdrawalData: {
                        mediaAccountId: { in: validatedInput.mediaAccountIds }
                    }
                },
                {
                    transferData: {
                        sourceAccountId: { in: validatedInput.mediaAccountIds }
                    }
                },
                {
                    transferData: {
                        targetAccountId: { in: validatedInput.mediaAccountIds }
                    }
                },
                {
                    zeroingData: {
                        mediaAccountId: { in: validatedInput.mediaAccountIds }
                    }
                }
            ]
        }

        if (validatedInput.mediaPlatforms?.length) {
            where.OR = [
                {
                    depositData: {
                        mediaPlatform: { in: validatedInput.mediaPlatforms }
                    }
                },
                {
                    withdrawalData: {
                        mediaPlatform: { in: validatedInput.mediaPlatforms }
                    }
                },
                {
                    transferData: {
                        mediaPlatform: { in: validatedInput.mediaPlatforms }
                    }
                },
                {
                    zeroingData: {
                        mediaPlatform: { in: validatedInput.mediaPlatforms }
                    }
                }
            ]
        }

        if (validatedInput.statuses?.length) {
            where.status = { in: validatedInput.statuses }
        }

        // 时间范围过滤
        if (validatedInput.startCreatedTimestamp) {
            where.createdAt = {
                ...where.createdAt,
                gte: new Date(validatedInput.startCreatedTimestamp)
            }
        }

        if (validatedInput.endCreatedTimestamp) {
            where.createdAt = {
                ...where.createdAt,
                lte: new Date(validatedInput.endCreatedTimestamp)
            }
        }

        if (validatedInput.startUpdatedTimestamp) {
            where.updatedAt = {
                ...where.updatedAt,
                gte: new Date(validatedInput.startUpdatedTimestamp)
            }
        }

        if (validatedInput.endUpdatedTimestamp) {
            where.updatedAt = {
                ...where.updatedAt,
                lte: new Date(validatedInput.endUpdatedTimestamp)
            }
        }

        // 执行查询
        const [total, items] = await db.$transaction([
            // 获取总数
            db.tecdo_work_orders.count({ where }),

            // 获取分页数据
            db.tecdo_work_orders.findMany({
                where,
                include: {
                    tecdo_raw_data: true,
                    tecdo_deposit_business_data: true,
                    tecdo_withdrawal_business_data: true,
                    tecdo_transfer_business_data: true,
                    tecdo_zeroing_business_data: true
                },
                orderBy: {
                    updatedAt: 'desc'
                },
                skip: (validatedInput.pageNumber - 1) * validatedInput.pageSize,
                take: validatedInput.pageSize
            })
        ])

        // 处理媒体账号名称过滤（内存过滤）
        let filteredItems = items
        if (validatedInput.mediaAccountNames?.length) {
            const nameSet = new Set(
                validatedInput.mediaAccountNames.map((name) =>
                    name.toLowerCase()
                )
            )
            filteredItems = items.filter((item: any) => {
                const accountName = item.metadata?.mediaAccountName as string
                return accountName && nameSet.has(accountName.toLowerCase())
            })
        }

        // 转换响应数据
        const result = filteredItems.map((item: any) => ({
            id: item.id,
            taskId: item.taskId,
            taskNumber: item.taskNumber,
            workOrderType: item.workOrderType,
            workOrderSubtype: item.workOrderSubtype,
            status: item.status,
            mediaAccountId:
                item.tecdo_deposit_business_data?.mediaAccountId ||
                item.tecdo_withdrawal_business_data?.mediaAccountId ||
                item.tecdo_transfer_business_data?.sourceAccountId ||
                item.tecdo_zeroing_business_data?.mediaAccountId,
            mediaPlatform:
                item.tecdo_deposit_business_data?.mediaPlatform ||
                item.tecdo_withdrawal_business_data?.mediaPlatform ||
                item.tecdo_transfer_business_data?.mediaPlatform ||
                item.tecdo_zeroing_business_data?.mediaPlatform,
            mediaAccountName: item.metadata?.mediaAccountName,
            amount:
                item.tecdo_deposit_business_data?.amount ||
                item.tecdo_withdrawal_business_data?.amount ||
                item.tecdo_transfer_business_data?.amount,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt
        }))

        return {
            code: '0',
            message: '查询成功',
            data: {
                total,
                items: result,
                pageNumber: validatedInput.pageNumber,
                pageSize: validatedInput.pageSize
            }
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                code: 'VALIDATION_ERROR',
                message: '参数验证失败',
                data: {
                    errors: error.errors
                }
            }
        }

        return {
            code: 'SYSTEM_ERROR',
            message: error instanceof Error ? error.message : '系统错误'
        }
    }
}
