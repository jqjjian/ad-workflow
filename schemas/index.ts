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

// 导出工单查询相关类型
export {
    QueryApplyRecordSchema,
    MediaAccountInfoSchema,
    type QueryApplyRecordDto,
    type MediaAccountInfo,
    type ApplicationRecord,
    type ApplyRecordData,
    type ApplyRecordResponse
} from './workorder/query'

// 导出TikTok相关类型
export { TiktokBusinessSchema, type TiktokBusiness } from './account/tiktok'

// 导出Google相关类型
export {
    GoogleAccountSchema,
    type GoogleAccount,
    type AuthItem as GoogleAuthItem
} from './account/google'

// 导出认证相关类型
export {
    LoginSchema,
    RegisterSchema,
    type LoginDto,
    type RegisterDto
} from './auth'

// 导出媒体账户搜索相关类型
export {
    MediaAccountsearchFormSchema,
    type MediaAccountsearch
} from './account/search'

// 此文件现在只用于集中导出，不再直接定义类型
