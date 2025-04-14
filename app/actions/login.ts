'use server'
import { signIn } from '@/auth'
import { getUserbyUsername } from '@/data/user'
import { db } from '@/lib/db'
// import { sendVerificationEmail } from '@/lib/mail'
// import { generateVerificationToken } from '@/lib/tokens'
import { DEFAULT_LOGIN_REDIRECT } from '@/routes'
import { LoginSchema } from '@/schemas/auth'
import { AuthError } from 'next-auth'

import * as z from 'zod'
export const login = async (values: z.infer<typeof LoginSchema>) => {
    const validatedFields = LoginSchema.safeParse(values)
    if (!validatedFields.success) {
        return {
            error: '字段错误！'
        }
    }
    const { username, password } = validatedFields.data

    const existingUser = await getUserbyUsername(username)
    if (!existingUser || !existingUser.username || !existingUser.password) {
        return { error: '用户名不存在' }
    }

    console.log('用户信息:', {
        id: existingUser.id,
        username: existingUser.username,
        role: existingUser.role
    })

    // if (!existingUser.emailVerified) {
    //     const verificationToken = await generateVerificationToken(
    //         existingUser.email
    //     )
    //     if (!verificationToken) {
    //         return { error: '验证邮件发送失败' }
    //     }
    //     await sendVerificationEmail(
    //         verificationToken.email,
    //         verificationToken.token
    //     )
    //     return { success: '邮箱未验证，已重新发送确认邮件！' }
    // }
    try {
        const res = await signIn('credentials', {
            username,
            password,
            redirect: false
        })
        console.log('登录响应:', res)

        // 更新用户最后登录时间和登录次数
        if (res?.ok) {
            try {
                await db.tecdo_users.update({
                    where: { id: existingUser.id },
                    data: {
                        lastLoginAt: new Date(),
                        loginCount: {
                            increment: 1
                        },
                        updatedAt: new Date()
                    }
                })
                console.log('已更新用户登录信息')
            } catch (updateError) {
                console.error('更新用户登录信息失败:', updateError)
                // 不影响登录流程，仅记录错误
            }
        }

        return {
            success: '登录成功',
            user: {
                id: existingUser.id,
                role: existingUser.role
            }
        }
    } catch (error) {
        console.log('error', error)
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return { error: '凭证无效' }
                default:
                    return { error: '发生错误' }
            }
        }
        throw error
        // TODO
    }
}
