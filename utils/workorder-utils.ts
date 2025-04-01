import { WorkOrderType, WorkOrderSubtype } from '@prisma/client'

// 生成工单编号
export function generateWorkOrderNumber(
    type: WorkOrderType,
    subtype: WorkOrderSubtype
): string {
    const date = new Date()
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
    const random = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, '0')

    // 根据类型和子类型生成前缀
    let prefix = ''

    switch (type) {
        case 'ACCOUNT_APPLICATION':
            prefix =
                subtype === 'GOOGLE_ACCOUNT'
                    ? 'GA'
                    : subtype === 'TIKTOK_ACCOUNT'
                      ? 'TA'
                      : subtype === 'FACEBOOK_ACCOUNT'
                        ? 'FA'
                        : 'AP'
            break
        case 'ACCOUNT_MANAGEMENT':
            prefix =
                subtype === 'DEPOSIT'
                    ? 'DP'
                    : subtype === 'WITHDRAWAL'
                      ? 'WD'
                      : subtype === 'TRANSFER'
                        ? 'TR'
                        : subtype === 'ZEROING'
                          ? 'ZR'
                          : subtype === 'BIND_ACCOUNT'
                            ? 'BA'
                            : subtype === 'UNBIND_ACCOUNT'
                              ? 'UA'
                              : subtype === 'BIND_PIXEL'
                                ? 'BP'
                                : subtype === 'UNBIND_PIXEL'
                                  ? 'UP'
                                  : subtype === 'BIND_EMAIL'
                                    ? 'BE'
                                    : subtype === 'UNBIND_EMAIL'
                                      ? 'UE'
                                      : 'AM'
            break
        case 'ATTACHMENT_MANAGEMENT':
            prefix = 'AT'
            break
        case 'PAYMENT':
            prefix = 'PM'
            break
        default:
            prefix = 'WO'
    }

    return `${prefix}-${dateStr}-${random}`
}

// 验证用户对工单的访问权限
export async function validateWorkOrderAccess(
    workOrderId: number,
    userId: string
): Promise<boolean> {
    // 实现用户与工单的权限验证逻辑
    // 返回true表示有权限，false表示无权限
    return true // 占位实现
}

// 软删除工单
export async function softDeleteWorkOrder(
    workOrderId: number,
    userId: string
): Promise<boolean> {
    // 实现软删除逻辑
    // 不进行物理删除，而是标记状态为"已删除"
    return true // 占位实现
}
