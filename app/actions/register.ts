'use server'
import bcryptjs from 'bcryptjs'
import { RegisterSchema } from '@/schemas'
import { db } from '@/lib/db'
import * as z from 'zod'
import { getUserbyEmail, getUserbyUsername } from '@/data/user'
// import { sendVerificationEmail } from '@/lib/mail'
// import { generateVerificationToken } from '@/lib/tokens'
export const register = async (values: z.infer<typeof RegisterSchema>) => {
    console.log('values', values)
    const validatedFields = RegisterSchema.safeParse(values)
    if (!validatedFields.success) {
        return {
            error: '字段错误！'
        }
    }
    const { username, companyName, areaCode, email, password, name } =
        validatedFields.data
    const hashedPassword = await bcryptjs.hash(password, 10)
    const existingUser = await getUserbyEmail(email)
    const existingUsername = await getUserbyUsername(username)

    if (existingUser) {
        return {
            error: '邮箱已使用'
        }
    }
    if (existingUsername) {
        return {
            error: '用户名已使用'
        }
    }
    const user = await db.user.create({
        data: {
            username,
            companyName,
            areaCode,
            email,
            password: hashedPassword,
            name
        }
    })
    if (user) {
        return {
            success: '注册成功'
        }
    }
    // const verificationToken = await generateVerificationToken(email)
    // await sendVerificationEmail(
    //     verificationToken.email,
    //     verificationToken.token
    // )
    // // TODO: Send verification token email
    // return {
    //     success: '确认邮件已发送！'
    // }
    // console.log(values)
}
