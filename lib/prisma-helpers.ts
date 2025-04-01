import {
    WorkOrderStatus,
    WorkOrderType,
    WorkOrderSubtype
} from '@prisma/client'

// 定义工单完整类型（包含关联数据）
export interface WorkOrderWithRelations {
    id: string
    taskId: string
    taskNumber: string
    userId: string
    workOrderType: WorkOrderType
    workOrderSubtype: WorkOrderSubtype
    status: WorkOrderStatus
    createdAt: Date
    updatedAt: Date
    metadata: any

    // 关联数据定义
    tecdo_account_application_business_data?: {
        id: string
        accountName: string
        currency: string
        timezone: string
        productType: number
        rechargeAmount?: string
        promotionLinks: string
    } | null

    tecdo_workorder_company_info?: {
        id: string
        companyNameCN: string
        companyNameEN: string
        businessLicenseNo: string
        legalRepName: string
        idType: number
        idNumber: string
        legalRepPhone: string
        legalRepBankCard?: string
        tecdo_workorder_company_attachments?: Array<{
            id: string
            fileName: string
            fileType: string
            fileSize: number
            filePath: string
            ossObjectKey: string
            fileUrl: string
            description?: string
        }> | null
    } | null

    tecdo_raw_data?: {
        id: string
        requestData: string
        responseData?: string
    } | null
}

// 安全地获取业务数据
export function getBusinessData(
    workOrder: WorkOrderWithRelations
): NonNullable<
    WorkOrderWithRelations['tecdo_account_application_business_data']
> {
    return (
        workOrder.tecdo_account_application_business_data ||
        ({} as NonNullable<
            WorkOrderWithRelations['tecdo_account_application_business_data']
        >)
    )
}

// 安全地获取公司信息
export function getCompanyInfo(
    workOrder: WorkOrderWithRelations
): NonNullable<WorkOrderWithRelations['tecdo_workorder_company_info']> {
    return (
        workOrder.tecdo_workorder_company_info ||
        ({} as NonNullable<
            WorkOrderWithRelations['tecdo_workorder_company_info']
        >)
    )
}

// 安全地获取附件
export function getAttachments(workOrder: WorkOrderWithRelations) {
    const companyInfo = getCompanyInfo(workOrder)
    return companyInfo.tecdo_workorder_company_attachments || []
}

// 安全地解析元数据
export function parseMetadata(workOrder: WorkOrderWithRelations) {
    try {
        if (!workOrder.metadata) return {}
        return typeof workOrder.metadata === 'string'
            ? JSON.parse(workOrder.metadata)
            : workOrder.metadata
    } catch (e) {
        console.error('解析元数据失败:', e)
        return {}
    }
}
