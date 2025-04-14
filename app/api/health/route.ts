import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * 健康检查API
 * 用于验证应用是否正常运行及环境配置
 */
export async function GET() {
    // 收集环境信息
    const envInfo = {
        timestamp: new Date().toISOString(),
        nextAuthUrl: process.env.NEXTAUTH_URL,
        nextAuthUrlInternal: process.env.NEXTAUTH_URL_INTERNAL,
        nodeEnv: process.env.NODE_ENV,
        cookieDomain: process.env.NEXTAUTH_COOKIE_DOMAIN,
        status: 'ok'
    }

    return NextResponse.json(envInfo, {
        status: 200,
        headers: {
            'Cache-Control':
                'no-store, no-cache, must-revalidate, proxy-revalidate',
            Pragma: 'no-cache',
            Expires: '0'
        }
    })
}
