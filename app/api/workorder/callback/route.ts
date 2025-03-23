import { NextRequest, NextResponse } from 'next/server'
import { handleThirdPartyCallback } from '@/app/actions/workorder/common'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        // 验证回调签名和参数
        // 实际项目中应当实现严格的安全验证
        if (!body.workOrderId || !body.status) {
            return NextResponse.json(
                { success: false, message: '参数不完整' },
                { status: 400 }
            )
        }

        // 处理回调
        const result = await handleThirdPartyCallback({
            workOrderId: body.workOrderId,
            thirdPartyResponse: body,
            status: body.status
        })

        if (result.success) {
            return NextResponse.json(
                { success: true, message: '回调处理成功' },
                { status: 200 }
            )
        } else {
            return NextResponse.json(
                { success: false, message: result.message },
                { status: 500 }
            )
        }
    } catch (error) {
        console.error('处理工单回调出错:', error)
        return NextResponse.json(
            { success: false, message: '处理回调时出错' },
            { status: 500 }
        )
    }
}
