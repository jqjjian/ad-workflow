import * as z from 'zod'

// 字典类型枚举
export const DictTypeEnum = z.enum(['SYSTEM', 'BUSINESS', 'USER', 'OTHER'])
export type DictType = z.infer<typeof DictTypeEnum>

// 字典项验证模式
export const DictionaryItemSchema = z.object({
    id: z.number().int().optional(), // 创建时可选，更新时必填
    itemCode: z.string().min(1, '字典项编码不能为空'),
    itemName: z.string().min(1, '字典项名称不能为空'),
    itemValue: z.string().min(1, '字典项值不能为空'),
    description: z.string().optional(),
    status: z.boolean().default(true),
    sort: z.number().int().default(0)
})

// 字典主表验证模式
export const DictionarySchema = z.object({
    id: z.number().int().optional(),
    dictType: DictTypeEnum,
    dictCode: z.string().min(1, '字典编码不能为空'),
    dictName: z.string().min(1, '字典名称不能为空'),
    description: z.string().optional(),
    status: z.boolean().default(true),
    sort: z.number().int().default(0),
    items: z.array(DictionaryItemSchema).optional()
})

// 创建字典的验证模式
export const CreateDictionarySchema = DictionarySchema.omit({ id: true })

// 更新字典的验证模式
export const UpdateDictionarySchema = DictionarySchema.partial().extend({
    id: z.number().int().min(1, '字典ID不能为空')
})

// 查询字典的验证模式
export const QueryDictionarySchema = z.object({
    dictType: DictTypeEnum.optional(),
    dictCode: z.string().optional(),
    dictName: z.string().optional(),
    status: z.boolean().optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).default(10)
})

// 导出类型
export type DictionaryItem = z.infer<typeof DictionaryItemSchema>
export type Dictionary = z.infer<typeof DictionarySchema>
export type CreateDictionaryDto = z.infer<typeof CreateDictionarySchema>
export type UpdateDictionaryDto = z.infer<typeof UpdateDictionarySchema>
export type QueryDictionaryDto = z.infer<typeof QueryDictionarySchema>
export type CreateDictionaryItemDto = z.infer<typeof DictionaryItemSchema>
