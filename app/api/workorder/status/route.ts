import { NextRequest, NextResponse } from 'next/server'
import { checkWorkOrderStatus } from '@/app/actions/workorder/common'

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const workOrderId = searchParams.get('id')

        if (!workOrderId) {
            return NextResponse.json(
                { success: false, message: '缺少工单ID参数' },
                { status: 400 }
            )
        }

        const result = await checkWorkOrderStatus(workOrderId)

        if (result.success) {
            return NextResponse.json(
                { success: true, data: result.data },
                { status: 200 }
            )
        } else {
            return NextResponse.json(
                { success: false, message: result.message },
                { status: 404 }
            )
        }
    } catch (error) {
        console.error('查询工单状态出错:', error)
        return NextResponse.json(
            { success: false, message: '查询工单状态时出错' },
            { status: 500 }
        )
    }
}
