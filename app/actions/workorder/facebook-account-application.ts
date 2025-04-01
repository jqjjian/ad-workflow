'use server'
import {
    WorkOrderType,
    WorkOrderSubtype,
    WorkOrderStatus
} from '@prisma/client'
import { db } from '@/lib/db'
import { ApiResponse } from '@/types/api'
import { withAuth } from '@/lib/auth-actions'
import {
    FacebookAccount,
    FacebookAccountSchema,
    FacebookAccountWithCompany
} from '@/schemas/facebook-account'
import { WorkOrderCompanyInfoSchema } from '@/schemas/company-info'
import { generateTaskNumber } from '@/lib/utils'
import { auth } from '@/auth'
import { Logger } from '@/lib/logger'
import { ApiResponseBuilder } from '@/utils/api-response'

// 添加增强的日志记录
function logDebug(message: string, data?: any) {
    Logger.debug(
        `[FacebookAccountAPI] ${message}${data ? ' ' + JSON.stringify(data) : ''}`
    )
    console.log(
        `[FacebookAccountAPI] ${message}`,
        data ? JSON.stringify(data) : ''
    )
}

function logError(message: string, error: any) {
    const errorObj =
        error instanceof Error
            ? error
            : new Error(`${message}: ${JSON.stringify(error)}`)
    Logger.error(errorObj)
    console.error(`[FacebookAccountAPI] ${message}`, error)
}

export async function facebookApply(
    data: FacebookAccountWithCompany,
    userId: string | undefined
): Promise<ApiResponse> {
    logDebug('开始处理Facebook账号申请', { userId })

    const session = await auth()
    if (!session) {
        logDebug('用户未登录')
        return ApiResponseBuilder.error('401', '未登录')
    }

    if (!userId) {
        logDebug('用户ID为空')
        return ApiResponseBuilder.error('401', '用户ID不能为空')
    }

    try {
        // 验证输入数据
        logDebug('验证输入数据', { data })
        const validatedData = FacebookAccountSchema.parse(data)
        const taskNumber = generateTaskNumber(
            'ACCOUNT_APPLICATION',
            'FACEBOOK_ACCOUNT'
        )
        logDebug('生成任务编号', { taskNumber })

        // 验证公司信息
        let companyInfo = null
        if (data.companyInfo) {
            try {
                logDebug('开始验证公司信息')
                // 验证公司信息格式
                const validatedCompanyInfo = WorkOrderCompanyInfoSchema.parse(
                    data.companyInfo
                )

                // 处理企业信息
                if (validatedCompanyInfo.userCompanyInfoId) {
                    logDebug('使用已保存的企业信息', {
                        userCompanyInfoId:
                            validatedCompanyInfo.userCompanyInfoId
                    })
                    // 使用已保存的企业信息
                    const userCompanyInfo =
                        await db.tecdo_user_company_info.findUnique({
                            where: {
                                id: validatedCompanyInfo.userCompanyInfoId,
                                userId
                            }
                        })

                    if (!userCompanyInfo) {
                        logDebug('所选企业信息不存在', {
                            userCompanyInfoId:
                                validatedCompanyInfo.userCompanyInfoId
                        })
                        return ApiResponseBuilder.error(
                            '404',
                            '所选企业信息不存在'
                        )
                    }

                    // 验证企业信息所有权
                    if (userCompanyInfo.userId !== userId) {
                        logDebug('无权使用此企业信息', {
                            userCompanyInfoId:
                                validatedCompanyInfo.userCompanyInfoId,
                            ownerId: userCompanyInfo.userId
                        })
                        return ApiResponseBuilder.error(
                            '403',
                            '无权使用此企业信息'
                        )
                    }

                    // 获取企业附件
                    logDebug('获取企业附件')
                    const attachments =
                        await db.tecdo_workorder_company_attachments.findMany({
                            where: {
                                workOrderCompanyInfoId: userCompanyInfo.id
                            }
                        })
                    logDebug('获取到企业附件数量', {
                        count: attachments.length
                    })

                    // 使用用户已保存的企业信息
                    companyInfo = {
                        userCompanyInfoId: userCompanyInfo.id,
                        companyNameCN: userCompanyInfo.companyNameCN,
                        companyNameEN: userCompanyInfo.companyNameEN,
                        businessLicenseNo: userCompanyInfo.businessLicenseNo,
                        location: userCompanyInfo.location,
                        legalRepName: userCompanyInfo.legalRepName,
                        idType: userCompanyInfo.idType,
                        idNumber: userCompanyInfo.idNumber,
                        legalRepPhone: userCompanyInfo.legalRepPhone,
                        legalRepBankCard: userCompanyInfo.legalRepBankCard,
                        attachments: attachments.map((att: any) => ({
                            fileName: att.fileName,
                            fileType: att.fileType,
                            fileSize: att.fileSize,
                            filePath: att.filePath,
                            ossObjectKey: att.ossObjectKey,
                            fileUrl: att.fileUrl,
                            description: att.description
                        }))
                    }
                } else {
                    // 使用新填写的企业信息
                    logDebug('使用新填写的企业信息')
                    companyInfo = validatedCompanyInfo
                }
            } catch (error) {
                logError('企业信息验证失败', error)
                return ApiResponseBuilder.error(
                    '400',
                    error instanceof Error
                        ? `企业信息验证失败: ${error.message}`
                        : '企业信息格式错误'
                )
            }
        }

        try {
            // 使用事务处理整个流程
            logDebug('开始事务处理')
            return await db.$transaction(async (tx) => {
                // 1. 先创建工单记录，不设置rawDataId
                logDebug('创建工单记录')
                const workOrder = await tx.tecdo_work_orders.create({
                    data: {
                        taskNumber,
                        taskId: taskNumber, // 初始与taskNumber相同，后续可通过updateExternalTaskId更新
                        userId,
                        workOrderType: WorkOrderType.ACCOUNT_APPLICATION,
                        workOrderSubtype: WorkOrderSubtype.FACEBOOK_ACCOUNT,
                        status: WorkOrderStatus.PENDING,
                        metadata: {
                            platform: 'FACEBOOK',
                            hasCompanyInfo: companyInfo !== null
                        }
                    }
                })
                logDebug('工单记录创建成功', { workOrderId: workOrder.id })

                // 2. 再创建原始数据记录，使用有效的workOrderId
                logDebug('创建原始数据记录')
                const rawData = await tx.tecdo_raw_data.create({
                    data: {
                        workOrderId: workOrder.id,
                        requestData: JSON.stringify({
                            ...validatedData,
                            companyInfo
                        }),
                        syncStatus: 'PENDING'
                    }
                })
                logDebug('原始数据记录创建成功', { rawDataId: rawData.id })

                // 3. 更新工单记录的rawDataId
                await tx.tecdo_work_orders.update({
                    where: { id: workOrder.id },
                    data: { rawDataId: rawData.id }
                })

                // 4. 创建结构化请求数据记录
                logDebug('创建结构化请求数据记录')
                await tx.tecdo_raw_request_data.create({
                    data: {
                        rawDataId: rawData.id,
                        taskNumber,
                        productType: validatedData.productType,
                        currencyCode: validatedData.currencyCode,
                        timezone: validatedData.timezone,
                        name: validatedData.name,
                        rechargeAmount: validatedData.rechargeAmount,
                        rawJson:
                            process.env.NODE_ENV === 'development'
                                ? JSON.stringify(validatedData)
                                : ''
                    }
                })
                logDebug('结构化请求数据记录创建成功')

                // 5. 如果有企业信息，创建工单企业信息
                if (companyInfo) {
                    // 创建工单企业信息
                    logDebug('创建工单企业信息')
                    const workOrderCompanyInfo =
                        await tx.tecdo_workorder_company_info.create({
                            data: {
                                workOrderId: workOrder.id,
                                userCompanyInfoId:
                                    companyInfo.userCompanyInfoId,
                                companyNameCN: companyInfo.companyNameCN,
                                companyNameEN: companyInfo.companyNameEN,
                                businessLicenseNo:
                                    companyInfo.businessLicenseNo,
                                location: companyInfo.location,
                                legalRepName: companyInfo.legalRepName,
                                idType: companyInfo.idType,
                                idNumber: companyInfo.idNumber,
                                legalRepPhone: companyInfo.legalRepPhone,
                                legalRepBankCard: companyInfo.legalRepBankCard
                            }
                        })
                    logDebug('工单企业信息创建成功', {
                        workOrderCompanyInfoId: workOrderCompanyInfo.id
                    })

                    // 处理附件
                    if (
                        companyInfo.attachments &&
                        companyInfo.attachments.length > 0
                    ) {
                        logDebug('处理企业附件', {
                            attachmentsCount: companyInfo.attachments.length
                        })
                        for (const attachment of companyInfo.attachments) {
                            await tx.tecdo_workorder_company_attachments.create(
                                {
                                    data: {
                                        workOrderCompanyInfoId:
                                            workOrderCompanyInfo.id,
                                        fileName: attachment.fileName,
                                        fileType: attachment.fileType,
                                        fileSize: attachment.fileSize,
                                        filePath: attachment.filePath,
                                        ossObjectKey: attachment.ossObjectKey,
                                        fileUrl: attachment.fileUrl,
                                        description: attachment.description
                                    }
                                }
                            )
                        }
                        logDebug('企业附件处理完成')
                    }
                }

                // 6. 创建业务数据
                logDebug('创建业务数据')
                await tx.tecdo_account_application_business_data.create({
                    data: {
                        workOrderId: workOrder.id,
                        mediaPlatform: 'FACEBOOK',
                        accountName: validatedData.name ?? '',
                        currency: validatedData.currencyCode ?? '',
                        timezone: validatedData.timezone ?? '',
                        productType: validatedData.productType || 0,
                        rechargeAmount: validatedData.rechargeAmount,
                        promotionLinks: JSON.stringify(
                            validatedData.promotionLinks
                        ),
                        applicationStatus: 'PENDING'
                    }
                })
                logDebug('业务数据创建成功')

                // 这里不调用第三方接口，工单直接设置为待处理状态
                logDebug('Facebook账号申请设置为待处理状态')

                // 7. 更新原始数据状态
                await tx.tecdo_raw_data.update({
                    where: { id: rawData.id },
                    data: {
                        syncStatus: 'PENDING',
                        lastSyncTime: new Date()
                    }
                })
                logDebug('原始数据状态更新为待处理')

                // 8. 记录审计日志
                logDebug('记录审计日志')
                await tx.tecdo_audit_logs.create({
                    data: {
                        entityType: 'FACEBOOK_ACCOUNT_APPLICATION',
                        entityId: workOrder.id,
                        action: 'CREATE',
                        performedBy: userId,
                        newValue: JSON.stringify({
                            taskNumber,
                            accountName: validatedData.name,
                            hasCompanyInfo: companyInfo !== null
                        }),
                        createdAt: new Date()
                    }
                })
                logDebug('审计日志记录成功')

                logDebug('Facebook账号申请流程完成', {
                    taskNumber,
                    workOrderId: workOrder.id
                })

                return ApiResponseBuilder.success({
                    taskNumber,
                    workOrderId: workOrder.id
                })
            })
        } catch (error) {
            logError('Facebook账号申请处理过程中发生错误', error)
            return ApiResponseBuilder.error(
                '1',
                error instanceof Error ? error.message : '未知错误'
            )
        }
    } catch (error) {
        logError('Facebook账号申请数据验证失败', error)
        return ApiResponseBuilder.error(
            '400',
            error instanceof Error ? error.message : '数据验证失败'
        )
    }
}

// 更新外部任务ID的方法
export async function updateExternalTaskId(
    workOrderId: string,
    externalTaskId: string,
    userId: string | undefined
): Promise<ApiResponse> {
    logDebug('开始更新外部任务ID', { workOrderId, externalTaskId, userId })

    const session = await auth()
    if (!session) {
        logDebug('用户未登录')
        return ApiResponseBuilder.error('401', '未登录')
    }

    if (!userId) {
        logDebug('用户ID为空')
        return ApiResponseBuilder.error('401', '用户ID不能为空')
    }

    try {
        // 查找工单
        const workOrder = await db.tecdo_work_orders.findFirst({
            where: {
                id: workOrderId,
                userId,
                isDeleted: false
            }
        })

        if (!workOrder) {
            logDebug('工单不存在', { workOrderId })
            return ApiResponseBuilder.error('404', '工单不存在')
        }

        // 更新工单的taskId和状态
        await db.tecdo_work_orders.update({
            where: { id: workOrderId },
            data: {
                taskId: externalTaskId,
                status: WorkOrderStatus.PROCESSING, // 更新为处理中状态
                updatedAt: new Date()
            }
        })
        logDebug('工单taskId和状态更新成功', { externalTaskId })

        // 获取最新的rawData
        const rawData = await db.tecdo_raw_data.findFirst({
            where: { workOrderId },
            orderBy: { createdAt: 'desc' }
        })

        if (rawData) {
            // 更新原始数据状态
            await db.tecdo_raw_data.update({
                where: { id: rawData.id },
                data: {
                    responseData: JSON.stringify({
                        externalTaskId,
                        updateTime: new Date().toISOString()
                    }),
                    syncStatus: 'SUCCESS',
                    lastSyncTime: new Date()
                }
            })
            logDebug('原始数据状态更新成功')
        }

        // 记录审计日志
        await db.tecdo_audit_logs.create({
            data: {
                entityType: 'FACEBOOK_ACCOUNT_APPLICATION',
                entityId: workOrder.id,
                action: 'UPDATE_EXTERNAL_TASK_ID',
                performedBy: userId,
                newValue: JSON.stringify({ externalTaskId }),
                createdAt: new Date()
            }
        })
        logDebug('审计日志记录成功')

        return ApiResponseBuilder.success({
            workOrderId,
            externalTaskId
        })
    } catch (error) {
        logError('更新外部任务ID过程中发生错误', error)
        return ApiResponseBuilder.error(
            '1',
            error instanceof Error ? error.message : '未知错误'
        )
    }
}

// 修改Facebook开户申请的方法
export async function updateFacebookApply(
    data: FacebookAccountWithCompany,
    userId: string | undefined,
    taskId: string
): Promise<ApiResponse> {
    const session = await auth()
    if (!session) {
        return ApiResponseBuilder.error('401', '未登录')
    }

    if (!userId) {
        return ApiResponseBuilder.error('401', '用户ID不能为空')
    }

    if (!taskId) {
        return ApiResponseBuilder.error('400', '任务ID不能为空')
    }

    // 验证输入数据
    const validatedData = FacebookAccountSchema.parse(data)

    // 验证公司信息
    let companyInfo = null
    if (data.companyInfo) {
        try {
            // 验证公司信息格式
            const validatedCompanyInfo = WorkOrderCompanyInfoSchema.parse(
                data.companyInfo
            )
            companyInfo = validatedCompanyInfo
        } catch (error) {
            return ApiResponseBuilder.error(
                '400',
                error instanceof Error
                    ? `企业信息验证失败: ${error.message}`
                    : '企业信息格式错误'
            )
        }
    }

    try {
        // 检查工单是否存在
        const existingWorkOrder = await db.tecdo_work_orders.findFirst({
            where: {
                taskId: taskId,
                userId: userId,
                isDeleted: false
            }
        })

        if (!existingWorkOrder) {
            return ApiResponseBuilder.error('404', '找不到对应的工单')
        }

        // 检查工单状态是否允许修改
        if (
            existingWorkOrder.status !== WorkOrderStatus.PENDING &&
            existingWorkOrder.status !== WorkOrderStatus.FAILED
        ) {
            return ApiResponseBuilder.error('403', '当前工单状态不允许修改')
        }

        // 使用事务处理整个流程
        return await db.$transaction(async (tx) => {
            // 1. 创建新的原始数据记录
            const rawData = await tx.tecdo_raw_data.create({
                data: {
                    workOrderId: existingWorkOrder.id,
                    requestData: JSON.stringify({
                        ...validatedData,
                        companyInfo
                    }),
                    syncStatus: 'PENDING'
                }
            })

            // 2. 更新工单状态
            await tx.tecdo_work_orders.update({
                where: { id: existingWorkOrder.id },
                data: {
                    status: WorkOrderStatus.PENDING,
                    rawDataId: rawData.id,
                    updatedAt: new Date()
                }
            })

            // 3. 更新结构化请求数据记录
            await tx.tecdo_raw_request_data.create({
                data: {
                    rawDataId: rawData.id,
                    taskNumber: existingWorkOrder.taskNumber,
                    productType: validatedData.productType,
                    currencyCode: validatedData.currencyCode,
                    timezone: validatedData.timezone,
                    name: validatedData.name,
                    rechargeAmount: validatedData.rechargeAmount,
                    rawJson:
                        process.env.NODE_ENV === 'development'
                            ? JSON.stringify(validatedData)
                            : ''
                }
            })

            // 4. 如果有企业信息，更新工单企业信息
            if (companyInfo) {
                // 查找是否已有工单企业信息
                const existingCompanyInfo =
                    await tx.tecdo_workorder_company_info.findFirst({
                        where: { workOrderId: existingWorkOrder.id }
                    })

                if (existingCompanyInfo) {
                    // 更新已有企业信息
                    await tx.tecdo_workorder_company_info.update({
                        where: { id: existingCompanyInfo.id },
                        data: {
                            userCompanyInfoId: companyInfo.userCompanyInfoId,
                            companyNameCN: companyInfo.companyNameCN,
                            companyNameEN: companyInfo.companyNameEN,
                            businessLicenseNo: companyInfo.businessLicenseNo,
                            location: companyInfo.location,
                            legalRepName: companyInfo.legalRepName,
                            idType: companyInfo.idType,
                            idNumber: companyInfo.idNumber,
                            legalRepPhone: companyInfo.legalRepPhone,
                            legalRepBankCard: companyInfo.legalRepBankCard,
                            updatedAt: new Date()
                        }
                    })

                    // 删除旧的附件
                    await tx.tecdo_workorder_company_attachments.deleteMany({
                        where: {
                            workOrderCompanyInfoId: existingCompanyInfo.id
                        }
                    })

                    // 添加新的附件
                    if (
                        companyInfo.attachments &&
                        companyInfo.attachments.length > 0
                    ) {
                        for (const attachment of companyInfo.attachments) {
                            await tx.tecdo_workorder_company_attachments.create(
                                {
                                    data: {
                                        workOrderCompanyInfoId:
                                            existingCompanyInfo.id,
                                        fileName: attachment.fileName,
                                        fileType: attachment.fileType,
                                        fileSize: attachment.fileSize,
                                        filePath: attachment.filePath,
                                        ossObjectKey: attachment.ossObjectKey,
                                        fileUrl: attachment.fileUrl,
                                        description: attachment.description
                                    }
                                }
                            )
                        }
                    }
                } else {
                    // 创建新的工单企业信息
                    const workOrderCompanyInfo =
                        await tx.tecdo_workorder_company_info.create({
                            data: {
                                workOrderId: existingWorkOrder.id,
                                userCompanyInfoId:
                                    companyInfo.userCompanyInfoId,
                                companyNameCN: companyInfo.companyNameCN,
                                companyNameEN: companyInfo.companyNameEN,
                                businessLicenseNo:
                                    companyInfo.businessLicenseNo,
                                location: companyInfo.location,
                                legalRepName: companyInfo.legalRepName,
                                idType: companyInfo.idType,
                                idNumber: companyInfo.idNumber,
                                legalRepPhone: companyInfo.legalRepPhone,
                                legalRepBankCard: companyInfo.legalRepBankCard
                            }
                        })

                    // 处理附件
                    if (
                        companyInfo.attachments &&
                        companyInfo.attachments.length > 0
                    ) {
                        for (const attachment of companyInfo.attachments) {
                            await tx.tecdo_workorder_company_attachments.create(
                                {
                                    data: {
                                        workOrderCompanyInfoId:
                                            workOrderCompanyInfo.id,
                                        fileName: attachment.fileName,
                                        fileType: attachment.fileType,
                                        fileSize: attachment.fileSize,
                                        filePath: attachment.filePath,
                                        ossObjectKey: attachment.ossObjectKey,
                                        fileUrl: attachment.fileUrl,
                                        description: attachment.description
                                    }
                                }
                            )
                        }
                    }
                }
            }

            // 5. 更新业务数据
            const existingBusinessData =
                await tx.tecdo_account_application_business_data.findFirst({
                    where: { workOrderId: existingWorkOrder.id }
                })

            if (existingBusinessData) {
                await tx.tecdo_account_application_business_data.update({
                    where: { id: existingBusinessData.id },
                    data: {
                        accountName: validatedData.name ?? '',
                        currency: validatedData.currencyCode ?? '',
                        timezone: validatedData.timezone ?? '',
                        productType: validatedData.productType || 0,
                        rechargeAmount: validatedData.rechargeAmount,
                        promotionLinks: JSON.stringify(
                            validatedData.promotionLinks
                        ),
                        applicationStatus: 'PENDING',
                        updatedAt: new Date()
                    }
                })
            } else {
                await tx.tecdo_account_application_business_data.create({
                    data: {
                        workOrderId: existingWorkOrder.id,
                        mediaPlatform: 'FACEBOOK',
                        accountName: validatedData.name ?? '',
                        currency: validatedData.currencyCode ?? '',
                        timezone: validatedData.timezone ?? '',
                        productType: validatedData.productType || 0,
                        rechargeAmount: validatedData.rechargeAmount,
                        promotionLinks: JSON.stringify(
                            validatedData.promotionLinks
                        ),
                        applicationStatus: 'PENDING'
                    }
                })
            }

            // 6. 记录审计日志
            await tx.tecdo_audit_logs.create({
                data: {
                    entityType: 'FACEBOOK_ACCOUNT_APPLICATION',
                    entityId: existingWorkOrder.id,
                    action: 'UPDATE',
                    performedBy: userId,
                    newValue: JSON.stringify({
                        taskId,
                        accountName: validatedData.name,
                        hasCompanyInfo: companyInfo !== null
                    }),
                    createdAt: new Date()
                }
            })

            return ApiResponseBuilder.success({
                taskId: taskId,
                workOrderId: existingWorkOrder.id
            })
        })
    } catch (error) {
        Logger.error(
            error instanceof Error
                ? error
                : new Error('Facebook账号申请修改失败')
        )
        return ApiResponseBuilder.error(
            '1',
            error instanceof Error ? error.message : '未知错误'
        )
    }
}

// 获取Facebook开户申请详情的方法
export async function getFacebookApplyRecord(
    taskId: string
): Promise<ApiResponse> {
    const session = await auth()
    if (!session) {
        return ApiResponseBuilder.error('401', '未登录')
    }

    if (!taskId) {
        return ApiResponseBuilder.error('400', '任务ID不能为空')
    }

    try {
        // 1. 查询工单信息
        const workOrder = await db.tecdo_work_orders.findFirst({
            where: {
                taskId: taskId,
                workOrderSubtype: WorkOrderSubtype.FACEBOOK_ACCOUNT,
                isDeleted: false
            }
        })

        if (!workOrder) {
            return ApiResponseBuilder.error('404', '找不到对应的工单')
        }

        // 1.1 查询原始数据
        const rawData = await db.tecdo_raw_data.findFirst({
            where: { workOrderId: workOrder.id },
            orderBy: { createdAt: 'desc' }
        })

        // 2. 查询业务数据
        const businessData =
            await db.tecdo_account_application_business_data.findFirst({
                where: { workOrderId: workOrder.id }
            })

        // 3. 查询公司信息
        const companyInfo = await db.tecdo_workorder_company_info.findFirst({
            where: { workOrderId: workOrder.id },
            include: {
                tecdo_workorder_company_attachments: true
            }
        })

        // 4. 整合数据
        let responseData: any = {}

        if (rawData && rawData.requestData) {
            try {
                const parsedRequestData = JSON.parse(rawData.requestData)
                responseData = {
                    ...parsedRequestData
                }

                // 删除可能多余的公司信息，会单独整合
                delete responseData.companyInfo
            } catch (e) {
                Logger.error(new Error(`解析工单原始数据失败: ${e}`))
            }
        }

        // 添加业务数据
        if (businessData) {
            responseData = {
                ...responseData,
                productType: businessData.productType,
                currencyCode: businessData.currency,
                timezone: businessData.timezone,
                name: businessData.accountName,
                rechargeAmount: businessData.rechargeAmount
            }

            // 处理promotionLinks
            if (businessData.promotionLinks) {
                try {
                    responseData.promotionLinks = JSON.parse(
                        businessData.promotionLinks
                    )
                } catch (e) {
                    responseData.promotionLinks = []
                }
            }
        }

        // 添加公司信息
        if (companyInfo) {
            const formattedAttachments =
                companyInfo.tecdo_workorder_company_attachments.map(
                    (attachment) => ({
                        fileName: attachment.fileName,
                        fileType: attachment.fileType,
                        fileSize: attachment.fileSize,
                        filePath: attachment.filePath,
                        ossObjectKey: attachment.ossObjectKey,
                        fileUrl: attachment.fileUrl,
                        description: attachment.description
                    })
                )

            responseData.company = {
                companyNameCN: companyInfo.companyNameCN,
                companyNameEN: companyInfo.companyNameEN,
                businessLicenseNo: companyInfo.businessLicenseNo,
                location: companyInfo.location,
                legalRepName: companyInfo.legalRepName,
                idType: companyInfo.idType,
                idNumber: companyInfo.idNumber,
                legalRepPhone: companyInfo.legalRepPhone,
                legalRepBankCard: companyInfo.legalRepBankCard,
                attachments: formattedAttachments
            }
        }

        // 格式化为标准媒体账户申请记录格式
        const formattedResponse = {
            mediaAccountApplications: [
                {
                    taskNumber: workOrder.taskNumber,
                    taskId: workOrder.taskId,
                    oeId: '', // 默认为空字符串
                    mediaAccountInfos: [
                        {
                            productType: responseData.productType,
                            currencyCode: responseData.currencyCode,
                            timezone: responseData.timezone,
                            name: responseData.name,
                            rechargeAmount: responseData.rechargeAmount,
                            promotionLinks: responseData.promotionLinks || [],
                            auths: responseData.auths || []
                        }
                    ],
                    mediaPlatform: 1, // Facebook
                    status: Number(workOrder.status),
                    company: responseData.company || {},
                    createdAt: workOrder.createdAt.getTime(),
                    updatedAt: workOrder.updatedAt.getTime()
                }
            ],
            total: 1,
            pages: 1,
            pageNumber: 1,
            pageSize: 1
        }

        return ApiResponseBuilder.success(formattedResponse)
    } catch (error) {
        Logger.error(
            error instanceof Error
                ? error
                : new Error('获取Facebook账号申请详情失败')
        )
        return ApiResponseBuilder.error(
            '1',
            error instanceof Error ? error.message : '未知错误'
        )
    }
}
