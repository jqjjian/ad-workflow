import * as z from 'zod'
import { MediaAccountSearchBaseSchema } from '../account-common'

// 媒体账户搜索表单
export const MediaAccountsearchFormSchema = MediaAccountSearchBaseSchema

export type MediaAccountsearch = z.infer<typeof MediaAccountsearchFormSchema>
