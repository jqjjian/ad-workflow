'use server'

import { revalidatePath } from 'next/cache'
import { WorkOrderStatus } from './types'
import { v4 as uuidv4 } from 'uuid'
import { auth } from '@/auth'

interface DepositWorkOrderParams {
    mediaAccountId: string
    mediaAccountName: string
    mediaPlatform: number
    companyName: string
    amount: number
    remarks?: string
}

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
            !params.mediaPlatform ||
            !params.amount
        ) {
            return {
                success: false,
                message: '参数不完整'
            }
        }

        // 生成工单ID
        const workOrderId = `DEP-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        const userId = session.user.id || 'unknown'
        const username = session.user.name || 'unknown'

        // 保存到数据库
        // 这里替换为实际的数据库操作
        // const result = await db.workOrders.create({
        //     id: uuidv4(),
        //     workOrderId,
        //     workOrderType: 'DEPOSIT',
        //     mediaAccountId: params.mediaAccountId,
        //     mediaAccountName: params.mediaAccountName,
        //     mediaPlatform: params.mediaPlatform,
        //     companyName: params.companyName,
        //     amount: params.amount,
        //     systemStatus: 'PENDING',
        //     createdAt: new Date(),
        //     createdBy: userId,
        //     updatedAt: new Date(),
        //     updatedBy: userId,
        //     remarks: params.remarks || '',
        //     workOrderParams: params
        // })

        // 添加工单日志
        // await db.workOrderLogs.create({
        //     id: uuidv4(),
        //     workOrderId,
        //     timestamp: new Date(),
        //     action: '创建工单',
        //     operator: username,
        //     details: `创建了充值工单，金额：${params.amount}`
        // })

        // 如果成功，刷新相关页面
        revalidatePath('/account/manage')
        revalidatePath('/account/workorders')

        return {
            success: true,
            message: '充值工单创建成功',
            data: { workOrderId }
        }
    } catch (error) {
        console.error('创建充值工单出错:', error)
        return {
            success: false,
            message: '创建充值工单失败'
        }
    }
}

/**
 * 修改充值工单
 * @param workOrderId 工单ID
 * @param params 修改参数
 * @returns 操作结果
 */
export async function updateDepositWorkOrder(
    workOrderId: string,
    params: Partial<DepositWorkOrderParams>
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
        // const workOrder = await db.workOrders.findUnique({
        //     where: { workOrderId }
        // })

        // 模拟工单数据
        const workOrder = {
            workOrderId,
            systemStatus: 'PENDING' as WorkOrderStatus
        }

        // 验证工单是否存在且状态为待处理
        if (!workOrder || workOrder.systemStatus !== 'PENDING') {
            return {
                success: false,
                message: '工单不存在或状态非待处理，无法修改'
            }
        }

        const userId = session.user.id || 'unknown'
        const username = session.user.name || 'unknown'

        // 更新工单
        // await db.workOrders.update({
        //     where: { workOrderId },
        //     data: {
        //         ...params,
        //         updatedAt: new Date(),
        //         updatedBy: userId
        //     }
        // })

        // 添加工单日志
        // await db.workOrderLogs.create({
        //     id: uuidv4(),
        //     workOrderId,
        //     timestamp: new Date(),
        //     action: '修改工单',
        //     operator: username,
        //     details: `修改了充值工单，新金额：${params.amount}`
        // })

        // 刷新相关页面
        revalidatePath('/account/manage')
        revalidatePath('/account/workorders')

        return {
            success: true,
            message: '充值工单修改成功'
        }
    } catch (error) {
        console.error('修改充值工单出错:', error)
        return {
            success: false,
            message: '修改充值工单失败'
        }
    }
}

/**
 * 提交充值工单到第三方接口
 * @param workOrderId 工单ID
 * @returns 操作结果
 */
export async function submitDepositWorkOrderToThirdParty(
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

        // 查询工单详情
        // const workOrder = await db.workOrders.findUnique({
        //     where: { workOrderId }
        // })

        // 模拟工单数据
        const workOrder = {
            workOrderId,
            systemStatus: 'PENDING' as WorkOrderStatus,
            mediaPlatform: 1,
            mediaAccountId: 'acc-123',
            amount: 1000
        }

        // 验证工单是否存在且状态为待处理
        if (!workOrder || workOrder.systemStatus !== 'PENDING') {
            return {
                success: false,
                message: '工单不存在或状态非待处理，无法提交'
            }
        }

        const userId = session.user.id || 'unknown'
        const username = session.user.name || 'unknown'

        // 根据媒体平台选择不同的第三方API
        let thirdPartyResponse
        switch (workOrder.mediaPlatform) {
            case 1: // Facebook
                // thirdPartyResponse = await callFacebookDepositAPI(workOrder.mediaAccountId, workOrder.amount)
                thirdPartyResponse = {
                    success: true,
                    transactionId: 'fb-trans-123'
                }
                break
            case 2: // Google
                // thirdPartyResponse = await callGoogleDepositAPI(workOrder.mediaAccountId, workOrder.amount)
                thirdPartyResponse = {
                    success: true,
                    transactionId: 'google-trans-123'
                }
                break
            case 5: // TikTok
                // thirdPartyResponse = await callTiktokDepositAPI(workOrder.mediaAccountId, workOrder.amount)
                thirdPartyResponse = {
                    success: true,
                    transactionId: 'tiktok-trans-123'
                }
                break
            default:
                return {
                    success: false,
                    message: '不支持的媒体平台'
                }
        }

        // 更新工单状态
        // await db.workOrders.update({
        //     where: { workOrderId },
        //     data: {
        //         systemStatus: thirdPartyResponse.success ? 'PROCESSING' : 'FAILED',
        //         thirdPartyStatus: thirdPartyResponse.success ? 'PROCESSING' : 'FAILED',
        //         updatedAt: new Date(),
        //         updatedBy: userId,
        //         thirdPartyResponse: JSON.stringify(thirdPartyResponse)
        //     }
        // })

        // 添加工单日志
        // await db.workOrderLogs.create({
        //     id: uuidv4(),
        //     workOrderId,
        //     timestamp: new Date(),
        //     action: thirdPartyResponse.success ? '提交第三方成功' : '提交第三方失败',
        //     operator: username,
        //     details: `提交给第三方平台${thirdPartyResponse.success ? '成功' : '失败'}，交易ID：${thirdPartyResponse.transactionId || '无'}`
        // })

        // 刷新相关页面
        revalidatePath('/account/manage')
        revalidatePath('/account/workorders')

        return {
            success: thirdPartyResponse.success,
            message: thirdPartyResponse.success
                ? '工单已成功提交给第三方平台'
                : '工单提交第三方平台失败',
            thirdPartyResponse
        }
    } catch (error) {
        console.error('提交充值工单到第三方接口出错:', error)
        return {
            success: false,
            message: '提交充值工单到第三方接口失败'
        }
    }
}
