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
import { API_BASE_URL, callExternalApi } from '@/lib/request'
import { generateTaskNumber, generateTraceId } from '@/lib/utils'
import { ValidationError, ThirdPartyError } from '@/utils/business-error'
import { z } from 'zod'
import { auth } from '@/auth'
import { v4 as uuidv4 } from 'uuid'

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
        // 使用callExternalApi方法调用第三方接口
        const result = await callExternalApi({
            url: `${API_BASE_URL}/openApi/v1/mediaAccount/unBindIdApplication/create`,
            body: request
        })

        console.log('解绑API调用结果:', result)

        // 处理API返回结果
        if (result.code === '0') {
            return ThirdPartyUnbindingResponseSchema.parse(result)
        } else {
            throw new ThirdPartyError(
                result.message || '第三方服务调用失败',
                result
            )
        }
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
        // 使用callExternalApi方法调用第三方接口
        const result = await callExternalApi({
            url: `${API_BASE_URL}/openApi/v1/mediaAccount/unBindIdApplication/update`,
            body: request
        })

        console.log('更新解绑API调用结果:', result)

        // 处理API返回结果
        if (result.code === '0') {
            return ThirdPartyUnbindingResponseSchema.parse(result)
        } else {
            throw new ThirdPartyError(
                result.message || '第三方服务调用失败',
                result
            )
        }
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

    try {
        // 获取当前用户会话
        const session = await auth()
        if (!session || !session.user) {
            return {
                code: 'AUTH_ERROR',
                message: '未登录或会话已过期',
                traceId
            }
        }

        // 验证输入参数
        const validatedInput =
            await AccountUnbindingRequestSchema.parseAsync(input)

        // 开启事务 - 在同一事务中创建工单和调用第三方API
        try {
            const result = await db.$transaction(async (tx) => {
                // 1. 创建工单主记录
                const workOrder = await tx.tecdo_work_orders.create({
                    data: {
                        id: uuidv4(),
                        taskId: generateTaskNumber(),
                        taskNumber:
                            validatedInput.taskNumber || generateTaskNumber(),
                        userId: session.user?.id || 'system-user',
                        workOrderType: 'ACCOUNT_MANAGEMENT',
                        workOrderSubtype: 'UNBIND_ACCOUNT',
                        status: 'PENDING', // 初始状态为PENDING
                        mediaAccountId: validatedInput.mediaAccountId,
                        metadata: {
                            traceId,
                            platformType:
                                validatedInput.mediaPlatform === 1
                                    ? 'BM'
                                    : 'MCC',
                            mediaPlatform: validatedInput.mediaPlatform
                        },
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                })

                // 2. 创建解绑业务数据
                const businessData = await tx.tecdo_account_binding_data.create(
                    {
                        data: {
                            id: uuidv4(),
                            workOrderId: workOrder.id,
                            mediaPlatform:
                                validatedInput.mediaPlatform.toString(),
                            mediaAccountId: validatedInput.mediaAccountId,
                            bindingValue: validatedInput.value,
                            bindingRole: 'STANDARD',
                            bindingStatus: 'PENDING',
                            bindingTime: new Date(),
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }
                    }
                )

                // 3. 直接调用第三方API，不经过管理员审批
                const thirdPartyResponse = await callThirdPartyUnbindingAPI(
                    validatedInput,
                    traceId
                )

                // 4. 创建原始数据记录
                const rawData = await tx.tecdo_raw_data.create({
                    data: {
                        id: uuidv4(),
                        workOrderId: workOrder.id,
                        requestData: JSON.stringify({
                            ...validatedInput,
                            traceId
                        }),
                        responseData: JSON.stringify(thirdPartyResponse),
                        syncStatus:
                            thirdPartyResponse.code === '0'
                                ? 'SUCCESS'
                                : 'FAILED',
                        syncAttempts: 1,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                })

                // 5. 根据第三方API响应确定工单状态
                const newStatus =
                    thirdPartyResponse.code === '0' ? 'PROCESSING' : 'FAILED'
                const thirdPartyTaskId = thirdPartyResponse.data?.taskId

                // 6. 更新工单状态
                await tx.tecdo_work_orders.update({
                    where: { id: workOrder.id },
                    data: {
                        status: newStatus,
                        thirdPartyTaskId: thirdPartyTaskId,
                        rawDataId: rawData.id,
                        updatedAt: new Date()
                    }
                })

                // 7. 更新解绑业务数据
                await tx.tecdo_account_binding_data.update({
                    where: { id: businessData.id },
                    data: {
                        bindingStatus: newStatus,
                        failureReason:
                            newStatus === 'FAILED'
                                ? thirdPartyResponse.message
                                : null,
                        updatedAt: new Date()
                    }
                })

                // 8. 添加工单日志
                await tx.tecdo_audit_logs.create({
                    data: {
                        id: uuidv4(),
                        entityType: 'WORK_ORDER',
                        entityId: workOrder.id,
                        action:
                            newStatus === 'PROCESSING'
                                ? '提交第三方成功'
                                : '提交第三方失败',
                        performedBy: session.user?.name || 'system',
                        newValue: JSON.stringify({
                            thirdPartyTaskId: thirdPartyTaskId,
                            response: thirdPartyResponse
                        }),
                        createdAt: new Date()
                    }
                })

                // 如果API调用失败，则抛出异常，整个事务将回滚
                if (thirdPartyResponse.code !== '0') {
                    throw new Error(
                        `调用第三方API失败: ${thirdPartyResponse.message}`
                    )
                }

                return {
                    code: '0',
                    message: '账户解绑工单创建并提交第三方成功',
                    data: {
                        workOrderId: workOrder.id,
                        taskId: workOrder.taskId,
                        externalTaskId: thirdPartyTaskId,
                        status: newStatus,
                        mediaPlatform: businessData.mediaPlatform,
                        mediaAccountId: businessData.mediaAccountId,
                        unbindingValue: businessData.bindingValue,
                        createdAt: workOrder.createdAt
                    },
                    traceId
                }
            })

            // 重新验证页面数据
            revalidatePath('/workorder')
            revalidatePath('/account/manage')
            revalidatePath('/account/applications')

            return result
        } catch (txError) {
            console.error('事务执行失败，工单创建回滚:', txError)
            return handleError(txError, traceId, '创建账户解绑工单')
        }
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
