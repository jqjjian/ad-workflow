import { WorkOrderType, WorkOrderSubtype } from '../schemas/enums'
import { v4 as uuidv4 } from 'uuid'

export const generateTicketId = (prefix: string = 'TK') => {
    // const prefix = 'TK'
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const random = Math.random().toString(36).slice(2, 6).toUpperCase()
    return `${prefix}${date}-${random}`
}

export const formatCurrency = (amount: number) => {
    return amount.toFixed(2)
}

export function generateTaskNumber(
    taskType?: WorkOrderType,
    taskSubtype?: WorkOrderSubtype
): string {
    // 主类型前缀
    let mainPrefix = 'WO'
    if (taskType) {
        switch (taskType) {
            case 'ACCOUNT_APPLICATION':
                mainPrefix = 'AA'
                break
            case 'ACCOUNT_MANAGEMENT':
                mainPrefix = 'AM'
                break
            case 'ATTACHMENT_MANAGEMENT':
                mainPrefix = 'AT'
                break
            case 'PAYMENT':
                mainPrefix = 'PM'
                break
            default:
                mainPrefix = 'WO'
        }
    }

    // 子类型代码（可选）
    let subCode = ''
    if (taskSubtype) {
        switch (taskSubtype) {
            // 账户申请相关子类型
            case 'GOOGLE_ACCOUNT':
                subCode = 'G'
                break
            case 'TIKTOK_ACCOUNT':
                subCode = 'T'
                break
            case 'FACEBOOK_ACCOUNT':
                subCode = 'F'
                break

            // 账户管理相关子类型
            case 'BIND_ACCOUNT':
                subCode = 'BA'
                break
            case 'UNBIND_ACCOUNT':
                subCode = 'UA'
                break
            case 'BIND_PIXEL':
                subCode = 'BP'
                break
            case 'UNBIND_PIXEL':
                subCode = 'UP'
                break
            case 'BIND_EMAIL':
                subCode = 'BE'
                break
            case 'UNBIND_EMAIL':
                subCode = 'UE'
                break
            case 'GENERAL_MANAGEMENT':
                subCode = 'GM'
                break

            // 附件管理相关子类型
            case 'DOCUMENT_UPLOAD':
                subCode = 'DOC'
                break
            case 'IMAGE_UPLOAD':
                subCode = 'IMG'
                break
            case 'OTHER_ATTACHMENT':
                subCode = 'OTH'
                break

            // 支付相关子类型
            case 'DEPOSIT':
                subCode = 'DEP'
                break
            case 'WITHDRAWAL':
                subCode = 'WDR'
                break
            case 'TRANSFER':
                subCode = 'TRF'
                break
            case 'ZEROING':
                subCode = 'ZER'
                break

            default:
                subCode = ''
        }
    }

    // 生成日期部分
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '')

    // 生成唯一ID部分
    const uniquePart = uuidv4().replace(/-/g, '').substring(0, 10).toUpperCase()

    // 组合最终工单编号
    if (subCode) {
        return `${mainPrefix}${subCode}-${datePart}-${uniquePart}`
    } else {
        return `${mainPrefix}-${datePart}-${uniquePart}`
    }
}

export function generateTraceId(): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 15)
    return `TRACE-${timestamp}-${random}`
}
