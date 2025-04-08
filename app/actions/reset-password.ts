'use server'
import * as z from 'zod'
import bcryptjs from 'bcryptjs'
import { db } from '@/lib/db'
import { ForgotPasswordSchema } from '@/schemas/auth'
import { getUserbyUsername } from '@/data/user'

/**
 * 重置密码
 * @param values 忘记密码表单数据
 * @returns 操作结果
 */
export const resetPassword = async (
    values: z.infer<typeof ForgotPasswordSchema>
) => {
    // 验证输入数据
    const validatedFields = ForgotPasswordSchema.safeParse(values)
    if (!validatedFields.success) {
        return {
            error: '表单数据验证失败'
        }
    }

    const { phoneNumber, verificationCode, newPassword } = validatedFields.data

    try {
        // 1. 验证用户是否存在
        const existingUser = await getUserbyUsername(phoneNumber)
        if (!existingUser || !existingUser.username) {
            return { error: '该手机号未注册' }
        }

        // 2. 验证验证码是否正确
        // TODO: 实际环境中需要从数据库或缓存中获取验证码进行比对
        // 这里是示例验证逻辑，实际应用需要调整
        const isValidCode = await verifyCode(phoneNumber, verificationCode)
        if (!isValidCode) {
            return { error: '验证码错误或已过期' }
        }

        // 3. 更新用户密码
        const hashedPassword = await bcryptjs.hash(newPassword, 10)
        await db.tecdo_users.update({
            where: { username: phoneNumber },
            data: {
                password: hashedPassword
            }
        })

        // 4. 密码重置成功
        return {
            success: '密码重置成功'
        }
    } catch (error) {
        console.error('重置密码失败:', error)
        return { error: '重置密码失败，请稍后再试' }
    }
}

/**
 * 验证手机验证码
 * @param phoneNumber 手机号
 * @param code 验证码
 * @returns 验证结果
 */
async function verifyCode(phoneNumber: string, code: string): Promise<boolean> {
    // 实际应用中，需要从数据库或缓存中获取验证码并比对
    // 这里仅作为示例返回true，表示验证通过
    // TODO: 实现实际的验证码校验逻辑

    // 假设在开发环境中，任何6位数都是有效的验证码
    if (
        process.env.NODE_ENV === 'development' &&
        code.length === 6 &&
        /^\d{6}$/.test(code)
    ) {
        return true
    }

    // 从数据库或Redis获取验证码并比对
    // const savedCode = await db.verificationCode.findFirst({
    //     where: {
    //         phoneNumber,
    //         code,
    //         expires: { gt: new Date() }
    //     }
    // })
    // return !!savedCode

    return true // 临时返回true，表示验证通过
}
