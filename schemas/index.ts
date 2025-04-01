// 导出account-common中的公共枚举和类型
export {
    AuthRoleEnum,
    ProductTypeEnum,
    MediaPlatformEnum,
    WorkOrderStatusEnum,
    AuthItemSchema,
    BaseAccountSchema,
    AttachmentSchema,
    type Attachment,
    type AuthItem,
    type BaseAccount,
    type CompanyBase,
    type MediaAccountInfoBase,
    type MediaAccountSearchBase
} from './account-common'

// 导出字典相关类型
export {
    DictTypeEnum,
    DictionaryItemSchema,
    DictionarySchema,
    CreateDictionarySchema,
    UpdateDictionarySchema,
    QueryDictionarySchema,
    type DictType,
    type DictionaryItem,
    type Dictionary,
    type CreateDictionaryDto,
    type UpdateDictionaryDto,
    type QueryDictionaryDto,
    type CreateDictionaryItemDto
} from './dictionary/types'

// 导出账户管理相关Schema
export {
    DepositSchema,
    WithdrawalSchema,
    TransferSchema,
    AccountBindSchema,
    PixelBindSchema,
    EmailBindSchema,
    type Deposit,
    type Withdrawal,
    type Transfer,
    type AccountBind,
    type PixelBind,
    type EmailBind
} from './account-management'

// 从 mediaAccount.ts 导出媒体账户相关类型
export {
    MediaAccountSearchSchema,
    MediaAccountSchema,
    MediaAccountInfoSchema,
    QueryApplyRecordSchema,
    type MediaAccountSearch,
    type MediaAccount,
    type MediaAccountInfo,
    type MediaAccountSearchResult,
    type MediaAccountResponse,
    type QueryApplyRecordDto,
    type ApplicationRecord,
    type ApplyRecordData,
    type ApplyRecordResponse
} from './mediaAccount'

// 从 workorder.ts 导出工单相关类型
export { WorkOrderQuerySchema, type WorkOrderQuery } from './workorder'

// 此文件现在只用于集中导出，不再直接定义类型
