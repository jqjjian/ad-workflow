import { MediaAccountService } from '@/services/media-account-service'
import { withAuth } from '@/lib/auth-actions'
import { ApiResponse } from '@/types/api'
import { MediaPlatform, MediaAccountStatus } from '@prisma/client'

// 获取用户的媒体账户列表
export async function getUserMediaAccounts(
    params: {
        mediaPlatform?: MediaPlatform
        status?: MediaAccountStatus
        searchTerm?: string
    },
    userId: string
): Promise<ApiResponse> {
    return withAuth(async () => {
        const service = new MediaAccountService(userId)
        const accounts = await service.getUserMediaAccounts(params)

        return {
            success: true,
            code: '0',
            message: '获取成功',
            data: accounts
        }
    })
}

// 获取媒体账户详情
export async function getMediaAccountDetail(
    mediaAccountId: string,
    userId: string
): Promise<ApiResponse> {
    return withAuth(async () => {
        const service = new MediaAccountService(userId)
        const account = await service.getMediaAccount(mediaAccountId)

        return {
            success: true,
            code: '0',
            message: '获取成功',
            data: account
        }
    })
}

// 同步媒体账户信息
export async function syncMediaAccount(
    mediaAccountId: string,
    userId: string
): Promise<ApiResponse> {
    return withAuth(async () => {
        const service = new MediaAccountService(userId)
        await service.syncMediaAccountInfo(mediaAccountId)

        return {
            success: true,
            code: '0',
            message: '同步成功'
        }
    })
}
