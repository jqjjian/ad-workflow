import { PrismaClient, DictType, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 开始初始化系统基础数据...')

    // 创建超级管理员用户
    const hashedPasswordAdmin = await bcrypt.hash('Admin@123456', 10)
    const adminUser = await prisma.tecdo_users.upsert({
        where: { email: 'admin@example.com' },
        update: {},
        create: {
            email: 'admin@example.com',
            username: 'admin',
            name: '超级管理员',
            password: hashedPasswordAdmin,
            role: UserRole.SUPER_ADMIN,
            phoneNumber: '13800000000',
            areaCode: '+86',
            companyName: '广告工单系统'
        }
    })
    console.log('✅ 创建超级管理员用户成功:', adminUser.username)

    // 创建普通用户
    const hashedPasswordUser = await bcrypt.hash('User@123456', 10)
    const normalUser = await prisma.tecdo_users.upsert({
        where: { email: 'user@example.com' },
        update: {},
        create: {
            email: 'user@example.com',
            username: 'user',
            name: '测试用户',
            password: hashedPasswordUser,
            role: UserRole.USER,
            phoneNumber: '13900000000',
            areaCode: '+86',
            companyName: '测试公司'
        }
    })
    console.log('✅ 创建普通用户成功:', normalUser.username)

    // 创建产品类型字典
    const productTypeDictionary = await prisma.dictionary.upsert({
        where: {
            dictType_dictCode: {
                dictType: DictType.BUSINESS,
                dictCode: 'PRODUCT_TYPE'
            }
        },
        update: {},
        create: {
            dictType: DictType.BUSINESS,
            dictCode: 'PRODUCT_TYPE',
            dictName: '产品类型(行业类型)',
            description: '广告投放产品类型',
            status: true,
            sort: 1
        }
    })

    // 创建产品类型字典项
    const productTypes = [
        { code: '0', name: '其他', value: '0' },
        { code: '1', name: '游戏', value: '1' },
        { code: '2', name: 'App', value: '2' },
        { code: '3', name: '电商', value: '3' }
    ]

    for (const item of productTypes) {
        await prisma.dictionaryItem.upsert({
            where: {
                dictionaryId_itemCode: {
                    dictionaryId: productTypeDictionary.id,
                    itemCode: item.code
                }
            },
            update: {},
            create: {
                dictionaryId: productTypeDictionary.id,
                itemCode: item.code,
                itemName: item.name,
                itemValue: item.value,
                status: true,
                sort: parseInt(item.code)
            }
        })
    }
    console.log('✅ 创建产品类型字典成功')

    // 创建Google时区字典
    const googleTimezoneDictionary = await prisma.dictionary.upsert({
        where: {
            dictType_dictCode: {
                dictType: DictType.BUSINESS,
                dictCode: 'GOOGLE_TIMEZONE'
            }
        },
        update: {},
        create: {
            dictType: DictType.BUSINESS,
            dictCode: 'GOOGLE_TIMEZONE',
            dictName: 'Google时区',
            description: 'Google广告平台支持的时区',
            status: true,
            sort: 2
        }
    })

    // Google时区列表（从图片中提取）
    const googleTimezones = [
        { code: 'Asia/Amman', name: 'Asia/Amman', value: 'UTC+3' },
        { code: 'Asia/Baghdad', name: 'Asia/Baghdad', value: 'UTC+3' },
        { code: 'Asia/Bahrain', name: 'Asia/Bahrain', value: 'UTC+3' },
        { code: 'Asia/Bangkok', name: 'Asia/Bangkok', value: 'UTC+7' },
        { code: 'Asia/Beirut', name: 'Asia/Beirut', value: 'UTC+3' },
        { code: 'Asia/Colombo', name: 'Asia/Colombo', value: 'UTC+5:30' },
        { code: 'Asia/Dhaka', name: 'Asia/Dhaka', value: 'UTC+6' },
        { code: 'Asia/Dubai', name: 'Asia/Dubai', value: 'UTC+4' },
        { code: 'Asia/Gaza', name: 'Asia/Gaza', value: 'UTC+2' },
        { code: 'Asia/Ho_Chi_Minh', name: 'Asia/Ho_Chi_Minh', value: 'UTC+7' },
        { code: 'Asia/Hong_Kong', name: 'Asia/Hong_Kong', value: 'UTC+8' },
        { code: 'Asia/Irkutsk', name: 'Asia/Irkutsk', value: 'UTC+8' },
        { code: 'Asia/Jakarta', name: 'Asia/Jakarta', value: 'UTC+7' }
    ]

    for (let i = 0; i < googleTimezones.length; i++) {
        const item = googleTimezones[i]
        await prisma.dictionaryItem.upsert({
            where: {
                dictionaryId_itemCode: {
                    dictionaryId: googleTimezoneDictionary.id,
                    itemCode: item.code
                }
            },
            update: {},
            create: {
                dictionaryId: googleTimezoneDictionary.id,
                itemCode: item.code,
                itemName: item.name,
                itemValue: item.value,
                status: true,
                sort: i
            }
        })
    }
    console.log('✅ 创建Google时区字典成功')

    // 创建TikTok时区字典
    const tiktokTimezoneDictionary = await prisma.dictionary.upsert({
        where: {
            dictType_dictCode: {
                dictType: DictType.BUSINESS,
                dictCode: 'TIKTOK_TIMEZONE'
            }
        },
        update: {},
        create: {
            dictType: DictType.BUSINESS,
            dictCode: 'TIKTOK_TIMEZONE',
            dictName: 'TikTok时区',
            description: 'TikTok广告平台支持的时区',
            status: true,
            sort: 3
        }
    })

    // TikTok时区列表（从图片中提取）
    const tiktokTimezones = [
        { code: 'Africa/Accra', name: '非洲/阿克拉', value: 'UTC+00:00' },
        { code: 'Africa/Cairo', name: '非洲/开罗', value: 'UTC+02:00' },
        {
            code: 'Africa/Casablanca',
            name: '非洲/卡萨布兰卡',
            value: 'UTC+00:00'
        },
        {
            code: 'Africa/Johannesburg',
            name: '非洲/约翰内斯堡',
            value: 'UTC+02:00'
        },
        { code: 'Africa/Lagos', name: '非洲/拉各斯', value: 'UTC+01:00' },
        { code: 'Africa/Nairobi', name: '非洲/内罗毕', value: 'UTC+03:00' },
        { code: 'Africa/Tunis', name: '非洲/突尼斯', value: 'UTC+01:00' },
        {
            code: 'America/Anchorage',
            name: '美洲/安克雷奇',
            value: 'UTC-09:00'
        },
        {
            code: 'America/Argentina/Buenos_Aires',
            name: '美洲/阿根廷/布宜诺斯艾利斯',
            value: 'UTC-03:00'
        },
        {
            code: 'America/Argentina/Salta',
            name: '美洲/阿根廷/萨尔塔',
            value: 'UTC-03:00'
        },
        {
            code: 'America/Argentina/San_Luis',
            name: '美洲/阿根廷/圣路易斯',
            value: 'UTC-03:00'
        },
        { code: 'America/Asuncion', name: '美洲/亚松森', value: 'UTC-04:00' },
        { code: 'America/Atikokan', name: '美国/阿提科坎', value: 'UTC-05:00' },
        { code: 'America/Bahia', name: '美洲/贝伦', value: 'UTC-03:00' }
    ]

    for (let i = 0; i < tiktokTimezones.length; i++) {
        const item = tiktokTimezones[i]
        await prisma.dictionaryItem.upsert({
            where: {
                dictionaryId_itemCode: {
                    dictionaryId: tiktokTimezoneDictionary.id,
                    itemCode: item.code
                }
            },
            update: {},
            create: {
                dictionaryId: tiktokTimezoneDictionary.id,
                itemCode: item.code,
                itemName: item.name,
                itemValue: item.value,
                status: true,
                sort: i
            }
        })
    }
    console.log('✅ 创建TikTok时区字典成功')

    console.log('✅ 所有数据初始化完成！')
}

main()
    .catch((e) => {
        console.error('❌ 数据初始化失败:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
