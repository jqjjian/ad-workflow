'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import {
    AccountBindingRequestSchema,
    ThirdPartyBindingResponseSchema,
    type AccountBindingRequest,
    type ThirdPartyBindingResponse,
    UpdateBindingRequestSchema
} from '@/schemas/account-binding'
import { generateTaskNumber, generateTraceId } from '@/lib/utils'
import { z } from 'zod'
import { BaseWorkOrderHandler } from '@/utils/base-workorder-handler'
import { ApiResponse } from '@/types/api'
import { ValidationError, ThirdPartyError } from '@/utils/business-error'

async function callThirdPartyBindingAPI(
    request: AccountBindingRequest,
    traceId: string
): Promise<ThirdPartyBindingResponse> {
    try {
        const response = await fetch('third-party-binding-api-url', {
            method: 'POST',
            body: JSON.stringify(request)
        })

        const data = await response.json()
        return ThirdPartyBindingResponseSchema.parse(data)
    } catch (error) {
        throw new Error(
            `调用第三方绑定API失败: ${error instanceof Error ? error.message : '未知错误'}`
        )
    }
}

async function callThirdPartyUpdateBindingAPI(
    request: UpdateBindingRequest,
    traceId: string
): Promise<ThirdPartyBindingResponse> {
    try {
        const response = await fetch(
            'openApi/v1/mediaAccount/bindIdApplication/update',
            {
                method: 'POST',
                body: JSON.stringify(request)
            }
        )

        const data = await response.json()
        return ThirdPartyBindingResponseSchema.parse(data)
    } catch (error) {
        throw new Error(
            `调用第三方修改绑定API失败: ${error instanceof Error ? error.message : '未知错误'}`
        )
    }
}

export class AccountBindingHandler extends BaseWorkOrderHandler {
    protected async validateInput(input: unknown) {
        try {
            return await AccountBindingRequestSchema.parseAsync(input)
        } catch (error) {
            throw new ValidationError('参数验证失败', error)
        }
    }

    protected async callThirdPartyApi(validatedInput: any) {
        try {
            const response = await fetch(
                'openApi/v1/mediaAccount/bindIdApplication/create',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Trace-Id': this.traceId
                    },
                    body: JSON.stringify(validatedInput)
                }
            )

            const data = await response.json()

            if (data.code !== '0') {
                throw new ThirdPartyError(
                    data.message || '第三方服务调用失败',
                    data
                )
            }

            return data
        } catch (error) {
            throw new ThirdPartyError(
                `调用第三方绑定API失败: ${error instanceof Error ? error.message : '未知错误'}`,
                error
            )
        }
    }

    protected async createBusinessData(
        workOrderId: string,
        validatedInput: any,
        thirdPartyResponse: any
    ) {
        // 实现具体的业务数据创建逻辑
        return await prisma.accountBindingData.create({
            data: {
                workOrderId,
                mediaPlatform: validatedInput.mediaPlatform.toString(),
                mediaAccountId: validatedInput.mediaAccountId,
                bindingValue: validatedInput.value,
                bindingRole: validatedInput.role,
                bindingStatus:
                    thirdPartyResponse.code === '0' ? 'PENDING' : 'FAILED',
                bindingTime: new Date(),
                failureReason:
                    thirdPartyResponse.code === '0'
                        ? null
                        : thirdPartyResponse.message
            }
        })
    }
}

// 导出服务端action
export async function createAccountBindingWorkOrder(
    input: unknown,
    userId: string
): Promise<ApiResponse> {
    const handler = new AccountBindingHandler(userId)
    return await handler.createWorkOrder(input)
}

export async function updateAccountBindingWorkOrder(input: unknown) {
    const traceId = generateTraceId()

    try {
        // 1. 验证输入参数
        const validatedInput =
            await UpdateBindingRequestSchema.parseAsync(input)

        // 开启事务
        const result = await prisma.$transaction(async (tx) => {
            // 2. 查找现有工单
            const existingWorkOrder = await tx.tecdo_work_orders.findFirst({
                where: {
                    taskId: validatedInput.taskId,
                    workOrderSubtype: 'BIND_ACCOUNT',
                    isDeleted: false
                },
                include: {
                    accountBindingData: true,
                    rawData: true
                }
            })

            if (!existingWorkOrder) {
                throw new Error(`未找到绑定工单: ${validatedInput.taskId}`)
            }

            if (!existingWorkOrder.accountBindingData) {
                throw new Error(`工单 ${validatedInput.taskId} 不是绑定工单`)
            }

            // 3. 检查工单状态是否可修改
            const modifiableStatuses = ['INIT', 'PENDING', 'RETURNED']
            if (!modifiableStatuses.includes(existingWorkOrder.status)) {
                throw new Error(
                    `当前工单状态 ${existingWorkOrder.status} 不允许修改`
                )
            }

            // 4. 调用第三方API
            const thirdPartyResponse = await callThirdPartyUpdateBindingAPI(
                {
                    ...validatedInput,
                    mediaPlatform:
                        existingWorkOrder.accountBindingData.mediaPlatform
                },
                traceId
            )

            // 5. 更新原始数据
            await tx.tecdo_raw_data.update({
                where: { workOrderId: existingWorkOrder.id },
                data: {
                    requestData: JSON.stringify({
                        ...JSON.parse(
                            existingWorkOrder.rawData?.requestData || '{}'
                        ),
                        updateRequest: {
                            ...validatedInput,
                            traceId
                        }
                    }),
                    responseData: JSON.stringify({
                        ...JSON.parse(
                            existingWorkOrder.rawData?.responseData || '{}'
                        ),
                        updateResponse: thirdPartyResponse
                    }),
                    updatedAt: new Date()
                }
            })

            // 6. 根据API响应确定工单状态
            const newStatus =
                thirdPartyResponse.code === '0' ? 'PENDING' : 'FAILED'

            // 7. 更新工单状态
            await tx.tecdo_work_orders.update({
                where: { id: existingWorkOrder.id },
                data: {
                    status: newStatus,
                    metadata: {
                        ...existingWorkOrder.metadata,
                        lastUpdateTraceId: traceId
                    },
                    updatedAt: new Date()
                }
            })

            // 8. 更新业务数据
            const updatedBusinessData = await tx.accountBindingData.update({
                where: { workOrderId: existingWorkOrder.id },
                data: {
                    bindingValue: validatedInput.value,
                    bindingRole: validatedInput.role,
                    bindingStatus: newStatus,
                    failureReason:
                        newStatus === 'FAILED'
                            ? thirdPartyResponse.message
                            : null,
                    updatedAt: new Date()
                }
            })

            return {
                code: thirdPartyResponse.code,
                message: thirdPartyResponse.message,
                data:
                    thirdPartyResponse.code === '0'
                        ? {
                              workOrderId: existingWorkOrder.id,
                              taskId: existingWorkOrder.taskId,
                              status: newStatus,
                              bindingValue: updatedBusinessData.bindingValue,
                              bindingRole: updatedBusinessData.bindingRole,
                              updatedAt: updatedBusinessData.updatedAt
                          }
                        : undefined,
                traceId
            }
        })

        // 重新验证页面数据
        revalidatePath('/workorder')
        return result
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                code: 'VALIDATION_ERROR',
                message: '参数验证失败',
                data: {
                    errors: error.errors
                },
                traceId
            }
        }

        return {
            code: 'SYSTEM_ERROR',
            message: error instanceof Error ? error.message : '系统错误',
            traceId
        }
    }
}
