'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import {
    AccountUnbindingRequestSchema,
    ThirdPartyUnbindingResponseSchema,
    type AccountUnbindingRequest,
    type ThirdPartyUnbindingResponse,
    UpdateUnbindingRequestSchema,
    type UpdateUnbindingRequest
} from '@/schemas/account-unbinding'
import { generateTaskNumber, generateTraceId } from '@/lib/utils'
import { ValidationError, ThirdPartyError } from '@/utils/business-error'
import { z } from 'zod'

// 创建一个统一的错误处理函数
function handleError(error: unknown, traceId: string, operation: string) {
    console.error(`${operation} 失败:`, error)

    if (error instanceof z.ZodError) {
        return {
            code: 'VALIDATION_ERROR',
            message: '参数验证失败',
            data: { errors: error.errors },
            traceId
        }
    }

    if (error instanceof ThirdPartyError) {
        return {
            code: 'THIRD_PARTY_ERROR',
            message: error.message,
            data: error.details,
            traceId
        }
    }

    return {
        code: 'SYSTEM_ERROR',
        message: error instanceof Error ? error.message : '系统错误',
        traceId
    }
}

async function callThirdPartyUnbindingAPI(
    request: AccountUnbindingRequest,
    traceId: string
): Promise<ThirdPartyUnbindingResponse> {
    try {
        const response = await fetch(
            'openApi/v1/mediaAccount/unBindIdApplication/create',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Trace-Id': traceId
                },
                body: JSON.stringify(request)
            }
        )

        if (!response.ok) {
            throw new ThirdPartyError(
                `API 响应异常: ${response.status} ${response.statusText}`,
                { status: response.status, statusText: response.statusText }
            )
        }

        const data = await response.json()

        if (data.code !== '0') {
            throw new ThirdPartyError(
                data.message || '第三方服务调用失败',
                data
            )
        }

        return ThirdPartyUnbindingResponseSchema.parse(data)
    } catch (error) {
        if (error instanceof ThirdPartyError) {
            throw error
        }

        throw new ThirdPartyError(
            `调用第三方解绑API失败: ${error instanceof Error ? error.message : '未知错误'}`,
            error
        )
    }
}

async function callThirdPartyUpdateUnbindingAPI(
    request: UpdateUnbindingRequest,
    traceId: string
): Promise<ThirdPartyUnbindingResponse> {
    try {
        const response = await fetch(
            '/openApi/v1/mediaAccount/unBindIdApplication/update',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Trace-Id': traceId
                },
                body: JSON.stringify(request)
            }
        )

        if (!response.ok) {
            throw new ThirdPartyError(
                `API 响应异常: ${response.status} ${response.statusText}`,
                { status: response.status, statusText: response.statusText }
            )
        }

        const data = await response.json()

        if (data.code !== '0') {
            throw new ThirdPartyError(
                data.message || '第三方服务调用失败',
                data
            )
        }

        return ThirdPartyUnbindingResponseSchema.parse(data)
    } catch (error) {
        if (error instanceof ThirdPartyError) {
            throw error
        }

        throw new ThirdPartyError(
            `调用第三方修改解绑API失败: ${error instanceof Error ? error.message : '未知错误'}`,
            error
        )
    }
}

export async function createAccountUnbindingWorkOrder(input: unknown) {
    const traceId = generateTraceId()
    let workOrder: any = null

    try {
        // 验证输入参数
        const validatedInput =
            await AccountUnbindingRequestSchema.parseAsync(input)

        // 开启事务
        const result = await db.$transaction(
            async (tx) => {
                try {
                    // 1. 调用第三方API
                    const thirdPartyResponse = await callThirdPartyUnbindingAPI(
                        validatedInput,
                        traceId
                    )

                    // 2. 创建原始数据记录
                    const rawData = await tx.tecdo_raw_data.create({
                        data: {
                            requestData: JSON.stringify({
                                ...validatedInput,
                                traceId
                            }),
                            responseData: JSON.stringify(thirdPartyResponse),
                            syncStatus: 'PENDING',
                            syncAttempts: 0,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            tecdo_work_orders: { connect: { id: workOrder.id } }
                        }
                    })

                    // 3. 根据第三方API响应确定工单状态
                    const initialStatus =
                        thirdPartyResponse.code === '0' ? 'PENDING' : 'FAILED'

                    // 4. 创建工单主记录
                    workOrder = await tx.tecdo_work_orders.create({
                        data: {
                            taskId:
                                thirdPartyResponse.data?.taskId || 'unknown',
                            taskNumber:
                                validatedInput.taskNumber ||
                                generateTaskNumber(),
                            userId: 'current-user-id', // 从 session 获取
                            workOrderType: 'ACCOUNT_MANAGEMENT',
                            workOrderSubtype: 'UNBIND_ACCOUNT',
                            status: initialStatus,
                            rawDataId: rawData.id,
                            metadata: {
                                traceId,
                                platformType:
                                    validatedInput.mediaPlatform === 1
                                        ? 'BM'
                                        : 'MCC'
                            },
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }
                    })

                    // 5. 创建解绑业务数据
                    const businessData =
                        await tx.tecdo_account_binding_data.create({
                            data: {
                                workOrderId: workOrder.id,
                                mediaPlatform:
                                    validatedInput.mediaPlatform.toString(),
                                mediaAccountId: validatedInput.mediaAccountId,
                                bindingValue: validatedInput.value,
                                bindingRole: 'STANDARD',
                                bindingStatus: initialStatus,
                                bindingTime: new Date(),
                                failureReason:
                                    initialStatus === 'FAILED'
                                        ? thirdPartyResponse.message
                                        : null,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            }
                        })

                    // 6. 更新工单记录的业务数据ID
                    await tx.tecdo_work_orders.update({
                        where: { id: workOrder.id },
                        data: { businessDataId: businessData.id }
                    })

                    return {
                        code: thirdPartyResponse.code,
                        message: thirdPartyResponse.message,
                        data:
                            thirdPartyResponse.code === '0'
                                ? {
                                      workOrderId: workOrder.id,
                                      taskId: workOrder.taskId,
                                      externalTaskId:
                                          thirdPartyResponse.data?.taskId,
                                      status: initialStatus,
                                      mediaPlatform: businessData.mediaPlatform,
                                      mediaAccountId:
                                          businessData.mediaAccountId,
                                      unbindingValue: businessData.bindingValue,
                                      createdAt: workOrder.createdAt
                                  }
                                : undefined,
                        traceId
                    }
                } catch (error) {
                    // 记录事务错误
                    await tx.tecdo_error_log.create({
                        data: {
                            entityType: 'WORK_ORDER',
                            entityId: workOrder?.id || 'unknown',
                            errorCode:
                                error instanceof ThirdPartyError
                                    ? 'THIRD_PARTY_ERROR'
                                    : 'TRANSACTION_ERROR',
                            errorMessage:
                                error instanceof Error
                                    ? error.message
                                    : '未知事务错误',
                            stackTrace:
                                error instanceof Error
                                    ? error.stack
                                    : undefined,
                            severity: 'HIGH',
                            resolved: false,
                            createdAt: new Date()
                        }
                    })

                    throw error // 重新抛出以便外层处理
                }
            },
            {
                timeout: 10000 // 设置事务超时时间
            }
        )

        // 重新验证页面数据
        revalidatePath('/workorder')
        return result
    } catch (error) {
        return handleError(error, traceId, '创建账户解绑')
    }
}

export async function updateAccountUnbindingWorkOrder(input: unknown) {
    const traceId = generateTraceId()
    let existingWorkOrder: any = null

    try {
        // 1. 验证输入参数
        const validatedInput =
            await UpdateUnbindingRequestSchema.parseAsync(input)

        // 开启事务
        const result = await db.$transaction(
            async (tx) => {
                try {
                    // 2. 查找现有工单
                    existingWorkOrder = await tx.tecdo_work_orders.findFirst({
                        where: {
                            taskId: validatedInput.taskId,
                            workOrderSubtype: 'UNBIND_ACCOUNT',
                            isDeleted: false
                        },
                        include: {
                            tecdo_account_binding_data: true,
                            tecdo_raw_data: true
                        }
                    })

                    if (!existingWorkOrder) {
                        const errorMsg = `未找到解绑工单: ${validatedInput.taskId}`
                        console.error(errorMsg, {
                            taskId: validatedInput.taskId,
                            traceId
                        })
                        throw new ValidationError(errorMsg)
                    }

                    if (!existingWorkOrder.tecdo_account_binding_data) {
                        const errorMsg = `工单 ${validatedInput.taskId} 不是解绑工单`
                        console.error(errorMsg, {
                            taskId: validatedInput.taskId,
                            traceId
                        })
                        throw new ValidationError(errorMsg)
                    }

                    // 3. 检查工单状态是否可修改
                    const modifiableStatuses = ['INIT', 'PENDING', 'RETURNED']
                    if (
                        !modifiableStatuses.includes(existingWorkOrder.status)
                    ) {
                        throw new Error(
                            `当前工单状态 ${existingWorkOrder.status} 不允许修改`
                        )
                    }

                    // 4. 调用第三方API
                    const thirdPartyResponse =
                        await callThirdPartyUpdateUnbindingAPI(
                            validatedInput,
                            traceId
                        )

                    // 5. 更新原始数据
                    await tx.tecdo_raw_data.update({
                        where: { workOrderId: existingWorkOrder.id },
                        data: {
                            requestData: JSON.stringify({
                                ...JSON.parse(
                                    existingWorkOrder.tecdo_raw_data
                                        ?.requestData || '{}'
                                ),
                                updateRequest: {
                                    ...validatedInput,
                                    traceId
                                }
                            }),
                            responseData: JSON.stringify({
                                ...JSON.parse(
                                    existingWorkOrder.tecdo_raw_data
                                        ?.responseData || '{}'
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
                    const updatedBusinessData =
                        await tx.tecdo_account_binding_data.update({
                            where: { workOrderId: existingWorkOrder.id },
                            data: {
                                bindingValue: validatedInput.value,
                                bindingRole: 'STANDARD',
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
                                      unbindingValue:
                                          updatedBusinessData.bindingValue,
                                      updatedAt: updatedBusinessData.updatedAt
                                  }
                                : undefined,
                        traceId
                    }
                } catch (error) {
                    // 记录事务错误
                    await tx.tecdo_error_log.create({
                        data: {
                            entityType: 'WORK_ORDER',
                            entityId: existingWorkOrder?.id || 'unknown',
                            errorCode:
                                error instanceof ThirdPartyError
                                    ? 'THIRD_PARTY_ERROR'
                                    : 'TRANSACTION_ERROR',
                            errorMessage:
                                error instanceof Error
                                    ? error.message
                                    : '未知事务错误',
                            stackTrace:
                                error instanceof Error
                                    ? error.stack
                                    : undefined,
                            severity: 'HIGH',
                            resolved: false,
                            createdAt: new Date()
                        }
                    })

                    throw error // 重新抛出以便外层处理
                }
            },
            {
                timeout: 10000 // 设置事务超时时间
            }
        )

        // 重新验证页面数据
        revalidatePath('/workorder')
        return result
    } catch (error) {
        return handleError(error, traceId, '更新账户解绑')
    }
}
