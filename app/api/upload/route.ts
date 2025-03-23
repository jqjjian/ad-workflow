import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        // 模拟处理上传的文件
        // 在实际场景中，这里会处理FormData并保存文件

        // 模拟一个随机文件名
        const randomId = Math.random().toString(36).substring(2, 10)

        // 返回模拟的文件上传结果
        return NextResponse.json({
            success: true,
            url: `https://example.com/uploads/business_license_${randomId}.jpg`,
            fileName: `business_license_${randomId}.jpg`,
            fileType: 'image/jpeg',
            fileSize: Math.floor(Math.random() * 1000000) + 100000, // 100KB-1MB之间的随机大小
            filePath: `/uploads/business_license_${randomId}.jpg`,
            ossObjectKey: `business-licenses/business_license_${randomId}.jpg`,
            description: '营业执照'
        })
    } catch (error) {
        console.error('上传文件失败:', error)
        return NextResponse.json(
            { success: false, message: '文件上传失败' },
            { status: 500 }
        )
    }
}

// 如果需要支持OPTIONS请求(CORS)
export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
    })
}
