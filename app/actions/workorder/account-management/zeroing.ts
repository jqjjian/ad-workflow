'use server'

import { revalidatePath } from 'next/cache'
import { v4 as uuidv4 } from 'uuid'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { generateTaskNumber } from '@/lib/utils'
import { API_BASE_URL, callExternalApi } from '@/lib/request'
import { WorkOrderStatus } from './types'
import { UserRole, WorkOrderSubtype, WorkOrderType } from '@prisma/client'

interface ZeroingWorkOrderParams {
    mediaAccountId: string
    mediaAccountName: string
    mediaPlatform: number
    companyName: string
    remarks?: string
}

/**
 * 创建清零工单
 * @param params 清零工单参数
 * @returns 操作结果
 */
export async function createZeroingWorkOrder(
    params: ZeroingWorkOrderParams
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

        // 参数验证
        if (
            !params.mediaAccountId ||
            !params.mediaAccountName ||
            !params.mediaPlatform
        ) {
            return {
                success: false,
                message: '参数不完整'
            }
        }

        const userId = session.user.id || 'unknown'
        const username = session.user.name || 'unknown'
        const now = new Date()

        // 生成工单号
        const workOrderId = `ZER-${uuidv4()}`
        const taskNumber = generateTaskNumber('ACCOUNT_MANAGEMENT', 'ZEROING')

        // 创建清零工单记录
        const workOrder = await db.tecdo_work_orders.create({
            data: {
                id: workOrderId,
                taskId: taskNumber,
                taskNumber: taskNumber,
                userId: userId,
                workOrderType: WorkOrderType.ACCOUNT_MANAGEMENT,
                workOrderSubtype: WorkOrderSubtype.ZEROING,
                status: WorkOrderStatus.PENDING,
                mediaAccountId: params.mediaAccountId,
                metadata: {
                    taskNumber: taskNumber,
                    mediaAccountName: params.mediaAccountName,
                    mediaPlatform: params.mediaPlatform,
                    companyName: params.companyName
                },
                remark: params.remarks || null,
                priority: 0,
                createdAt: now,
                updatedAt: now,
                isDeleted: false
            }
        })

        // 添加工单日志
        await db.tecdo_audit_logs.create({
            data: {
                id: uuidv4(),
                entityType: 'WORK_ORDER',
                entityId: workOrder.id,
                action: '创建清零工单',
                performedBy: userId,
                newValue: JSON.stringify({
                    mediaAccountId: params.mediaAccountId,
                    mediaAccountName: params.mediaAccountName,
                    mediaPlatform: params.mediaPlatform
                }),
                createdAt: now
            }
        })

        // 创建清零业务数据记录
        await db.tecdo_zeroing_business_data.create({
            data: {
                id: uuidv4(),
                workOrderId: workOrder.id,
                mediaAccountId: params.mediaAccountId,
                mediaPlatform: String(params.mediaPlatform),
                zeroingStatus: 'PENDING',
                createdAt: now,
                updatedAt: now,
                isDeleted: false
            }
        })

        // 刷新相关页面
        revalidatePath('/account/manage')
        revalidatePath('/account/record')

        return {
            success: true,
            message: '清零工单创建成功',
            data: { workOrderId: workOrder.id }
        }
    } catch (error) {
        console.error('创建清零工单出错:', error)
        return {
            success: false,
            message: `创建清零工单失败: ${error instanceof Error ? error.message : String(error)}`
        }
    }
}

/**
 * 修改清零工单
 * @param workOrderId 工单ID
 * @param params 修改参数
 * @returns 操作结果
 */
export async function updateZeroingWorkOrder(
    workOrderId: string,
    params: Partial<ZeroingWorkOrderParams>
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

        // 查询工单
        const workOrder = await db.tecdo_work_orders.findUnique({
            where: { id: workOrderId }
        })

        if (!workOrder) {
            return {
                success: false,
                message: '工单不存在'
            }
        }

        // 验证工单类型
        if (workOrder.workOrderSubtype !== 'ZEROING') {
            return {
                success: false,
                message: '非清零工单不能执行此操作'
            }
        }

        // 验证工单状态，只有待处理的工单才能修改
        if (workOrder.status !== WorkOrderStatus.PENDING) {
            return {
                success: false,
                message: '只有待处理的工单可以修改'
            }
        }

        const userId = session.user.id

        // 更新工单
        await db.tecdo_work_orders.update({
            where: { id: workOrderId },
            data: {
                remark: params.remarks || workOrder.remark,
                updatedAt: new Date()
            }
        })

        // 添加审计日志
        await db.tecdo_audit_logs.create({
            data: {
                id: uuidv4(),
                entityType: 'WORK_ORDER',
                entityId: workOrderId,
                action: '修改清零工单',
                performedBy: userId,
                previousValue: JSON.stringify({
                    remarks: workOrder.remark
                }),
                newValue: JSON.stringify({
                    remarks: params.remarks || workOrder.remark
                }),
                createdAt: new Date()
            }
        })

        return {
            success: true,
            message: '清零工单修改成功'
        }
    } catch (error) {
        console.error('修改清零工单失败:', error)
        return {
            success: false,
            message: `修改清零工单失败: ${error instanceof Error ? error.message : String(error)}`
        }
    }
}

/**
 * 提交清零工单到第三方接口
 * @param workOrderId 工单ID
 * @returns 操作结果
 */
export async function submitZeroingWorkOrderToThirdParty(
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

        // 查询工单
        const workOrder = await db.tecdo_work_orders.findUnique({
            where: { id: workOrderId },
            include: {
                tecdo_zeroing_business_data: true,
                tecdo_media_accounts: true
            }
        })

        if (!workOrder) {
            return {
                success: false,
                message: '工单不存在'
            }
        }

        // 验证工单类型
        if (workOrder.workOrderSubtype !== 'ZEROING') {
            return {
                success: false,
                message: '非清零工单不能执行此操作'
            }
        }

        // 验证工单状态，现在检查是否为PROCESSING状态
        if (workOrder.status !== WorkOrderStatus.PROCESSING) {
            return {
                success: false,
                message: '只有处理中状态的工单可以提交到第三方'
            }
        }

        // 检查是否有对应的清零业务数据
        if (!workOrder.tecdo_zeroing_business_data) {
            console.error(`工单ID ${workOrderId} 没有关联的业务数据记录`)

            // 尝试创建业务数据
            try {
                const metadata = (workOrder.metadata as any) || {}
                await db.tecdo_zeroing_business_data.create({
                    data: {
                        id: uuidv4(),
                        workOrderId: workOrderId,
                        mediaAccountId: workOrder.mediaAccountId || '',
                        mediaPlatform: String(metadata.mediaPlatform || 1),
                        zeroingStatus: 'PROCESSING',
                        zeroingTime: new Date(),
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        isDeleted: false
                    }
                })
                console.log(`已为工单 ${workOrderId} 创建业务数据记录`)
            } catch (err) {
                console.error('创建业务数据失败:', err)
                return {
                    success: false,
                    message: '创建业务数据失败，无法继续处理'
                }
            }
        }

        const mediaPlatform =
            workOrder.tecdo_media_accounts?.mediaPlatform ||
            (workOrder.metadata as any)?.mediaPlatform ||
            'UNKNOWN'

        const userId = session.user.id
        const username = session.user.name || 'unknown'
        let thirdPartyResponse

        // 构造请求参数
        const requestBody = {
            mediaAccountId: workOrder.mediaAccountId,
            mediaPlatform: mediaPlatform,
            taskNumber: workOrder.taskNumber
        }

        console.log('向第三方API提交清零申请:', requestBody)

        // 调用第三方API
        try {
            // 实际项目中调用真实API
            thirdPartyResponse = await callExternalApi({
                url: `${API_BASE_URL}/openApi/v1/mediaAccount/clearApplication/create`,
                body: requestBody
            })

            console.log('API调用结果:', thirdPartyResponse)

            // 处理API返回结果
            if (thirdPartyResponse.code === '0') {
                const thirdPartyTaskId = (
                    thirdPartyResponse.data as { taskId?: string }
                )?.taskId

                // 更新工单状态
                await db.tecdo_work_orders.update({
                    where: { id: workOrderId },
                    data: {
                        thirdPartyTaskId: thirdPartyTaskId,
                        metadata: {
                            ...((workOrder.metadata as Record<string, any>) ||
                                {}),
                            thirdPartyResponse:
                                JSON.stringify(thirdPartyResponse)
                        },
                        updatedAt: new Date()
                    }
                })

                // 更新业务数据状态
                const businessData =
                    await db.tecdo_zeroing_business_data.findUnique({
                        where: { workOrderId: workOrderId }
                    })

                if (businessData) {
                    await db.tecdo_zeroing_business_data.update({
                        where: { id: businessData.id },
                        data: {
                            zeroingStatus: 'PROCESSING',
                            updatedAt: new Date()
                        }
                    })
                }

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
                            response: thirdPartyResponse
                        }),
                        createdAt: new Date()
                    }
                })

                return {
                    success: true,
                    message: thirdPartyResponse.message || '清零申请提交成功',
                    thirdPartyResponse
                }
            } else {
                // 更新工单状态为失败
                await db.tecdo_work_orders.update({
                    where: { id: workOrderId },
                    data: {
                        status: 'FAILED',
                        updatedAt: new Date(),
                        remark:
                            thirdPartyResponse.message || '第三方平台返回错误',
                        metadata: {
                            ...((workOrder.metadata as Record<string, any>) ||
                                {}),
                            error: thirdPartyResponse.message,
                            thirdPartyResponse:
                                JSON.stringify(thirdPartyResponse)
                        }
                    }
                })

                // 更新业务数据状态
                const businessData =
                    await db.tecdo_zeroing_business_data.findUnique({
                        where: { workOrderId: workOrderId }
                    })

                if (businessData) {
                    await db.tecdo_zeroing_business_data.update({
                        where: { id: businessData.id },
                        data: {
                            zeroingStatus: 'FAILED',
                            failureReason:
                                thirdPartyResponse.message ||
                                '第三方平台返回错误',
                            updatedAt: new Date()
                        }
                    })
                }

                // 添加工单日志
                await db.tecdo_audit_logs.create({
                    data: {
                        id: uuidv4(),
                        entityType: 'WORK_ORDER',
                        entityId: workOrderId,
                        action: '提交失败',
                        performedBy: username,
                        newValue: JSON.stringify({
                            error: thirdPartyResponse.message,
                            response: thirdPartyResponse
                        }),
                        createdAt: new Date()
                    }
                })

                return {
                    success: false,
                    message: `API返回错误: ${thirdPartyResponse.message}`,
                    thirdPartyResponse
                }
            }
        } catch (apiError) {
            console.error('API调用失败:', apiError)

            const errorMessage =
                apiError instanceof Error ? apiError.message : '未知错误'

            // 更新工单状态为失败
            await db.tecdo_work_orders.update({
                where: { id: workOrderId },
                data: {
                    status: 'FAILED',
                    updatedAt: new Date(),
                    remark: `API调用失败: ${errorMessage}`,
                    metadata: {
                        ...((workOrder.metadata as Record<string, any>) || {}),
                        error: errorMessage
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
                        error: errorMessage
                    }),
                    createdAt: new Date()
                }
            })

            return {
                success: false,
                message: `API调用失败: ${errorMessage}`
            }
        }
    } catch (error) {
        console.error('提交清零工单到第三方接口出错:', error)
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : '提交清零工单到第三方接口失败'
        }
    }
}

/**
 * 管理员审批清零工单
 * @param params 审批参数
 * @returns 操作结果
 */
export async function approveZeroingWorkOrder(params: {
    workOrderId: string
    remarks?: string
}): Promise<{
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

        // 验证是否为管理员 - 可根据需要启用
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
            where: { id: params.workOrderId },
            include: { tecdo_zeroing_business_data: true }
        })

        // 验证工单是否存在
        if (!workOrder) {
            return {
                success: false,
                message: '工单不存在'
            }
        }

        // 验证工单状态
        if (workOrder.status !== WorkOrderStatus.PENDING) {
            return {
                success: false,
                message: '只能审批待处理状态的工单'
            }
        }

        // 验证工单类型
        if (workOrder.workOrderSubtype !== 'ZEROING') {
            return {
                success: false,
                message: '非清零工单，无法进行此操作'
            }
        }

        const username = session.user.name || 'unknown'
        const now = new Date()

        // 更新工单状态为处理中
        await db.tecdo_work_orders.update({
            where: { id: params.workOrderId },
            data: {
                status: WorkOrderStatus.PROCESSING,
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
                    status: WorkOrderStatus.PROCESSING,
                    remarks: params.remarks
                }),
                createdAt: now
            }
        })

        // 调用第三方接口提交清零申请
        console.log('正在向第三方提交清零申请...')
        const thirdPartyResult = await submitZeroingWorkOrderToThirdParty(
            params.workOrderId
        )

        if (!thirdPartyResult.success) {
            console.error('向第三方提交清零申请失败:', thirdPartyResult.message)

            // 添加失败日志
            await db.tecdo_audit_logs.create({
                data: {
                    id: uuidv4(),
                    entityType: 'WORK_ORDER',
                    entityId: params.workOrderId,
                    action: '调用第三方API失败',
                    performedBy: username,
                    previousValue: JSON.stringify({
                        status: WorkOrderStatus.PROCESSING
                    }),
                    newValue: JSON.stringify({
                        apiError: thirdPartyResult.message
                    }),
                    createdAt: new Date()
                }
            })

            return {
                success: true,
                message: `工单审批成功，但向第三方提交清零申请失败: ${thirdPartyResult.message}`,
                data: {
                    workOrderId: params.workOrderId
                }
            }
        }

        console.log('向第三方提交清零申请成功:', thirdPartyResult)

        // 提取第三方任务ID
        let thirdPartyTaskId = undefined
        if (thirdPartyResult.thirdPartyResponse?.data?.taskId) {
            thirdPartyTaskId = thirdPartyResult.thirdPartyResponse.data.taskId
        }

        // 刷新相关页面
        revalidatePath('/admin/workorders')
        revalidatePath('/account/manage')
        revalidatePath('/account/applications')

        return {
            success: true,
            message: '清零工单审批并提交第三方接口成功',
            data: {
                workOrderId: params.workOrderId,
                thirdPartyTaskId: thirdPartyTaskId
            }
        }
    } catch (error) {
        console.error('审批清零工单出错:', error)
        return {
            success: false,
            message: error instanceof Error ? error.message : '工单审批失败'
        }
    }
}

/**
 * 拒绝清零工单
 * @param params 拒绝参数
 * @returns 操作结果
 */
export async function rejectZeroingWorkOrder(params: {
    workOrderId: string
    reason: string
}): Promise<{
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
        // if (
        //     session.user.role !== UserRole.ADMIN &&
        //     session.user.role !== UserRole.SUPER_ADMIN
        // ) {
        //     return {
        //         success: false,
        //         message: '无权操作，仅管理员可拒绝工单'
        //     }
        // }

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
        if (workOrder.status !== WorkOrderStatus.PENDING) {
            return {
                success: false,
                message: '只能拒绝待处理状态的工单'
            }
        }

        // 验证工单类型
        if (workOrder.workOrderSubtype !== 'ZEROING') {
            return {
                success: false,
                message: '非清零工单，无法进行此操作'
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
        revalidatePath('/account/manage')
        revalidatePath('/account/applications')

        return {
            success: true,
            message: '清零工单已拒绝',
            data: {
                workOrderId: params.workOrderId
            }
        }
    } catch (error) {
        console.error('拒绝清零工单出错:', error)
        return {
            success: false,
            message: error instanceof Error ? error.message : '拒绝工单失败'
        }
    }
}
