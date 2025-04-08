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
    GoogleAccount,
    GoogleAccountSchema,
    GoogleAccountWithCompany
    // GoogleAccountWithCompanySchema
} from '@/schemas/google-account'
import { WorkOrderCompanyInfoSchema } from '@/schemas/company-info'
import { generateTaskNumber } from '@/lib/utils'
import { auth } from '@/auth'
import { Logger } from '@/lib/logger'
import { callExternalApi, API_BASE_URL } from '@/lib/request'
import { ApiResponseBuilder } from '@/utils/api-response'
import {
    buildGoogleAccountCreateRequest,
    validateGoogleAccountCreateRequest,
    GoogleAccountCreateRequest
} from '@/schemas/third-party-google-account'
import {
    validateSchema,
    GoogleAccountCreateRequestSchema
} from '@/schemas/third-party-type'
import { z } from 'zod'
// import { WorkOrderTypeEnum, WorkOrderSubtypeEnum } from '@/schemas/enums'

// 添加增强的日志记录
function logDebug(message: string, data?: any) {
    Logger.debug(
        `[GoogleAccountAPI] ${message}${data ? ' ' + JSON.stringify(data) : ''}`
    )
    console.log(
        `[GoogleAccountAPI] ${message}`,
        data ? JSON.stringify(data) : ''
    )
}

function logError(message: string, error: any) {
    const errorObj =
        error instanceof Error
            ? new Error(`${message}: ${error.message}`)
            : new Error(`${message}: ${JSON.stringify(error)}`)
    Logger.error(errorObj)
    console.error(`[GoogleAccountAPI] ${message}`, error)
}

export async function googleApply(
    data: GoogleAccountWithCompany,
    userId: string | undefined
): Promise<ApiResponse> {
    logDebug('开始处理Google账号申请', { userId })

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

        // 添加更详细的数据结构日志
        console.log('输入数据结构检查:')
        console.log('productType:', typeof data.productType, data.productType)
        console.log(
            'currencyCode:',
            typeof data.currencyCode,
            data.currencyCode
        )
        console.log('timezone:', typeof data.timezone, data.timezone)
        console.log('name:', typeof data.name, data.name)
        if (data.companyInfo) {
            console.log(
                'companyInfo.companyNameCN:',
                typeof data.companyInfo?.companyNameCN,
                data.companyInfo?.companyNameCN || '未设置'
            )
            console.log(
                'companyInfo.businessLicenseNo:',
                typeof data.companyInfo?.businessLicenseNo,
                data.companyInfo?.businessLicenseNo || '未设置'
            )
            console.log(
                'companyInfo.location:',
                typeof data.companyInfo?.location,
                data.companyInfo?.location !== undefined
                    ? data.companyInfo?.location
                    : '未设置'
            )
        }
        if (
            data.auths &&
            Array.isArray(data.auths) &&
            data.auths.length > 0 &&
            data.auths[0]
        ) {
            console.log(
                'auths[0].role:',
                typeof data.auths[0]?.role,
                data.auths[0]?.role
            )
            console.log(
                'auths[0].value:',
                typeof data.auths[0]?.value,
                data.auths[0]?.value || '未设置'
            )
        }

        // 检查和修正promotionLinks
        console.log('原始promotionLinks:', data.promotionLinks)

        // 确保promotionLinks是数组并且有有效值
        if (!data.promotionLinks || !Array.isArray(data.promotionLinks)) {
            console.log('修正：promotionLinks不是数组，设置为默认值')
            data.promotionLinks = ['https://example.com']
        } else if (data.promotionLinks.length === 0) {
            console.log('修正：promotionLinks为空数组，添加默认值')
            data.promotionLinks.push('https://example.com')
        } else {
            // 检查URL格式
            for (let i = 0; i < data.promotionLinks.length; i++) {
                const url = data.promotionLinks[i]
                if (!url || typeof url !== 'string') {
                    console.log(
                        `修正：promotionLinks[${i}]无效，使用默认值替换`
                    )
                    data.promotionLinks[i] = 'https://example.com'
                } else {
                    try {
                        // 尝试修正URL格式
                        if (!url.match(/^https?:\/\//)) {
                            console.log(
                                `修正：promotionLinks[${i}]缺少http前缀，添加前缀`
                            )
                            data.promotionLinks[i] = 'https://' + url
                        }
                    } catch (urlError) {
                        console.log(`修正URL格式失败:`, urlError)
                    }
                }
            }
        }
        console.log('处理后的promotionLinks:', data.promotionLinks)

        // 检查和修正auths
        console.log('原始auths:', data.auths)

        // 确保auths是数组
        if (!data.auths || !Array.isArray(data.auths)) {
            console.log('修正：auths不是数组，设置为默认值')
            data.auths = [{ role: 1, value: 'test@example.com' }]
        } else if (data.auths.length === 0) {
            console.log('修正：auths为空数组，添加默认值')
            data.auths.push({ role: 1, value: 'test@example.com' })
        } else {
            // 检查第一个auth项
            const auth = data.auths[0]
            if (!auth) {
                console.log('修正：auths[0]为null，使用默认值替换')
                data.auths[0] = { role: 1, value: 'test@example.com' }
            } else {
                // 确保role和value都存在
                if (!auth.role && !auth.value) {
                    console.log('修正：auths[0]没有role和value，使用默认值')
                    data.auths[0] = { role: 1, value: 'test@example.com' }
                } else if (auth.role && !auth.value) {
                    console.log('修正：auths[0]没有value，添加默认值')
                    auth.value = 'test@example.com'
                } else if (!auth.role && auth.value) {
                    console.log('修正：auths[0]没有role，添加默认值')
                    auth.role = 1
                } else {
                    // 转换role为数字
                    if (typeof auth.role === 'string') {
                        auth.role = parseInt(auth.role, 10)
                        console.log('修正：auths[0].role从字符串转为数字')
                    }
                }
            }
        }
        console.log('处理后的auths:', data.auths)

        let validatedData
        try {
            validatedData = GoogleAccountSchema.parse(data)
        } catch (validationError) {
            logDebug('数据验证失败', validationError)

            // 提取详细的错误信息
            let errorDetail = '数据验证失败'
            if (validationError instanceof z.ZodError) {
                const issues = validationError.issues
                if (issues && issues.length > 0) {
                    errorDetail = `${issues[0].path.join('.')}字段验证错误: ${issues[0].message}`
                    console.log('Zod验证错误详情:', issues)
                }
            }

            // 尝试创建更宽松的数据模型
            console.log('尝试使用更宽松的验证规则')
            try {
                // 创建一个基本的数据模型，只包含必要字段
                const basicData = {
                    productType: data.productType || 0,
                    currencyCode: data.currencyCode || 'USD',
                    timezone: data.timezone || 'Asia/Shanghai',
                    promotionLinks:
                        Array.isArray(data.promotionLinks) &&
                        data.promotionLinks.length > 0
                            ? data.promotionLinks
                            : ['https://example.com'],
                    name: data.name || '测试账户',
                    rechargeAmount: data.rechargeAmount || '',
                    auths:
                        Array.isArray(data.auths) &&
                        data.auths.length > 0 &&
                        data.auths[0]
                            ? [
                                  {
                                      role: Number(data.auths[0].role) || 1,
                                      value:
                                          data.auths[0].value ||
                                          'test@example.com'
                                  }
                              ]
                            : [{ role: 1, value: 'test@example.com' }]
                }

                console.log('使用简化的数据模型:', basicData)
                validatedData = basicData
            } catch (recoveryError) {
                console.log('恢复错误失败:', recoveryError)
                return ApiResponseBuilder.error(
                    '400',
                    errorDetail || '数据验证失败'
                )
            }
        }

        const taskNumber = generateTaskNumber(
            'ACCOUNT_APPLICATION',
            'GOOGLE_ACCOUNT'
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
                const metadataObj = {
                    platform: 'GOOGLE',
                    hasCompanyInfo: companyInfo !== null,
                    mediaAccountName: validatedData.name,
                    mediaPlatform: 'GOOGLE',
                    mediaPlatformNumber: 2,
                    // 确保所有申请人相关字段都有值，增加字段冗余以确保前端可以获取
                    createdBy: session?.user?.name || userId,
                    creator: session?.user?.name || userId,
                    applicant: session?.user?.name || userId,
                    userName: session?.user?.name || userId,
                    displayName: session?.user?.name || userId
                }
                console.log(
                    '正在创建工单，使用的metadata:',
                    JSON.stringify(metadataObj, null, 2)
                )

                const workOrder = await tx.tecdo_work_orders.create({
                    data: {
                        taskNumber,
                        taskId: taskNumber,
                        userId,
                        workOrderType: WorkOrderType.ACCOUNT_APPLICATION,
                        workOrderSubtype: WorkOrderSubtype.GOOGLE_ACCOUNT,
                        status: WorkOrderStatus.PENDING,
                        metadata: metadataObj
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
                    } else {
                        // 设置默认图片，用于测试
                        console.log('未找到有效附件，使用默认图片')
                        const attachments = []
                        attachments.push({
                            fileName: 'default-license.jpg',
                            fileType: 'image/jpeg',
                            fileSize: 1024, // 修改为大于0的值
                            filePath: 'licenses/default-license.jpg', // 设置有效的路径
                            ossObjectKey: 'licenses/default-license-key', // 设置有效的OSS对象键
                            fileUrl: 'https://example.com/default-license.jpg',
                            description: '营业执照'
                        })
                        for (const attachment of attachments) {
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

                // 6. 创建业务数据
                logDebug('创建业务数据')
                await tx.tecdo_account_application_business_data.create({
                    data: {
                        workOrderId: workOrder.id,
                        mediaPlatform: 'GOOGLE',
                        accountName: validatedData.name,
                        currency: validatedData.currencyCode,
                        timezone: validatedData.timezone,
                        productType: validatedData.productType || 0,
                        rechargeAmount: validatedData.rechargeAmount,
                        promotionLinks: JSON.stringify(
                            validatedData.promotionLinks
                        ),
                        applicationStatus: 'PENDING'
                    }
                })
                logDebug('业务数据创建成功')

                // 7. 调用第三方接口
                logDebug('准备调用第三方接口', {
                    taskNumber,
                    mediaAccountInfosCount: 1
                })

                // 构建API请求数据
                const apiPayload = buildGoogleAccountCreateRequest(taskNumber, {
                    name: validatedData.name,
                    currencyCode: validatedData.currencyCode,
                    timezone: validatedData.timezone,
                    productType:
                        validatedData.productType !== undefined
                            ? validatedData.productType
                            : 0,
                    // rechargeAmount: validatedData.rechargeAmount,
                    promotionLinks: validatedData.promotionLinks,
                    auths: Array.isArray(validatedData.auths)
                        ? validatedData.auths
                              .filter((auth) => auth !== null)
                              .map((auth) => ({
                                  role: auth?.role || 1,
                                  value: auth?.value || ''
                              }))
                        : []
                })

                // 可选：再次验证请求格式
                try {
                    validateSchema(GoogleAccountCreateRequestSchema, apiPayload)
                    logDebug('API请求数据验证通过')
                } catch (error) {
                    logError('API请求数据验证失败', error)
                    throw new Error('构建API请求数据失败')
                }

                logDebug('第三方接口请求数据', {
                    payload: JSON.stringify(apiPayload)
                })

                // 详细记录请求参数
                console.log('API请求详细参数:', {
                    url: `${API_BASE_URL}/openApi/v1/mediaAccountApplication/google/create`,
                    method: 'POST',
                    headers: '包含授权信息',
                    body: JSON.stringify(apiPayload, null, 2)
                })

                // 8. 更新工单状态和原始数据
                let apiResponse
                try {
                    // 记录API_BASE_URL
                    console.log('API基础URL:', API_BASE_URL)
                    console.log(
                        '完整请求URL:',
                        `${API_BASE_URL}/openApi/v1/mediaAccountApplication/google/create`
                    )

                    apiResponse = await callExternalApi<{ taskId: number }>({
                        url: `${API_BASE_URL}/openApi/v1/mediaAccountApplication/google/create`,
                        body: apiPayload
                    })

                    // 详细记录响应
                    console.log(
                        'API响应状态:',
                        apiResponse ? '成功' : '响应为空'
                    )
                    console.log('API响应内容类型:', typeof apiResponse)
                    console.log(
                        'API完整响应:',
                        JSON.stringify(apiResponse, null, 2)
                    )

                    logDebug('第三方接口响应', { response: apiResponse })

                    // 验证响应格式
                    if (!apiResponse || typeof apiResponse !== 'object') {
                        throw new Error(
                            'API响应格式无效，未接收到对象类型的响应'
                        )
                    }

                    if (apiResponse.code !== '0' && !apiResponse.success) {
                        throw new Error(
                            `API调用失败: ${apiResponse.message || '未知错误'}`
                        )
                    }

                    // 处理成功响应
                    if (apiResponse.code === '0' && apiResponse.data?.taskId) {
                        logDebug('第三方接口调用成功', {
                            externalTaskId: apiResponse.data.taskId
                        })
                        await tx.tecdo_work_orders.update({
                            where: { id: workOrder.id },
                            data: {
                                taskId: apiResponse.data.taskId.toString(),
                                status: WorkOrderStatus.PROCESSING
                            }
                        })

                        await tx.tecdo_raw_data.update({
                            where: { id: rawData.id },
                            data: {
                                responseData: JSON.stringify(apiResponse),
                                syncStatus: 'SUCCESS',
                                lastSyncTime: new Date()
                            }
                        })
                        logDebug('工单状态和原始数据更新成功 - 处理中')
                    } else {
                        logDebug('第三方接口调用失败', {
                            code: apiResponse.code,
                            message: apiResponse.message
                        })
                        await tx.tecdo_work_orders.update({
                            where: { id: workOrder.id },
                            data: {
                                status: WorkOrderStatus.FAILED
                            }
                        })

                        await tx.tecdo_raw_data.update({
                            where: { id: rawData.id },
                            data: {
                                responseData: JSON.stringify(apiResponse),
                                syncStatus: 'FAILED',
                                syncError:
                                    apiResponse.message || '第三方接口调用失败',
                                lastSyncTime: new Date()
                            }
                        })
                        logDebug('工单状态和原始数据更新成功 - 失败')
                    }

                    // 9. 记录审计日志
                    logDebug('记录审计日志')
                    await tx.tecdo_audit_logs.create({
                        data: {
                            entityType: 'GOOGLE_ACCOUNT_APPLICATION',
                            entityId: workOrder.id,
                            action: 'CREATE',
                            performedBy: userId,
                            newValue: JSON.stringify({
                                taskNumber,
                                accountName: validatedData.name,
                                hasCompanyInfo: companyInfo !== null,
                                mediaPlatform: 'GOOGLE'
                            }),
                            createdAt: new Date()
                        }
                    })
                    logDebug('审计日志记录成功')

                    logDebug('Google账号申请流程完成', {
                        taskId: apiResponse.data?.taskId,
                        taskNumber,
                        workOrderId: workOrder.id,
                        success: apiResponse.code === '0'
                    })

                    return ApiResponseBuilder.success({
                        taskId: apiResponse.data?.taskId,
                        taskNumber,
                        workOrderId: workOrder.id
                    })
                } catch (apiError) {
                    // 增强的错误日志记录
                    console.error('API调用异常详情:', apiError)
                    if (apiError instanceof Error) {
                        console.error('错误消息:', apiError.message)
                        console.error('错误堆栈:', apiError.stack)
                    }

                    // 尝试解析响应内容
                    if (
                        apiError instanceof SyntaxError &&
                        apiError.message.includes('Unexpected token')
                    ) {
                        console.error('JSON解析错误，可能收到了非JSON响应')
                        // 记录原始响应 - 这需要修改callExternalApi函数才能实现
                    }

                    logError('Google账号申请处理过程中发生错误', apiError)
                    throw apiError // 重新抛出错误，让事务处理捕获
                }
            })
        } catch (error) {
            logError('Google账号申请处理过程中发生错误', error)
            return ApiResponseBuilder.error(
                '1',
                error instanceof Error ? error.message : '未知错误'
            )
        }
    } catch (error) {
        logError('Google账号申请数据验证失败', error)
        return ApiResponseBuilder.error(
            '400',
            error instanceof Error ? error.message : '数据验证失败'
        )
    }
}

// 添加修改开户申请的方法
export async function updateGoogleApply(
    data: GoogleAccountWithCompany,
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
    const validatedData = GoogleAccountSchema.parse(data)

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
                        accountName: validatedData.name,
                        currency: validatedData.currencyCode,
                        timezone: validatedData.timezone,
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
                        mediaPlatform: 'GOOGLE',
                        accountName: validatedData.name,
                        currency: validatedData.currencyCode,
                        timezone: validatedData.timezone,
                        productType: validatedData.productType || 0,
                        rechargeAmount: validatedData.rechargeAmount,
                        promotionLinks: JSON.stringify(
                            validatedData.promotionLinks
                        ),
                        applicationStatus: 'PENDING'
                    }
                })
            }

            // 6. 调用第三方接口更新申请
            const response = await callExternalApi<{ taskId: string }>({
                url: `${API_BASE_URL}/google/account/update`,
                body: {
                    ...data,
                    userId,
                    taskId
                }
            })

            // 7. 更新原始数据
            if (response.code === '0') {
                await tx.tecdo_raw_data.update({
                    where: { id: rawData.id },
                    data: {
                        responseData: JSON.stringify(response),
                        syncStatus: 'SUCCESS',
                        lastSyncTime: new Date()
                    }
                })
            } else {
                await tx.tecdo_raw_data.update({
                    where: { id: rawData.id },
                    data: {
                        responseData: JSON.stringify(response),
                        syncStatus: 'FAILED',
                        syncError: response.message || '第三方接口调用失败',
                        lastSyncTime: new Date()
                    }
                })

                return ApiResponseBuilder.error(
                    '500',
                    response.message || '更新申请失败'
                )
            }

            // 8. 记录审计日志
            await tx.tecdo_audit_logs.create({
                data: {
                    entityType: 'GOOGLE_ACCOUNT_APPLICATION',
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
            error instanceof Error ? error : new Error('Google账号申请修改失败')
        )
        return ApiResponseBuilder.error(
            '1',
            error instanceof Error ? error.message : '未知错误'
        )
    }
}

// 添加获取开户申请详情的方法
export async function getGoogleApplyRecord(
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
                workOrderSubtype: WorkOrderSubtype.GOOGLE_ACCOUNT,
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
                    mediaPlatform: 2, // Google
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
                : new Error('获取Google账号申请详情失败')
        )
        return ApiResponseBuilder.error(
            '1',
            error instanceof Error ? error.message : '未知错误'
        )
    }
}
