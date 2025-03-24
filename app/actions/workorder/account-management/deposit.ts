'use server'

import { revalidatePath } from 'next/cache'
import { v4 as uuidv4 } from 'uuid'
import { auth } from '@/auth'
import { API_BASE_URL, callExternalApi } from '@/lib/request'
import { generateTaskNumber } from '@/lib/utils'
import { db } from '@/lib/db'
import {
    WorkOrderStatus,
    DepositWorkOrderParams,
    ApproveWorkOrderParams,
    RejectWorkOrderParams,
    UpdateDepositWorkOrderParams
} from './types'
import { UserRole, WorkOrderSubtype, WorkOrderType } from '@prisma/client'

/**
 * 创建充值工单
 * @param params 充值工单参数
 * @returns 操作结果
 */
export async function createDepositWorkOrder(
    params: DepositWorkOrderParams
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
            !params.amount
        ) {
            return {
                success: false,
                message: '参数不完整'
            }
        }

        // 使用generateTaskNumber方法生成工单号
        const workOrderId = `DEP-${uuidv4()}`
        const taskId = generateTaskNumber('ACCOUNT_MANAGEMENT', 'DEPOSIT')
        const userId = session.user.id
        const username = session.user.name || '系统用户'
        const now = new Date()

        // 检查用户是否存在
        const userExists = await db.tecdo_users.findUnique({
            where: { id: userId }
        })

        // 如果用户不存在，使用备用系统用户
        const actualUserId = userExists ? userId : '系统中已知存在的用户ID'

        // 转换金额为数字类型
        const amount =
            typeof params.amount === 'string'
                ? parseFloat(params.amount)
                : params.amount

        console.log('正在创建充值工单...', {
            workOrderId,
            taskId,
            userId,
            mediaAccountId: params.mediaAccountId
        })

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

        // 创建充值工单记录
        const workOrder = await db.tecdo_work_orders.create({
            data: {
                id: workOrderId,
                taskId: taskId,
                taskNumber: taskId,
                userId: actualUserId,
                workOrderType: 'ACCOUNT_MANAGEMENT',
                workOrderSubtype: WorkOrderSubtype.DEPOSIT,
                status: 'PENDING',
                mediaAccountId: params.mediaAccountId,
                metadata: {
                    mediaAccountName: params.mediaAccountName,
                    mediaPlatform: params.mediaPlatform,
                    companyName: params.companyName,
                    amount: amount,
                    dailyBudget: params.dailyBudget || 0,
                    currency: 'USD'
                },
                remark: params.remarks || null,
                createdAt: now,
                updatedAt: now
            }
        })

        console.log('工单记录创建成功', workOrder)

        // 添加工单日志
        await db.tecdo_audit_logs.create({
            data: {
                id: uuidv4(),
                entityType: 'WORK_ORDER',
                entityId: workOrderId,
                action: '创建工单',
                performedBy: username,
                newValue: JSON.stringify({
                    mediaAccountId: params.mediaAccountId,
                    mediaAccountName: params.mediaAccountName,
                    mediaPlatform: params.mediaPlatform,
                    amount: amount,
                    dailyBudget: params.dailyBudget
                }),
                createdAt: now
            }
        })

        // 尝试创建业务数据记录
        try {
            // 尝试找到相关联的工单记录以确保它存在
            const workOrderExists = await db.tecdo_work_orders.findUnique({
                where: { id: workOrderId }
            })

            if (!workOrderExists) {
                console.error(`无法创建业务数据 - 工单ID ${workOrderId} 不存在`)
                throw new Error(`工单ID ${workOrderId} 不存在`)
            }

            // 检查是否已存在关联的业务数据
            const existingBusinessData =
                await db.tecdo_deposit_business_data.findUnique({
                    where: { workOrderId: workOrderId }
                })

            if (existingBusinessData) {
                console.log(
                    `工单ID ${workOrderId} 已有关联的业务数据，不再创建新记录`
                )
            } else {
                // 创建新的业务数据记录
                await db.tecdo_deposit_business_data.create({
                    data: {
                        id: uuidv4(),
                        workOrderId: workOrderId,
                        mediaAccountId: params.mediaAccountId,
                        mediaPlatform: String(params.mediaPlatform),
                        amount: String(amount),
                        currency: 'USD',
                        dailyBudget: params.dailyBudget
                            ? Number(params.dailyBudget)
                            : 0,
                        depositStatus: 'PENDING',
                        createdAt: now,
                        updatedAt: now,
                        isDeleted: false
                    }
                })
                console.log('充值业务数据创建成功')
            }
        } catch (businessDataError) {
            console.error(
                '创建充值业务数据时出错，但工单已创建:',
                businessDataError
            )
            // 记录更详细的错误信息
            await db.tecdo_error_log
                .create({
                    data: {
                        id: uuidv4(),
                        entityType: 'DEPOSIT_BUSINESS_DATA',
                        entityId: workOrderId,
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
                        createdAt: now
                    }
                })
                .catch((logError) => {
                    console.error('记录错误日志失败:', logError)
                })

            // 仅记录错误，不中断工单创建流程
        }

        // 刷新相关页面
        revalidatePath('/account/manage')
        revalidatePath('/account/applications')

        // 返回成功信息
        console.log('充值工单创建成功:', { workOrderId, taskId })

        return {
            success: true,
            message: '充值工单创建成功',
            data: {
                workOrderId,
                taskId
            }
        }
    } catch (error) {
        console.error('创建充值工单出错:', error)
        return {
            success: false,
            message: error instanceof Error ? error.message : '创建充值工单失败'
        }
    }
}

/**
 * 管理员审批工单
 * @param params 审批参数
 * @returns 操作结果
 */
export async function approveDepositWorkOrder(
    params: ApproveWorkOrderParams
): Promise<{
    success: boolean
    message?: string
    data?: { workOrderId: string; thirdPartyTaskId?: string }
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
        // if (
        //     session.user.role !== UserRole.ADMIN &&
        //     session.user.role !== UserRole.SUPER_ADMIN
        // ) {
        //     return {
        //         success: false,
        //         message: '无权操作，仅管理员可审批工单'
        //     }
        // }

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
        if (workOrder.workOrderSubtype !== WorkOrderSubtype.DEPOSIT) {
            return {
                success: false,
                message: '非充值工单，无法进行此操作'
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

        // 调用第三方接口提交充值申请
        console.log('正在向第三方提交充值申请...')
        const thirdPartyResult = await submitRechargeToThirdParty(
            params.workOrderId
        )

        if (!thirdPartyResult.success) {
            console.error('向第三方提交充值申请失败:', thirdPartyResult.message)
            return {
                success: true,
                message: `工单审批成功，但向第三方提交充值申请失败: ${thirdPartyResult.message}`,
                data: {
                    workOrderId: params.workOrderId
                }
            }
        }

        console.log('向第三方提交充值申请成功:', thirdPartyResult)

        return {
            success: true,
            message: '工单审批并提交第三方充值接口成功',
            data: {
                workOrderId: params.workOrderId,
                thirdPartyTaskId: thirdPartyResult.data?.taskId
            }
        }
    } catch (error) {
        console.error('审批工单出错:', error)
        return {
            success: false,
            message: '工单审批失败'
        }
    }
}

/**
 * 拒绝工单
 * @param params 拒绝参数
 * @returns 操作结果
 */
export async function rejectDepositWorkOrder(
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
            message: '工单已拒绝',
            data: {
                workOrderId: params.workOrderId
            }
        }
    } catch (error) {
        console.error('拒绝工单出错:', error)
        return {
            success: false,
            message: '拒绝工单失败'
        }
    }
}

/**
 * 向第三方API提交充值申请
 * @param workOrderId 工单ID
 * @returns 操作结果
 */
export async function submitRechargeToThirdParty(workOrderId: string): Promise<{
    success: boolean
    message?: string
    data?: { taskId?: string }
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
        const workOrder = await db.tecdo_work_orders.findUnique({
            where: { id: workOrderId }
        })

        // 验证工单是否存在
        if (!workOrder) {
            return {
                success: false,
                message: '工单不存在'
            }
        }

        // 验证工单类型
        if (workOrder.workOrderSubtype !== WorkOrderSubtype.DEPOSIT) {
            return {
                success: false,
                message: '非充值工单，无法进行此操作'
            }
        }

        // 验证工单状态
        if (workOrder.status !== 'PROCESSING') {
            return {
                success: false,
                message: '只有审批通过的工单才能提交给第三方'
            }
        }

        // 获取工单元数据信息
        const metadata = (workOrder.metadata as any) || {}

        // 根据接口文档构建请求参数
        const requestBody = {
            mediaAccountId: workOrder.mediaAccountId,
            mediaPlatform: metadata.mediaPlatform,
            amount: metadata.amount?.toString(),
            dailyBudget: metadata.dailyBudget ? metadata.dailyBudget : 0,
            // 可选参数
            taskNumber: workOrder.taskNumber // 使用工单的任务编号
        }

        console.log('向第三方API提交充值申请:', requestBody)

        // 调用第三方API
        try {
            // 使用callExternalApi方法调用第三方接口
            const result = await callExternalApi({
                url: `${API_BASE_URL}/openApi/v1/mediaAccount/rechargeApplication/create`,
                body: requestBody
            })

            console.log('API调用结果:', result)

            const username = session.user.name || 'unknown'
            const now = new Date()

            // 处理API返回结果
            if (result.code === '0') {
                const thirdPartyTaskId =
                    result.data && typeof result.data === 'object'
                        ? (result.data as { taskId: string }).taskId
                        : undefined

                // 更新工单状态为处理中
                await db.tecdo_work_orders.update({
                    where: { id: workOrderId },
                    data: {
                        status: 'PROCESSING',
                        thirdPartyTaskId: thirdPartyTaskId,
                        updatedAt: now,
                        metadata: metadata
                            ? {
                                  ...(metadata as Record<string, any>),
                                  thirdPartyResponse: JSON.stringify(result)
                              }
                            : { thirdPartyResponse: JSON.stringify(result) }
                    }
                })

                // 添加工单日志
                await db.tecdo_audit_logs.create({
                    data: {
                        id: uuidv4(),
                        entityType: 'WORK_ORDER',
                        entityId: workOrderId,
                        action: '提交第三方',
                        performedBy: username,
                        newValue: JSON.stringify({
                            thirdPartyTaskId: thirdPartyTaskId,
                            response: result
                        }),
                        createdAt: now
                    }
                })

                // 刷新相关页面
                revalidatePath('/account/manage')
                revalidatePath('/account/applications')
                revalidatePath('/admin/workorders')

                return {
                    success: true,
                    message: result.message || '充值申请提交成功',
                    data: {
                        taskId: thirdPartyTaskId
                    }
                }
            } else {
                // 更新工单状态为失败
                await db.tecdo_work_orders.update({
                    where: { id: workOrderId },
                    data: {
                        status: 'FAILED',
                        updatedAt: now,
                        remark: result.message || '第三方平台返回错误',
                        metadata: workOrder.metadata
                            ? {
                                  ...(workOrder.metadata as Record<
                                      string,
                                      any
                                  >),
                                  error: result.message,
                                  thirdPartyResponse: JSON.stringify(result)
                              }
                            : {
                                  error: result.message,
                                  thirdPartyResponse: JSON.stringify(result)
                              }
                    }
                })

                // 添加工单日志
                await db.tecdo_audit_logs.create({
                    data: {
                        id: uuidv4(),
                        entityType: 'WORK_ORDER',
                        entityId: workOrderId,
                        action: '提交失败',
                        performedBy: username,
                        newValue: JSON.stringify({
                            error: result.message,
                            response: result
                        }),
                        createdAt: now
                    }
                })

                throw new Error(`API返回错误: ${result.message}`)
            }
        } catch (apiError) {
            console.error('API调用失败:', apiError)

            const username = session.user.name || 'unknown'
            const now = new Date()
            const errorMessage =
                apiError instanceof Error ? apiError.message : '未知错误'

            // 更新工单状态为失败
            await db.tecdo_work_orders.update({
                where: { id: workOrderId },
                data: {
                    status: 'FAILED',
                    updatedAt: now,
                    remark: `API调用失败: ${errorMessage}`,
                    metadata: workOrder.metadata
                        ? {
                              ...(workOrder.metadata as Record<string, any>),
                              error: errorMessage
                          }
                        : { error: errorMessage }
                }
            })

            // 添加工单日志
            await db.tecdo_audit_logs.create({
                data: {
                    id: uuidv4(),
                    entityType: 'WORK_ORDER',
                    entityId: workOrderId,
                    action: '提交失败',
                    performedBy: username,
                    newValue: JSON.stringify({
                        error: errorMessage
                    }),
                    createdAt: now
                }
            })

            throw new Error(`API调用失败: ${errorMessage}`)
        }
    } catch (error) {
        console.error('提交充值申请到第三方API失败:', error)

        // 刷新相关页面
        revalidatePath('/account/manage')
        revalidatePath('/account/applications')
        revalidatePath('/admin/workorders')

        return {
            success: false,
            message: error instanceof Error ? error.message : '提交充值申请失败'
        }
    }
}

/**
 * 查询第三方充值申请状态
 * @param taskId 任务ID
 * @returns 操作结果
 */
export async function queryRechargeStatus(taskId: string): Promise<{
    success: boolean
    message?: string
    data?: { status: string; result?: any }
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

        // 查询关联的工单
        const workOrder = await db.tecdo_work_orders.findFirst({
            where: { thirdPartyTaskId: taskId }
        })

        if (!workOrder) {
            return {
                success: false,
                message: '未找到关联工单'
            }
        }

        // 调用第三方API查询状态
        try {
            const result = await callExternalApi({
                url: `${API_BASE_URL}/openApi/v1/mediaAccount/rechargeApplication/query`,
                body: { taskId }
            })

            if (result.code === '0') {
                const username = session.user.name || 'unknown'
                const now = new Date()
                const statusFromApi =
                    result.data && typeof result.data === 'object'
                        ? (result.data as any).status
                        : undefined

                // 根据API返回状态更新工单状态
                let newStatus = workOrder.status
                if (statusFromApi === 'COMPLETED') {
                    newStatus = 'COMPLETED'
                } else if (statusFromApi === 'FAILED') {
                    newStatus = 'FAILED'
                }

                // 只有状态发生变化时才更新
                if (newStatus !== workOrder.status) {
                    // 更新工单状态
                    await db.tecdo_work_orders.update({
                        where: { id: workOrder.id },
                        data: {
                            status: newStatus,
                            updatedAt: now,
                            metadata: workOrder.metadata
                                ? {
                                      ...(workOrder.metadata as Record<
                                          string,
                                          any
                                      >),
                                      thirdPartyLatestResponse:
                                          JSON.stringify(result)
                                  }
                                : {
                                      thirdPartyLatestResponse:
                                          JSON.stringify(result)
                                  }
                        }
                    })

                    // 添加工单日志
                    await db.tecdo_audit_logs.create({
                        data: {
                            id: uuidv4(),
                            entityType: 'WORK_ORDER',
                            entityId: workOrder.id,
                            action: '状态更新',
                            performedBy: username,
                            previousValue: JSON.stringify({
                                status: workOrder.status
                            }),
                            newValue: JSON.stringify({
                                status: newStatus,
                                apiStatus: statusFromApi
                            }),
                            createdAt: now
                        }
                    })
                }

                return {
                    success: true,
                    message: '查询成功',
                    data: {
                        status: statusFromApi || '未知',
                        result: result.data
                    }
                }
            } else {
                return {
                    success: false,
                    message: result.message || '查询失败'
                }
            }
        } catch (apiError) {
            console.error('查询第三方API状态失败:', apiError)
            const errorMessage =
                apiError instanceof Error ? apiError.message : '未知错误'
            return {
                success: false,
                message: `查询API失败: ${errorMessage}`
            }
        }
    } catch (error) {
        console.error('查询充值状态失败:', error)
        return {
            success: false,
            message: '查询充值状态失败'
        }
    }
}

/**
 * 修改充值工单
 * @param params 修改充值工单参数
 * @returns 操作结果
 */
export async function updateDepositWorkOrder(
    params: UpdateDepositWorkOrderParams
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

        const userId = session.user.id

        // 参数验证
        if (!params.workOrderId || !params.amount || !params.dailyBudget) {
            return {
                success: false,
                message: '参数不完整'
            }
        }

        // 查询工单
        const workOrder = await db.tecdo_work_orders.findUnique({
            where: { id: params.workOrderId },
            include: {
                tecdo_deposit_business_data: true
            }
        })

        if (!workOrder) {
            return {
                success: false,
                message: '工单不存在'
            }
        }

        // 验证工单类型
        if (workOrder.workOrderSubtype !== 'DEPOSIT') {
            return {
                success: false,
                message: '非充值工单不能执行此操作'
            }
        }

        // 验证工单状态，只有待处理的工单才能修改
        if (workOrder.status !== 'PENDING') {
            return {
                success: false,
                message: '只有待处理的工单可以修改'
            }
        }

        // 检查是否有对应的充值业务数据
        if (!workOrder.tecdo_deposit_business_data) {
            return {
                success: false,
                message: '未找到充值业务数据'
            }
        }

        const depositData = workOrder.tecdo_deposit_business_data

        // 记录旧的数据，用于审计日志
        const oldAmount = depositData.amount
        const oldDailyBudget = depositData.dailyBudget

        // 更新充值业务数据
        await db.tecdo_deposit_business_data.update({
            where: { id: depositData.id },
            data: {
                amount: String(params.amount),
                dailyBudget: Number(params.dailyBudget)
            }
        })

        // 更新工单的更新时间
        await db.tecdo_work_orders.update({
            where: { id: params.workOrderId },
            data: {
                updatedAt: new Date()
            }
        })

        // 添加工单日志
        await db.tecdo_audit_logs.create({
            data: {
                entityType: 'DEPOSIT_WORKORDER',
                entityId: params.workOrderId,
                action: 'UPDATE',
                performedBy: userId,
                previousValue: JSON.stringify({
                    amount: oldAmount,
                    dailyBudget: oldDailyBudget
                }),
                newValue: JSON.stringify({
                    amount: params.amount,
                    dailyBudget: params.dailyBudget
                })
            }
        })

        revalidatePath('/account/record')

        return {
            success: true,
            message: '充值工单修改成功',
            data: { workOrderId: params.workOrderId }
        }
    } catch (error) {
        console.error('修改充值工单失败:', error)
        return {
            success: false,
            message: `修改充值工单失败: ${error instanceof Error ? error.message : String(error)}`
        }
    }
}

// 专门查询充值工单的方法
export async function getDepositWorkOrders(params: any) {
    const {
        page = 1,
        pageSize = 10,
        status,
        dateRange,
        mediaAccountId,
        taskNumber
    } = params

    // 构建特定于充值工单的查询条件
    const whereClause: any = {
        isDeleted: false,
        workOrderType: 'ACCOUNT_MANAGEMENT',
        workOrderSubtype: 'DEPOSIT'
    }

    // 处理其他条件
    if (status) {
        whereClause.status = status
    }

    if (mediaAccountId) {
        whereClause.mediaAccountId = mediaAccountId
    }

    if (taskNumber) {
        whereClause.taskNumber = taskNumber
    }

    if (dateRange && dateRange.start && dateRange.end) {
        whereClause.createdAt = {
            gte: dateRange.start,
            lte: dateRange.end
        }
    }

    // 查询结果
    const total = await db.tecdo_work_orders.count({ where: whereClause })
    const workOrders = await db.tecdo_work_orders.findMany({
        where: whereClause,
        include: {
            tecdo_deposit_business_data: true
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
    })

    // 格式化结果
    const formattedResults = workOrders.map((order) => {
        const businessData = order.tecdo_deposit_business_data
        const metadata = (order.metadata as Record<string, any>) || {}

        return {
            id: order.id,
            taskId: order.taskId,
            workOrderType: 'DEPOSIT',
            mediaAccountId: order.mediaAccountId || '',
            mediaAccountName: metadata.mediaAccountName || '',
            mediaPlatform: metadata.mediaPlatform || 0,
            amount: businessData?.amount || metadata.amount,
            dailyBudget: businessData?.dailyBudget || metadata.dailyBudget,
            currency: businessData?.currency || 'USD',
            status: order.status,
            remarks: order.remark,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            failureReason: businessData?.failureReason
        }
    })

    return {
        success: true,
        data: {
            items: formattedResults,
            total
        }
    }
}
