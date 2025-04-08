'use server'
import * as z from 'zod'
import { VerificationCodeSchema } from '@/schemas/auth'
import { getUserbyUsername } from '@/data/user'

/**
 * 获取验证码
 * @param values 手机号
 * @returns 返回发送结果
 */
export const getVerificationCode = async (
    values: z.infer<typeof VerificationCodeSchema>
) => {
    // 验证输入
    const validatedFields = VerificationCodeSchema.safeParse(values)
    if (!validatedFields.success) {
        return {
            error: '手机号格式错误'
        }
    }

    const { phoneNumber } = validatedFields.data

    // 检查用户是否存在
    const existingUser = await getUserbyUsername(phoneNumber)
    if (!existingUser || !existingUser.username) {
        return { error: '该手机号未注册' }
    }

    try {
        // 这里是生成验证码并发送的逻辑
        // 通常包括：
        // 1. 生成6位随机数字验证码
        // 2. 将验证码与手机号关联存储（数据库或缓存）
        // 3. 通过短信服务发送验证码

        // 模拟生成6位验证码
        const verificationCode = Math.floor(
            100000 + Math.random() * 900000
        ).toString()

        // TODO: 在实际环境中，需要将验证码存储到数据库或Redis等
        // 并调用短信服务API发送验证码
        console.log(`向 ${phoneNumber} 发送验证码: ${verificationCode}`)

        return {
            success: '验证码已发送',
            // 在测试环境中可以返回验证码，生产环境应移除
            code:
                process.env.NODE_ENV === 'development'
                    ? verificationCode
                    : undefined
        }
    } catch (error) {
        console.error('发送验证码失败:', error)
        return { error: '发送验证码失败，请稍后再试' }
    }
}
