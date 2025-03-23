'use server'

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import {
    AccountBindingRequestSchema,
    ThirdPartyBindingResponseSchema,
    type AccountBindingRequest,
    type ThirdPartyBindingResponse,
    UpdateBindingRequestSchema,
    type UpdateBindingRequest
} from '@/schemas/account-binding'
import { generateTaskNumber, generateTraceId } from '@/lib/utils'
import { z } from 'zod'
import { ApiResponse } from '@/types/api'
import { ValidationError, ThirdPartyError } from '@/utils/business-error'
import { auth } from '@/auth'
import { v4 as uuidv4 } from 'uuid'
import { UserRole, WorkOrderSubtype } from '@prisma/client'
import { ApproveWorkOrderParams, RejectWorkOrderParams } from './types'

// 异步API调用函数
async function callThirdPartyBindingAPI(
    request: AccountBindingRequest,
    traceId: string
): Promise<ThirdPartyBindingResponse> {
    try {
        const response = await fetch('third-party-binding-api-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Trace-Id': traceId
            },
            body: JSON.stringify(request)
        })

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

        return ThirdPartyBindingResponseSchema.parse(data)
    } catch (error) {
        if (error instanceof ThirdPartyError) {
            throw error
        }

        throw new ThirdPartyError(
            `调用第三方绑定API失败: ${error instanceof Error ? error.message : '未知错误'}`,
            error
        )
    }
}

async function callThirdPartyUpdateBindingAPI(
    request: UpdateBindingRequest,
    traceId: string
): Promise<ThirdPartyBindingResponse> {
    try {
        const response = await fetch(
            '/openApi/v1/mediaAccount/bindIdApplication/update',
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

// 统一的错误处理函数
async function handleError(error: unknown, traceId: string, operation: string) {
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

// 参数接口定义
interface AccountBindingWorkOrderParams {
    mediaAccountId: string
    mediaAccountName: string
    mediaPlatform: number
    companyName: string
    mccId: string
    bindingType: 'bind' | 'unbind'
    remarks?: string
}

/**
 * 创建账户绑定工单 - 核心业务方法
 */
export async function createAccountBindingWorkOrder(
    params: AccountBindingWorkOrderParams
): Promise<{
    success: boolean
    message?: string
    data?: { workOrderId: string; taskId?: string }
}> {
    try {
        // 获取当前用户会话
        const session = await auth()
        if (!session || !session.user) {
            return {
                success: false,
                message: '未登录或会话已过期'
            }
        }

        // 参数验证
        if (
            !params.mediaAccountId ||
            !params.mediaAccountName ||
            !params.mediaPlatform ||
            !params.mccId ||
            !params.bindingType
        ) {
            return {
                success: false,
                message: '参数不完整'
            }
        }

        // 检查用户是否存在
        const userExists = await db.tecdo_users.findUnique({
            where: { id: session.user.id }
        })

        // 如果用户不存在，使用备用系统用户
        const actualUserId = userExists
            ? session.user.id
            : '系统中已知存在的用户ID'
        const userName = session.user.name || '系统用户'

        // 检查媒体账户是否存在，但不作为工单创建的必要条件
        try {
            const mediaAccount = await db.tecdo_media_accounts.findUnique({
                where: { id: params.mediaAccountId }
            })

            if (!mediaAccount) {
                console.log(
                    `注意: 媒体账户ID ${params.mediaAccountId} 在系统中不存在，但仍将创建工单`
                )
            } else {
                console.log(
                    `媒体账户ID ${params.mediaAccountId} 验证通过，继续创建工单`
                )
            }
        } catch (mediaAccountError) {
            console.error(
                '查询媒体账户时出错，但将继续创建工单:',
                mediaAccountError
            )
        }

        // 生成工单ID和跟踪ID
        const workOrderId = uuidv4() // 使用UUID生成工单ID
        const taskNumber = generateTaskNumber(
            'ACCOUNT_MANAGEMENT',
            'BIND_ACCOUNT'
        )
        const traceId = generateTraceId()

        // 开启事务
        const result = await db.$transaction(async (tx) => {
            // 1. 创建工单记录
            const workOrder = await tx.tecdo_work_orders.create({
                data: {
                    id: workOrderId,
                    taskId: workOrderId,
                    taskNumber,
                    userId: actualUserId,
                    workOrderType: 'ACCOUNT_MANAGEMENT',
                    workOrderSubtype: 'BIND_ACCOUNT',
                    status: 'PENDING',
                    mediaAccountId: params.mediaAccountId,
                    remark: params.remarks,
                    metadata: {
                        bindingType: params.bindingType,
                        mccId: params.mccId,
                        createTraceId: traceId,
                        userName,
                        mediaPlatform: params.mediaPlatform,
                        mediaAccountName: params.mediaAccountName,
                        companyName: params.companyName
                    },
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            })

            // 2. 添加工单审计日志
            await tx.tecdo_audit_logs.create({
                data: {
                    id: uuidv4(),
                    entityType: 'WORK_ORDER',
                    entityId: workOrder.id,
                    action: '创建账户绑定工单',
                    performedBy: userName,
                    newValue: JSON.stringify({
                        mediaAccountId: params.mediaAccountId,
                        mediaAccountName: params.mediaAccountName,
                        mediaPlatform: params.mediaPlatform,
                        bindingType: params.bindingType,
                        mccId: params.mccId
                    }),
                    createdAt: new Date()
                }
            })

            // 3. 尝试创建绑定数据记录
            try {
                // 检查是否已存在关联的业务数据
                const existingBusinessData =
                    await tx.tecdo_account_binding_data.findUnique({
                        where: { workOrderId: workOrder.id }
                    })

                if (existingBusinessData) {
                    console.log(
                        `工单ID ${workOrder.id} 已有关联的绑定数据，不再创建新记录`
                    )
                } else {
                    // 创建绑定数据记录
                    await tx.tecdo_account_binding_data.create({
                        data: {
                            id: uuidv4(),
                            workOrderId: workOrder.id,
                            mediaPlatform: params.mediaPlatform.toString(),
                            mediaAccountId: params.mediaAccountId,
                            bindingValue: params.mccId,
                            bindingRole:
                                params.bindingType === 'bind'
                                    ? 'CHILD'
                                    : 'NONE',
                            bindingStatus: 'PENDING',
                            bindingTime: new Date(),
                            createdAt: new Date(),
                            updatedAt: new Date()
                        }
                    })
                    console.log('账户绑定业务数据创建成功')
                }
            } catch (businessDataError) {
                console.error(
                    '创建账户绑定业务数据时出错，但工单已创建:',
                    businessDataError
                )
                // 记录更详细的错误信息
                await tx.tecdo_error_log.create({
                    data: {
                        id: uuidv4(),
                        entityType: 'ACCOUNT_BINDING_DATA',
                        entityId: workOrder.id,
                        errorCode: 'BUSINESS_DATA_CREATE_FAILED',
                        errorMessage:
                            businessDataError instanceof Error
                                ? businessDataError.message
                                : '创建业务数据失败',
                        stackTrace:
                            businessDataError instanceof Error
                                ? businessDataError.stack || ''
                                : '',
                        severity: 'ERROR',
                        resolved: false,
                        createdAt: new Date()
                    }
                })
                // 仅记录错误，不中断工单创建流程
            }

            return workOrder
        })

        // 刷新相关页面
        revalidatePath('/account/manage')
        revalidatePath('/account/applications')

        // 返回成功信息
        console.log('账户绑定工单创建成功:', {
            workOrderId: result.id,
            taskId: result.taskId
        })

        return {
            success: true,
            message: `MCC${params.bindingType === 'bind' ? '绑定' : '解绑'}工单创建成功`,
            data: {
                workOrderId: result.id,
                taskId: result.taskId
            }
        }
    } catch (error) {
        console.error('创建MCC绑定/解绑工单出错:', error)

        // 对于Zod验证错误，提供详细的验证失败信息
        if (error instanceof z.ZodError) {
            return {
                success: false,
                message: '参数验证失败'
            }
        }

        return {
            success: false,
            message:
                error instanceof Error ? error.message : '创建账户绑定工单失败'
        }
    }
}

/**
 * 修改MCC绑定工单 - 核心业务方法
 */
export async function updateAccountBindingWorkOrder(
    workOrderId: string,
    params: Partial<AccountBindingWorkOrderParams>
): Promise<{
    success: boolean
    message?: string
}> {
    try {
        // 获取当前用户会话
        const session = await auth()
        if (!session || !session.user) {
            return {
                success: false,
                message: '未登录或会话已过期'
            }
        }

        const traceId = generateTraceId()
        const userId = session.user.id || 'unknown'

        // 查找现有工单
        const existingWorkOrder = await db.tecdo_work_orders.findFirst({
            where: {
                taskId: workOrderId,
                workOrderSubtype: 'BIND_ACCOUNT',
                isDeleted: false
            },
            include: {
                tecdo_account_binding_data: true,
                tecdo_raw_data: true
            }
        })

        if (!existingWorkOrder) {
            return {
                success: false,
                message: `未找到绑定工单: ${workOrderId}`
            }
        }

        // 检查工单状态是否可修改
        const modifiableStatuses = ['INIT', 'PENDING', 'RETURNED']
        if (!modifiableStatuses.includes(existingWorkOrder.status)) {
            return {
                success: false,
                message: `当前工单状态 ${existingWorkOrder.status} 不允许修改`
            }
        }

        // 开启事务
        await db.$transaction(async (tx) => {
            // 更新工单记录
            await tx.tecdo_work_orders.update({
                where: { id: existingWorkOrder.id },
                data: {
                    remark: params.remarks,
                    metadata: JSON.stringify({
                        ...JSON.parse(
                            existingWorkOrder.metadata?.toString() || '{}'
                        ),
                        lastUpdateTraceId: traceId,
                        mccId:
                            params.mccId ||
                            JSON.parse(
                                existingWorkOrder.metadata?.toString() || '{}'
                            ).mccId
                    }),
                    updatedAt: new Date()
                }
            })

            // 更新绑定数据
            if (params.mccId && existingWorkOrder.tecdo_account_binding_data) {
                await tx.tecdo_account_binding_data.update({
                    where: { workOrderId: existingWorkOrder.id },
                    data: {
                        bindingValue: params.mccId,
                        updatedAt: new Date()
                    }
                })
            }

            // 更新原始数据
            if (existingWorkOrder.tecdo_raw_data) {
                await tx.tecdo_raw_data.update({
                    where: { workOrderId: existingWorkOrder.id },
                    data: {
                        requestData: JSON.stringify({
                            ...JSON.parse(
                                existingWorkOrder.tecdo_raw_data.requestData ||
                                    '{}'
                            ),
                            updateRequest: {
                                ...params,
                                traceId
                            }
                        }),
                        updatedAt: new Date()
                    }
                })
            }
        })

        // 刷新相关页面
        revalidatePath('/account/manage')
        revalidatePath('/account/workorders')

        return {
            success: true,
            message: 'MCC绑定工单修改成功'
        }
    } catch (error) {
        console.error('修改MCC绑定工单出错:', error)
        return {
            success: false,
            message: '修改MCC绑定工单失败'
        }
    }
}

/**
 * 提交MCC绑定工单到第三方接口 - 核心业务方法
 */
export async function submitAccountBindingWorkOrderToThirdParty(
    workOrderId: string
): Promise<{
    success: boolean
    message?: string
    thirdPartyResponse?: any
}> {
    try {
        // 获取当前用户会话
        const session = await auth()
        if (!session || !session.user) {
            return {
                success: false,
                message: '未登录或会话已过期'
            }
        }

        const traceId = generateTraceId()

        // 查找现有工单
        const workOrder = await db.tecdo_work_orders.findFirst({
            where: {
                taskId: workOrderId,
                workOrderSubtype: 'BIND_ACCOUNT',
                isDeleted: false
            },
            include: {
                tecdo_account_binding_data: true,
                tecdo_raw_data: true
            }
        })

        if (!workOrder) {
            return {
                success: false,
                message: `未找到绑定工单: ${workOrderId}`
            }
        }

        if (!workOrder.tecdo_account_binding_data) {
            return {
                success: false,
                message: `工单 ${workOrderId} 不是绑定工单`
            }
        }

        // 检查工单状态是否可提交
        const submittableStatuses = ['PENDING', 'INIT']
        if (!submittableStatuses.includes(workOrder.status)) {
            return {
                success: false,
                message: `当前工单状态 ${workOrder.status} 不允许提交`
            }
        }

        // 准备API调用参数
        const metadata = JSON.parse(workOrder.metadata?.toString() || '{}')
        const bindingData = workOrder.tecdo_account_binding_data
        const bindingType = metadata.bindingType || 'bind'

        const apiRequest = {
            mediaPlatform: Number(
                metadata.mediaPlatform || bindingData.mediaPlatform
            ),
            mediaAccountId: workOrder.mediaAccountId,
            value: bindingData.bindingValue,
            role: bindingData.bindingRole,
            taskId: workOrder.taskId
        }

        // 调用第三方API
        let thirdPartyResponse
        try {
            // 根据绑定类型调用不同API
            if (bindingType === 'bind') {
                thirdPartyResponse = await callThirdPartyBindingAPI(
                    apiRequest as AccountBindingRequest,
                    traceId
                )
            } else {
                // 解绑逻辑，可能需要不同的API
                thirdPartyResponse = await callThirdPartyBindingAPI(
                    apiRequest as AccountBindingRequest,
                    traceId
                )
            }
        } catch (error) {
            // 记录API调用失败，但不中断事务
            console.error('调用第三方API失败:', error)
            thirdPartyResponse = {
                code: 'API_ERROR',
                message:
                    error instanceof Error
                        ? error.message
                        : '调用第三方API失败',
                success: false
            }
        }

        // 开启事务更新数据库
        await db.$transaction(async (tx) => {
            // 1. 更新工单状态
            const newStatus =
                thirdPartyResponse.code === '0' ? 'PROCESSING' : 'FAILED'
            await tx.tecdo_work_orders.update({
                where: { id: workOrder.id },
                data: {
                    status: newStatus,
                    metadata: JSON.stringify({
                        ...metadata,
                        submissionTraceId: traceId,
                        lastSubmitTime: new Date().toISOString()
                    }),
                    updatedAt: new Date()
                }
            })

            // 2. 更新绑定数据
            await tx.tecdo_account_binding_data.update({
                where: { workOrderId: workOrder.id },
                data: {
                    bindingStatus: newStatus,
                    failureReason:
                        newStatus === 'FAILED'
                            ? thirdPartyResponse.message
                            : null,
                    updatedAt: new Date()
                }
            })

            // 3. 更新原始响应数据
            if (workOrder.tecdo_raw_data) {
                await tx.tecdo_raw_data.update({
                    where: { workOrderId: workOrder.id },
                    data: {
                        responseData: JSON.stringify({
                            ...JSON.parse(
                                workOrder.tecdo_raw_data.responseData || '{}'
                            ),
                            submitResponse: thirdPartyResponse,
                            submitTime: new Date().toISOString()
                        }),
                        syncStatus:
                            newStatus === 'PROCESSING' ? 'SUCCESS' : 'FAILED',
                        syncAttempts:
                            (workOrder.tecdo_raw_data.syncAttempts || 0) + 1,
                        updatedAt: new Date()
                    }
                })
            }
        })

        // 刷新相关页面
        revalidatePath('/account/manage')
        revalidatePath('/account/workorders')

        return {
            success: thirdPartyResponse.code === '0',
            message:
                thirdPartyResponse.code === '0'
                    ? '工单已成功提交给第三方平台'
                    : `提交失败: ${thirdPartyResponse.message}`,
            thirdPartyResponse
        }
    } catch (error) {
        console.error('提交MCC绑定工单出错:', error)
        return {
            success: false,
            message: '提交MCC绑定工单失败'
        }
    }
}

/**
 * 查询绑定工单的状态 - 实用辅助方法
 */
export async function checkAccountBindingStatus(workOrderId: string): Promise<{
    success: boolean
    message?: string
    data?: {
        status: string
        bindingValue: string
        bindingRole: string
        updatedAt: Date
    }
}> {
    try {
        // 获取当前用户会话
        const session = await auth()
        if (!session || !session.user) {
            return {
                success: false,
                message: '未登录或会话已过期'
            }
        }

        // 查询工单
        const workOrder = await db.tecdo_work_orders.findFirst({
            where: {
                taskId: workOrderId,
                userId: session.user.id,
                workOrderSubtype: 'BIND_ACCOUNT'
            },
            include: {
                tecdo_account_binding_data: true
            }
        })

        if (!workOrder || !workOrder.tecdo_account_binding_data) {
            return {
                success: false,
                message: '找不到绑定工单'
            }
        }

        const bindingData = workOrder.tecdo_account_binding_data

        return {
            success: true,
            data: {
                status: workOrder.status,
                bindingValue: bindingData.bindingValue,
                bindingRole: bindingData.bindingRole,
                updatedAt: bindingData.updatedAt || workOrder.updatedAt
            }
        }
    } catch (error) {
        console.error('查询绑定工单状态出错:', error)
        return {
            success: false,
            message: '查询绑定工单状态失败'
        }
    }
}

/**
 * 管理员审批账户绑定工单
 * @param params 审批参数
 * @returns 操作结果
 */
export async function approveAccountBindingWorkOrder(
    params: ApproveWorkOrderParams
): Promise<{
    success: boolean
    message?: string
    data?: { workOrderId: string }
}> {
    try {
        // 获取当前用户会话
        const session = await auth()
        if (!session || !session.user) {
            return {
                success: false,
                message: '未登录或会话已过期'
            }
        }

        // 验证是否为管理员
        if (
            session.user.role !== UserRole.ADMIN &&
            session.user.role !== UserRole.SUPER_ADMIN
        ) {
            return {
                success: false,
                message: '无权操作，仅管理员可审批工单'
            }
        }

        // 查询工单
        const workOrder = await db.tecdo_work_orders.findUnique({
            where: { id: params.workOrderId }
        })

        // 验证工单是否存在
        if (!workOrder) {
            return {
                success: false,
                message: '工单不存在'
            }
        }

        // 验证工单状态
        if (workOrder.status !== 'PENDING') {
            return {
                success: false,
                message: '只能审批待处理状态的工单'
            }
        }

        // 验证工单类型
        if (workOrder.workOrderSubtype !== 'BIND_ACCOUNT') {
            return {
                success: false,
                message: '非账户绑定工单，无法进行此操作'
            }
        }

        const username = session.user.name || 'unknown'
        const now = new Date()

        // 更新工单状态为已审批
        await db.tecdo_work_orders.update({
            where: { id: params.workOrderId },
            data: {
                status: 'PROCESSING',
                updatedAt: now,
                remark: params.remarks || workOrder.remark
            }
        })

        // 添加工单日志
        await db.tecdo_audit_logs.create({
            data: {
                id: uuidv4(),
                entityType: 'WORK_ORDER',
                entityId: params.workOrderId,
                action: '审批通过',
                performedBy: username,
                previousValue: JSON.stringify({ status: workOrder.status }),
                newValue: JSON.stringify({
                    status: 'PROCESSING',
                    remarks: params.remarks
                }),
                createdAt: now
            }
        })

        // 刷新相关页面
        revalidatePath('/admin/workorders')

        return {
            success: true,
            message: '账户绑定工单审批成功',
            data: {
                workOrderId: params.workOrderId
            }
        }
    } catch (error) {
        console.error('审批账户绑定工单出错:', error)
        return {
            success: false,
            message: '账户绑定工单审批失败'
        }
    }
}

/**
 * 拒绝账户绑定工单
 * @param params 拒绝参数
 * @returns 操作结果
 */
export async function rejectAccountBindingWorkOrder(
    params: RejectWorkOrderParams
): Promise<{
    success: boolean
    message?: string
    data?: { workOrderId: string }
}> {
    try {
        // 获取当前用户会话
        const session = await auth()
        if (!session || !session.user) {
            return {
                success: false,
                message: '未登录或会话已过期'
            }
        }

        // 验证是否为管理员
        if (
            session.user.role !== UserRole.ADMIN &&
            session.user.role !== UserRole.SUPER_ADMIN
        ) {
            return {
                success: false,
                message: '无权操作，仅管理员可拒绝工单'
            }
        }

        if (!params.reason) {
            return {
                success: false,
                message: '必须提供拒绝原因'
            }
        }

        // 查询工单
        const workOrder = await db.tecdo_work_orders.findUnique({
            where: { id: params.workOrderId }
        })

        // 验证工单是否存在
        if (!workOrder) {
            return {
                success: false,
                message: '工单不存在'
            }
        }

        // 验证工单状态
        if (workOrder.status !== 'PENDING') {
            return {
                success: false,
                message: '只能拒绝待处理状态的工单'
            }
        }

        // 验证工单类型
        if (workOrder.workOrderSubtype !== 'BIND_ACCOUNT') {
            return {
                success: false,
                message: '非账户绑定工单，无法进行此操作'
            }
        }

        const username = session.user.name || 'unknown'
        const now = new Date()

        // 更新工单状态为已拒绝
        await db.tecdo_work_orders.update({
            where: { id: params.workOrderId },
            data: {
                status: 'CANCELLED',
                updatedAt: now,
                remark: params.reason
            }
        })

        // 添加工单日志
        await db.tecdo_audit_logs.create({
            data: {
                id: uuidv4(),
                entityType: 'WORK_ORDER',
                entityId: params.workOrderId,
                action: '拒绝工单',
                performedBy: username,
                previousValue: JSON.stringify({ status: workOrder.status }),
                newValue: JSON.stringify({
                    status: 'CANCELLED',
                    reason: params.reason
                }),
                createdAt: now
            }
        })

        // 刷新相关页面
        revalidatePath('/admin/workorders')

        return {
            success: true,
            message: '账户绑定工单已拒绝',
            data: {
                workOrderId: params.workOrderId
            }
        }
    } catch (error) {
        console.error('拒绝账户绑定工单出错:', error)
        return {
            success: false,
            message: '拒绝账户绑定工单失败'
        }
    }
}
