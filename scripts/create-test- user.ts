import { db } from '@/lib/db'
import { hash } from 'bcryptjs'

async function createTestUser() {
    try {
        // 检查测试用户是否已存在
        const existingUser = await db.tecdo_users.findUnique({
            where: {
                email: 'test@example.com'
            }
        })

        if (existingUser) {
            console.log('测试用户已存在，ID:', existingUser.id)
            return existingUser.id
        }

        // 创建测试用户
        const hashedPassword = await hash('test123456', 10)
        const testUser = await db.tecdo_users.create({
            data: {
                username: 'testuser',
                name: '测试账户',
                email: 'test@example.com',
                password: hashedPassword,
                role: 'USER', // 根据你的枚举值
                status: 'ACTIVE'
                // ... 其他必要字段
            }
        })

        console.log('测试用户创建成功，ID:', testUser.id)
        return testUser.id
    } catch (error) {
        console.error('创建测试用户失败:', error)
        throw error
    }
}

// 直接执行
createTestUser()
    .then((id) => {
        console.log(`测试用户ID: ${id}`)
        process.exit(0)
    })
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
