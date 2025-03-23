'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { WorkOrderStatus } from './types'

interface AccountNameUpdateWorkOrderParams {
    mediaAccountId: string
    mediaAccountName: string
    mediaPlatform: number
    companyName: string
    newAccountName: string
    remarks?: string
}

// 定义模拟工单类型
interface MockWorkOrder {
    workOrderId: string
    systemStatus: WorkOrderStatus
    mediaPlatform: number
    mediaAccountId: string
    mediaAccountName: string
    workOrderParams: {
        newAccountName: string
        [key: string]: any
    }
}

/**
 * 创建账户名修改工单
 * @param params 账户名修改工单参数
 * @returns 操作结果
 */
export async function updateAccountNameWorkOrder(
    params: AccountNameUpdateWorkOrderParams
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
            !params.newAccountName
        ) {
            return {
                success: false,
                message: '参数不完整'
            }
        }

        // 检查新账户名是否与旧账户名相同
        if (params.mediaAccountName === params.newAccountName) {
            return {
                success: false,
                message: '新账户名与当前账户名相同'
            }
        }

        // 生成工单ID
        const workOrderId = `ACCNAME-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        const userId = session.user.id || 'unknown'
        const username = session.user.name || 'unknown'

        // 保存到数据库
        // 这里替换为实际的数据库操作，与充值工单类似，不再重复示例代码

        // 如果成功，刷新相关页面
        revalidatePath('/account/manage')
        revalidatePath('/account/workorders')

        return {
            success: true,
            message: '账户名修改工单创建成功',
            data: { workOrderId }
        }
    } catch (error) {
        console.error('创建账户名修改工单出错:', error)
        return {
            success: false,
            message: '创建账户名修改工单失败'
        }
    }
}

/**
 * 修改账户名修改工单
 * @param workOrderId 工单ID
 * @param params 修改参数
 * @returns 操作结果
 */
export async function updateAccountNameUpdateWorkOrder(
    workOrderId: string,
    params: Partial<AccountNameUpdateWorkOrderParams>
): Promise<{
    success: boolean
    message?: string
}> {
    // 修改逻辑与其他工单类似
    return {
        success: true,
        message: '账户名修改工单更新成功'
    }
}

/**
 * 提交账户名修改工单到第三方接口
 * @param workOrderId 工单ID
 * @returns 操作结果
 */
export async function submitAccountNameUpdateWorkOrderToThirdParty(
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

        // 模拟工单数据，明确类型
        const workOrder: MockWorkOrder = {
            workOrderId,
            systemStatus: WorkOrderStatus.PENDING,
            mediaPlatform: 1,
            mediaAccountId: 'acc-123',
            mediaAccountName: '旧账户名',
            workOrderParams: {
                newAccountName: '新账户名'
            }
        }

        // 验证工单是否存在且状态为待处理
        if (!workOrder || workOrder.systemStatus !== WorkOrderStatus.PENDING) {
            return {
                success: false,
                message: '工单不存在或状态非待处理，无法提交'
            }
        }

        const userId = session.user.id || 'unknown'
        const username = session.user.name || 'unknown'

        // 根据媒体平台选择不同的第三方API
        let thirdPartyResponse: { success: boolean; operationId?: string } = {
            success: false
        }
        const { newAccountName } = workOrder.workOrderParams

        switch (workOrder.mediaPlatform) {
            case 1: // Facebook
                // thirdPartyResponse = await callFacebookUpdateAccountNameAPI(workOrder.mediaAccountId, newAccountName)
                thirdPartyResponse = {
                    success: true,
                    operationId: 'fb-rename-123'
                }
                break
            case 2: // Google
                // thirdPartyResponse = await callGoogleUpdateAccountNameAPI(workOrder.mediaAccountId, newAccountName)
                thirdPartyResponse = {
                    success: true,
                    operationId: 'google-rename-123'
                }
                break
            case 5: // TikTok
                // thirdPartyResponse = await callTiktokUpdateAccountNameAPI(workOrder.mediaAccountId, newAccountName)
                thirdPartyResponse = {
                    success: true,
                    operationId: 'tiktok-rename-123'
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
        //         systemStatus: thirdPartyResponse.success ? WorkOrderStatus.PROCESSING : WorkOrderStatus.FAILED,
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
        //     details: `账户名修改提交给第三方平台${thirdPartyResponse.success ? '成功' : '失败'}，操作ID：${thirdPartyResponse.operationId || '无'}`
        // })

        // 刷新相关页面
        revalidatePath('/account/manage')
        revalidatePath('/account/workorders')

        return {
            success: thirdPartyResponse.success,
            message: thirdPartyResponse.success
                ? '账户名修改工单已成功提交给第三方平台'
                : '账户名修改工单提交第三方平台失败',
            thirdPartyResponse
        }
    } catch (error) {
        console.error('提交账户名修改工单到第三方接口出错:', error)
        return {
            success: false,
            message: '提交账户名修改工单到第三方接口失败'
        }
    }
}
