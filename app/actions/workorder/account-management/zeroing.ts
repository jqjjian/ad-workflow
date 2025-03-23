'use server'

import { revalidatePath } from 'next/cache'
import { WorkOrderStatus } from '@/schemas/workorder/query'
import { v4 as uuidv4 } from 'uuid'
import { getServerSession } from 'next-auth'

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
        const session = await getServerSession()
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

        // 生成工单ID
        const workOrderId = `ZER-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        const userId = session.user.id || 'unknown'
        const username = session.user.name || 'unknown'

        // 保存到数据库
        // 这里替换为实际的数据库操作，与充值工单类似，不再重复示例代码

        // 如果成功，刷新相关页面
        revalidatePath('/account/manage')
        revalidatePath('/account/workorders')

        return {
            success: true,
            message: '清零工单创建成功',
            data: { workOrderId }
        }
    } catch (error) {
        console.error('创建清零工单出错:', error)
        return {
            success: false,
            message: '创建清零工单失败'
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
    // 修改逻辑与其他工单类似
    return {
        success: true,
        message: '清零工单修改成功'
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
    // 提交逻辑与其他工单类似，根据媒体平台调用不同API
    return {
        success: true,
        message: '工单已成功提交给第三方平台',
        thirdPartyResponse: { success: true, transactionId: 'zero-trans-123' }
    }
}
