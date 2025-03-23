import { BaseWorkOrderHandler } from '@/utils/base-workorder-handler'
import { db } from '@/lib/db'
import { ApiResponse } from '@/types/api'
import { generateTaskNumber } from '@/lib/utils'
import { BusinessError } from '@/utils/business-error'
import { ErrorCode } from '@/constants/error-codes'
import { WorkOrderSubtype } from '@prisma/client'

export abstract class AccountApplicationHandler extends BaseWorkOrderHandler {
    protected abstract readonly platform: string
    protected abstract readonly apiEndpoint: string

    protected async createPromotionLinks(
        userId: string,
        links: string | string[]
    ) {
        const linksArray = Array.isArray(links)
            ? links
            : [links].filter(Boolean)
        return await db.promotionLink.createMany({
            data: linksArray.map((link) => ({
                link,
                userId
            }))
        })
    }

    protected async createWorkOrderRecord(
        tx: any,
        validatedInput: any,
        thirdPartyResponse: any,
        rawDataId: string
    ) {
        return await tx.tecdo_work_orders.create({
            data: {
                taskId: thirdPartyResponse.data?.taskId || 'unknown',
                taskNumber: validatedInput.taskNumber || generateTaskNumber(),
                userId: this.userId,
                workOrderType: 'ACCOUNT_APPLICATION',
                workOrderSubtype: this.getWorkOrderSubtype(),
                status: thirdPartyResponse.code === '0' ? 'PENDING' : 'FAILED',
                rawDataId,
                metadata: {
                    traceId: this.traceId,
                    platform: this.platform
                },
                createdAt: new Date(),
                updatedAt: new Date()
            }
        })
    }

    protected async createRawData(
        tx: any,
        validatedInput: any,
        thirdPartyResponse: any
    ) {
        return await tx.tecdo_raw_data.create({
            data: {
                requestData: JSON.stringify({
                    ...validatedInput,
                    traceId: this.traceId
                }),
                responseData: JSON.stringify(thirdPartyResponse),
                createdAt: new Date(),
                updatedAt: new Date()
            }
        })
    }

    protected abstract getWorkOrderSubtype(): WorkOrderSubtype

    // 更新工单的通用方法
    async updateWorkOrder(
        taskId: string,
        input: unknown
    ): Promise<ApiResponse> {
        try {
            // 验证输入
            const validatedInput = await this.validateInput(input)

            // 查找现有工单
            const existingWorkOrder = await db.tecdo_work_orders.findFirst({
                where: {
                    taskId,
                    workOrderType: 'ACCOUNT_APPLICATION',
                    workOrderSubtype: this.getWorkOrderSubtype(),
                    isDeleted: false
                },
                include: {
                    accountAppData: true,
                    rawData: true
                }
            })

            if (!existingWorkOrder) {
                throw new BusinessError(
                    '工单不存在',
                    ErrorCode.RESOURCE_NOT_FOUND
                )
            }

            // 检查工单状态
            if (!['PENDING', 'RETURNED'].includes(existingWorkOrder.status)) {
                throw new BusinessError(
                    '当前工单状态不允许修改',
                    ErrorCode.STATUS_ERROR
                )
            }

            // 执行事务
            const result = await db.$transaction(async (tx) => {
                // 调用第三方API
                const thirdPartyResponse = await this.callThirdPartyApi({
                    ...validatedInput,
                    taskId
                })

                // 创建新的原始数据记录
                const rawData = await this.createRawData(
                    tx,
                    validatedInput,
                    thirdPartyResponse
                )

                // 更新工单状态
                const newStatus =
                    thirdPartyResponse.code === '0' ? 'PENDING' : 'FAILED'

                await tx.tecdo_work_orders.update({
                    where: { id: existingWorkOrder.id },
                    data: {
                        status: newStatus,
                        rawDataId: rawData.id,
                        updatedAt: new Date()
                    }
                })

                // 更新业务数据
                const updatedBusinessData = await this.updateBusinessData(
                    tx,
                    existingWorkOrder.id,
                    validatedInput,
                    thirdPartyResponse
                )

                return this.formatResponse(
                    existingWorkOrder,
                    updatedBusinessData,
                    thirdPartyResponse
                )
            })

            return result
        } catch (error) {
            return this.handleError(error)
        }
    }

    protected abstract updateBusinessData(
        tx: any,
        workOrderId: string,
        validatedInput: any,
        thirdPartyResponse: any
    ): Promise<any>

    protected formatResponse(
        workOrder: any,
        businessData: any,
        thirdPartyResponse: any
    ): ApiResponse {
        return {
            code: thirdPartyResponse.code,
            message: thirdPartyResponse.message,
            success: thirdPartyResponse.code === '0',
            timestamp: Date.now(),
            data: {
                workOrder,
                businessData,
                thirdPartyResponse
            }
        }
    }
}
