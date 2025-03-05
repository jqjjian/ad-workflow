'use server'
import { db } from '@/lib/db'
import {
    CreateDictionaryDto,
    UpdateDictionaryDto,
    QueryDictionaryDto
} from '@/schemas'
import { DictType } from '@/schemas'

// 创建字典
export async function createDictionary(data: CreateDictionaryDto) {
    return await db.dictionary.create({
        data: {
            ...data,
            items: {
                create: data.items
            }
        }
    })
}

// 更新字典
export async function updateDictionary(id: number, data: UpdateDictionaryDto) {
    return await db.dictionary.update({
        where: { id },
        data: {
            ...data,
            items: {
                upsert: data.items?.map((item) => ({
                    where: { id: item.id },
                    create: item,
                    update: item
                }))
            }
        }
    })
}

// 删除字典
export async function deleteDictionary(id: number) {
    return await db.dictionary.delete({
        where: { id }
    })
}

// 查询字典列表
export async function getDictionaries(params: QueryDictionaryDto) {
    const { page = 1, pageSize = 10 } = params
    const where: any = {}

    // 只有明确传入这些参数时才加入查询条件
    if (params.dictType) {
        where.dictType = params.dictType
    }
    if (params.dictCode) {
        where.dictCode = params.dictCode
    }
    if (params.dictName) {
        where.dictName = params.dictName
    }
    if (params.status !== undefined) {
        where.status = params.status
    }

    // 获取总数
    const total = await db.dictionary.count({ where })

    // 获取分页数据
    const list = await db.dictionary.findMany({
        where,
        include: {
            items: {
                orderBy: [{ sort: 'asc' }]
            }
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }]
    })

    return {
        list,
        total,
        page,
        pageSize
    }
}

// 根据类型和编码获取字典项
export async function getDictionaryItems(dictType: DictType, dictCode: string) {
    return await db.dictionary.findFirst({
        where: {
            dictType,
            dictCode,
            status: true
        },
        include: {
            items: {
                where: { status: true },
                orderBy: { sort: 'asc' }
            }
        }
    })
}

// 初始化字典测试数据
export async function initDictionaryData() {
    try {
        // 检查是否已有数据
        const count = await db.dictionary.count()
        if (count > 0) {
            return { message: '数据库中已有数据' }
        }

        // 添加测试数据
        await db.dictionary.createMany({
            data: [
                {
                    dictType: 'SYSTEM',
                    dictCode: 'USER_STATUS',
                    dictName: '用户状态',
                    status: true,
                    sort: 1
                },
                {
                    dictType: 'BUSINESS',
                    dictCode: 'ORDER_STATUS',
                    dictName: '订单状态',
                    status: true,
                    sort: 2
                }
            ]
        })

        // 添加字典项
        const userStatusDict = await db.dictionary.findFirst({
            where: { dictCode: 'USER_STATUS' }
        })

        if (userStatusDict) {
            await db.dictionaryItem.createMany({
                data: [
                    {
                        dictionaryId: userStatusDict.id,
                        itemCode: 'ENABLE',
                        itemName: '启用',
                        itemValue: '1',
                        status: true,
                        sort: 1
                    },
                    {
                        dictionaryId: userStatusDict.id,
                        itemCode: 'DISABLE',
                        itemName: '禁用',
                        itemValue: '0',
                        status: true,
                        sort: 2
                    }
                ]
            })
        }

        return { message: '初始化数据成功' }
    } catch (error) {
        console.error('初始化数据失败:', error)
        throw error
    }
}
