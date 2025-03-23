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
        const taskId = uuidv4()
        const taskNumber = generateTaskNumber(
            WorkOrderType.ACCOUNT_MANAGEMENT,
            WorkOrderSubtype.ZEROING
        )

        // 创建清零工单记录
        const workOrder = await db.tecdo_work_orders.create({
            data: {
                id: uuidv4(),
                taskId: taskId,
                taskNumber: taskNumber,
                userId: userId,
                workOrderType: WorkOrderType.ACCOUNT_MANAGEMENT,
                workOrderSubtype: WorkOrderSubtype.ZEROING,
                status: WorkOrderStatus.PENDING,
                mediaAccountId: params.mediaAccountId,
                metadata: {
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
        if (workOrder.workOrderSubtype !== WorkOrderSubtype.ZEROING) {
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
        if (workOrder.workOrderSubtype !== WorkOrderSubtype.ZEROING) {
            return {
                success: false,
                message: '非清零工单不能执行此操作'
            }
        }

        // 验证工单状态，只有待处理的工单才能提交
        if (workOrder.status !== WorkOrderStatus.PENDING) {
            return {
                success: false,
                message: '只有待处理的工单可以提交'
            }
        }

        // 检查是否有对应的清零业务数据
        if (!workOrder.tecdo_zeroing_business_data) {
            return {
                success: false,
                message: '未找到清零业务数据'
            }
        }

        // 检查是否有对应的媒体账户
        if (!workOrder.tecdo_media_accounts) {
            return {
                success: false,
                message: '未找到对应的媒体账户'
            }
        }

        const mediaPlatform = workOrder.tecdo_media_accounts.mediaPlatform
        let thirdPartyResponse

        // 更新工单状态为处理中
        await db.tecdo_work_orders.update({
            where: { id: workOrderId },
            data: {
                status: WorkOrderStatus.PROCESSING,
                processingTime: new Date()
            }
        })

        // 更新清零业务数据状态
        await db.tecdo_zeroing_business_data.update({
            where: { id: workOrder.tecdo_zeroing_business_data.id },
            data: {
                zeroingStatus: 'PROCESSING',
                zeroingTime: new Date()
            }
        })

        // 根据媒体平台调用不同的第三方API
        // 这里是模拟调用，实际项目中应该根据不同平台实现真实的API调用
        switch (mediaPlatform) {
            case 'FACEBOOK':
                // 调用Facebook平台API
                thirdPartyResponse = {
                    success: true,
                    code: 200,
                    data: {
                        taskId: `FB-ZERO-${Date.now()}`,
                        status: 'PROCESSING'
                    }
                }
                break

            case 'GOOGLE':
                // 调用Google平台API
                thirdPartyResponse = {
                    success: true,
                    code: 200,
                    data: {
                        taskId: `GG-ZERO-${Date.now()}`,
                        status: 'PROCESSING'
                    }
                }
                break

            case 'TIKTOK':
                // 调用TikTok平台API
                thirdPartyResponse = {
                    success: true,
                    code: 200,
                    data: {
                        taskId: `TT-ZERO-${Date.now()}`,
                        status: 'PROCESSING'
                    }
                }
                break

            case 'MICROSOFT_ADVERTISING':
                // 调用Microsoft广告平台API
                thirdPartyResponse = {
                    success: true,
                    code: 200,
                    data: {
                        taskId: `MS-ZERO-${Date.now()}`,
                        status: 'PROCESSING'
                    }
                }
                break

            default:
                return {
                    success: false,
                    message: `不支持的媒体平台: ${mediaPlatform}`
                }
        }

        // 记录第三方任务ID
        if (thirdPartyResponse.success) {
            const taskId = thirdPartyResponse.data.taskId
            const taskNumber = `ZERO-${Date.now()}`

            // 创建第三方任务记录
            await db.tecdo_third_party_tasks.create({
                data: {
                    taskId: taskId,
                    taskNumber: taskNumber,
                    status: WorkOrderStatus.PROCESSING,
                    userId: session.user.id,
                    typeId: 1, // 假设1代表清零操作
                    workOrderType: WorkOrderType.ACCOUNT_MANAGEMENT,
                    workOrderSubtype: WorkOrderSubtype.ZEROING,
                    updatedAt: new Date(),
                    rawData: JSON.stringify({
                        mediaAccountId: workOrder.mediaAccountId,
                        action: 'ZEROING'
                    }),
                    rawResponse: JSON.stringify(thirdPartyResponse)
                }
            })

            // 更新工单的第三方任务ID
            await db.tecdo_work_orders.update({
                where: { id: workOrderId },
                data: {
                    thirdPartyTaskId: taskId
                }
            })
        }

        // 添加审计日志
        await db.tecdo_audit_logs.create({
            data: {
                id: uuidv4(),
                entityType: 'WORK_ORDER',
                entityId: workOrderId,
                action: '提交清零工单到第三方',
                performedBy: session.user.id,
                newValue: JSON.stringify(thirdPartyResponse),
                createdAt: new Date()
            }
        })

        // 刷新相关页面
        revalidatePath('/account/manage')
        revalidatePath('/account/record')

        return {
            success: true,
            message: '工单已成功提交给第三方平台',
            thirdPartyResponse
        }
    } catch (error) {
        console.error('提交清零工单到第三方失败:', error)
        return {
            success: false,
            message: `提交失败: ${error instanceof Error ? error.message : String(error)}`
        }
    }
}
