import { NextRequest, NextResponse } from 'next/server'

// 模拟创建Google账户申请
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        console.log('收到Google账号申请创建请求:', body)

        // 模拟处理延迟
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // 随机模拟成功或失败
        const isSuccess = Math.random() > 0.2 // 80%成功率

        if (isSuccess) {
            return NextResponse.json({
                code: '0',
                success: true,
                message: '申请提交成功',
                data: {
                    taskId: Date.now().toString()
                },
                timestamp: Date.now()
            })
        } else {
            // 随机错误原因
            const errorReasons = [
                '账户名称已存在',
                '请求参数有误',
                '系统维护中',
                '账户额度超限',
                '推广链接无效'
            ]
            const errorReason =
                errorReasons[Math.floor(Math.random() * errorReasons.length)]

            return NextResponse.json({
                code: '1',
                success: false,
                message: errorReason,
                timestamp: Date.now()
            })
        }
    } catch (error) {
        console.error('处理Google账号申请创建请求时出错:', error)
        return NextResponse.json(
            {
                code: '500',
                success: false,
                message: '内部服务器错误',
                timestamp: Date.now()
            },
            { status: 500 }
        )
    }
}

// 模拟更新Google账户申请
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        console.log('收到Google账号申请更新请求:', body)

        // 模拟处理延迟
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // 随机模拟成功或失败
        const isSuccess = Math.random() > 0.1 // 90%成功率

        if (isSuccess) {
            return NextResponse.json({
                code: '0',
                success: true,
                message: '申请更新成功',
                data: {
                    taskId: body.taskId || Date.now().toString()
                },
                timestamp: Date.now()
            })
        } else {
            return NextResponse.json({
                code: '1',
                success: false,
                message: '申请更新失败，工单状态已变更',
                timestamp: Date.now()
            })
        }
    } catch (error) {
        console.error('处理Google账号申请更新请求时出错:', error)
        return NextResponse.json(
            {
                code: '500',
                success: false,
                message: '内部服务器错误',
                timestamp: Date.now()
            },
            { status: 500 }
        )
    }
}

// 模拟获取Google账户申请详情
export async function GET(request: NextRequest) {
    try {
        const taskId = request.nextUrl.searchParams.get('taskId')
        console.log('收到Google账号申请查询请求:', { taskId })

        if (!taskId) {
            return NextResponse.json(
                {
                    code: '400',
                    success: false,
                    message: '任务ID不能为空',
                    timestamp: Date.now()
                },
                { status: 400 }
            )
        }

        // 模拟处理延迟
        await new Promise((resolve) => setTimeout(resolve, 800))

        // 随机状态
        const statuses = [1, 2, 3, 4, 5] // 对应不同的工单状态
        const randomStatus =
            statuses[Math.floor(Math.random() * statuses.length)]

        return NextResponse.json({
            code: '0',
            success: true,
            message: '获取成功',
            data: {
                mediaAccountApplications: [
                    {
                        taskNumber: `T${Date.now().toString().substring(5)}`,
                        taskId: taskId,
                        mediaAccountInfos: [
                            {
                                productType: 1,
                                currencyCode: 'CNY',
                                timezone: 'Asia/Shanghai',
                                name: '测试账号',
                                rechargeAmount: '1000',
                                promotionLinks: ['https://example.com'],
                                auths: []
                            }
                        ],
                        mediaPlatform: 2, // Google
                        status: randomStatus,
                        company: {
                            companyNameCN: '测试公司',
                            companyNameEN: 'Test Company',
                            businessLicenseNo: '91110105MA00XXX000',
                            location: 0,
                            legalRepName: '张三',
                            idType: 1,
                            idNumber: '110101199001011234',
                            legalRepPhone: '13800138000',
                            attachments: []
                        },
                        createdAt: Date.now() - 86400000, // 昨天
                        updatedAt: Date.now()
                    }
                ],
                total: 1,
                pages: 1,
                pageNumber: 1,
                pageSize: 1
            },
            timestamp: Date.now()
        })
    } catch (error) {
        console.error('处理Google账号申请查询请求时出错:', error)
        return NextResponse.json(
            {
                code: '500',
                success: false,
                message: '内部服务器错误',
                timestamp: Date.now()
            },
            { status: 500 }
        )
    }
}
