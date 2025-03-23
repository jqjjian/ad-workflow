import { db } from '@/lib/db'
import { MediaAccount, MediaPlatform, MediaAccountStatus } from '@prisma/client'
import { BusinessError } from '@/utils/business-error'
import { ErrorCode } from '@/constants/error-codes'

export class MediaAccountService {
    constructor(private readonly userId: string) {}

    // 获取用户的所有媒体账户
    async getUserMediaAccounts(params: {
        mediaPlatform?: MediaPlatform
        status?: MediaAccountStatus
        searchTerm?: string
    }): Promise<MediaAccount[]> {
        return await db.tecdo_media_accounts.findMany({
            where: {
                userId: this.userId,
                isDeleted: false,
                ...(params.mediaPlatform && {
                    mediaPlatform: params.mediaPlatform
                }),
                ...(params.status && { accountStatus: params.status }),
                ...(params.searchTerm && {
                    OR: [
                        { accountName: { contains: params.searchTerm } },
                        { platformId: { contains: params.searchTerm } }
                    ]
                })
            },
            orderBy: { createdAt: 'desc' }
        })
    }

    // 获取单个媒体账户详情
    async getMediaAccount(mediaAccountId: string): Promise<MediaAccount> {
        const account = await db.tecdo_media_accounts.findFirst({
            where: {
                id: mediaAccountId,
                userId: this.userId,
                isDeleted: false
            }
        })

        if (!account) {
            throw new BusinessError(
                '媒体账户不存在',
                ErrorCode.RESOURCE_NOT_FOUND
            )
        }

        return account
    }

    // 验证媒体账户是否属于当前用户
    async validateMediaAccountOwnership(
        mediaAccountId: string
    ): Promise<boolean> {
        const count = await db.tecdo_media_accounts.count({
            where: {
                id: mediaAccountId,
                userId: this.userId,
                isDeleted: false
            }
        })
        return count > 0
    }

    // 检查媒体账户状态是否允许操作
    async validateMediaAccountStatus(
        mediaAccountId: string,
        allowedStatuses: MediaAccountStatus[]
    ): Promise<void> {
        const account = await this.getMediaAccount(mediaAccountId)

        if (!allowedStatuses.includes(account.accountStatus)) {
            throw new BusinessError(
                '当前账户状态不允许此操作',
                ErrorCode.STATUS_ERROR
            )
        }
    }

    // 同步媒体账户信息
    async syncMediaAccountInfo(mediaAccountId: string): Promise<void> {
        const account = await this.getMediaAccount(mediaAccountId)

        try {
            // 开始事务
            await db.$transaction(async (tx) => {
                // 记录同步开始
                const syncLog = await tx.tecdo_media_accountsSyncLog.create({
                    data: {
                        mediaAccountId,
                        syncType: 'ACCOUNT_INFO',
                        syncStatus: 'PROCESSING',
                        beforeData: account
                    }
                })

                // 调用平台API获取最新数据
                const updatedInfo = await this.fetchMediaAccountInfo(account)

                // 更新账户信息
                await tx.tecdo_media_accounts.update({
                    where: { id: mediaAccountId },
                    data: {
                        balance: updatedInfo.balance,
                        accountStatus: updatedInfo.status,
                        dailyBudget: updatedInfo.dailyBudget,
                        totalSpent: updatedInfo.totalSpent,
                        metadata: updatedInfo.metadata,
                        lastSyncTime: new Date()
                    }
                })

                // 更新同步记录
                await tx.tecdo_media_accountsSyncLog.update({
                    where: { id: syncLog.id },
                    data: {
                        syncStatus: 'SUCCESS',
                        afterData: updatedInfo
                    }
                })
            })
        } catch (error) {
            // 记录同步失败
            await db.tecdo_media_accountsSyncLog.create({
                data: {
                    mediaAccountId,
                    syncType: 'ACCOUNT_INFO',
                    syncStatus: 'FAILED',
                    errorMessage:
                        error instanceof Error ? error.message : '同步失败'
                }
            })

            throw new BusinessError(
                '同步媒体账户信息失败',
                ErrorCode.THIRD_PARTY_ERROR
            )
        }
    }

    // 从平台获取账户信息的抽象方法
    protected async fetchMediaAccountInfo(account: MediaAccount): Promise<any> {
        // 根据不同平台实现具体的API调用
        switch (account.mediaPlatform) {
            case 'FACEBOOK':
                return this.fetchFacebookAccountInfo(account)
            case 'GOOGLE':
                return this.fetchGoogleAccountInfo(account)
            case 'TIKTOK':
                return this.fetchTiktokAccountInfo(account)
            case 'MICROSOFT_ADVERTISING':
                return this.fetchMicrosoftAccountInfo(account)
            default:
                throw new BusinessError(
                    '不支持的媒体平台',
                    ErrorCode.INVALID_PARAMETER
                )
        }
    }

    // 各平台具体的实现方法
    private async fetchFacebookAccountInfo(account: MediaAccount) {
        // 实现Facebook平台的API调用
    }

    private async fetchGoogleAccountInfo(account: MediaAccount) {
        // 实现Google平台的API调用
    }

    private async fetchTiktokAccountInfo(account: MediaAccount) {
        // 实现TikTok平台的API调用
    }

    private async fetchMicrosoftAccountInfo(account: MediaAccount) {
        // 实现Microsoft平台的API调用
    }
}
