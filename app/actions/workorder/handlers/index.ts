'use server'

// 导入各平台的API处理器
import {
    processFacebookDeposit,
    processFacebookWithdrawal,
    processFacebookZeroing,
    processFacebookTransfer,
    processFacebookAccountBinding,
    processFacebookEmailBinding,
    processFacebookPixelBinding,
    processFacebookAccountNameUpdate
} from './facebook-handler'

import {
    processGoogleDeposit,
    processGoogleWithdrawal,
    processGoogleZeroing,
    processGoogleTransfer,
    processGoogleAccountBinding,
    processGoogleEmailBinding,
    processGoogleAccountNameUpdate
} from './google-handler'

import {
    processTiktokDeposit,
    processTiktokWithdrawal,
    processTiktokZeroing,
    processTiktokTransfer,
    processTiktokAccountBinding,
    processTiktokEmailBinding,
    processTiktokAccountNameUpdate
} from './tiktok-handler'

// 定义统一API处理器结构
interface ApiHandler {
    (params: any): Promise<{
        success: boolean
        operationId?: string
        message?: string
        data?: any
    }>
}

// 创建处理器映射表
const API_HANDLERS: Record<number, Record<string, ApiHandler>> = {
    // Facebook (Platform ID: 1)
    1: {
        DEPOSIT: processFacebookDeposit,
        WITHDRAWAL: processFacebookWithdrawal,
        ZEROING: processFacebookZeroing,
        TRANSFER: processFacebookTransfer,
        ACCOUNT_BINDING: processFacebookAccountBinding,
        EMAIL_BINDING: processFacebookEmailBinding,
        PIXEL_BINDING: processFacebookPixelBinding,
        ACCOUNT_NAME_UPDATE: processFacebookAccountNameUpdate
    },
    // Google (Platform ID: 2)
    2: {
        DEPOSIT: processGoogleDeposit,
        WITHDRAWAL: processGoogleWithdrawal,
        ZEROING: processGoogleZeroing,
        TRANSFER: processGoogleTransfer,
        ACCOUNT_BINDING: processGoogleAccountBinding,
        EMAIL_BINDING: processGoogleEmailBinding,
        ACCOUNT_NAME_UPDATE: processGoogleAccountNameUpdate
    },
    // TikTok (Platform ID: 5)
    5: {
        DEPOSIT: processTiktokDeposit,
        WITHDRAWAL: processTiktokWithdrawal,
        ZEROING: processTiktokZeroing,
        TRANSFER: processTiktokTransfer,
        ACCOUNT_BINDING: processTiktokAccountBinding,
        EMAIL_BINDING: processTiktokEmailBinding,
        ACCOUNT_NAME_UPDATE: processTiktokAccountNameUpdate
    }
}

/**
 * 调用第三方API的通用处理器
 * @param mediaPlatform 媒体平台ID
 * @param workOrderType 工单类型
 * @param params API参数
 * @returns API调用结果
 */
export async function callThirdPartyApi(
    mediaPlatform: number,
    workOrderType: string,
    params: any
): Promise<{
    success: boolean
    operationId?: string
    message?: string
    data?: any
}> {
    try {
        // 检查平台和工单类型是否支持
        if (!API_HANDLERS[mediaPlatform]) {
            return {
                success: false,
                message: `不支持的媒体平台: ${mediaPlatform}`
            }
        }

        const platformHandlers = API_HANDLERS[mediaPlatform]
        if (!platformHandlers[workOrderType]) {
            return {
                success: false,
                message: `媒体平台 ${mediaPlatform} 不支持工单类型: ${workOrderType}`
            }
        }

        // 调用对应的处理器
        const handler = platformHandlers[workOrderType]
        return await handler(params)
    } catch (error) {
        console.error('调用第三方API出错:', error)
        return {
            success: false,
            message: '调用第三方API时发生错误'
        }
    }
}
