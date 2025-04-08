import * as z from 'zod'

export const LoginSchema = z.object({
    username: z.string({ required_error: '用户名不能为空' }),
    // .min(11, {
    //     message: '手机号不能少于11位'
    // }),
    password: z.string({ required_error: '密码不能为空' }).min(6, {
        message: '密码不能少于6位'
    })
    // remember: z.boolean().optional()
})

export const RegisterSchema = z.object({
    email: z.string({ required_error: '邮箱不能为空' }).email({
        message: '邮箱格式不正确'
    }),
    password: z.string({ required_error: '密码不能为空' }).min(6, {
        message: '密码不能少于6位'
    }),
    verifyCode: z.string({ required_error: '验证码不能为空' }),
    username: z.string({ required_error: '手机号不能为空' }),
    name: z.string(),
    companyName: z.string({ required_error: '公司名称不能为空' }),
    areaCode: z.string({ required_error: '区号不能为空' })
})

export const ForgotPasswordSchema = z
    .object({
        phoneNumber: z
            .string({ required_error: '手机号不能为空' })
            .regex(/^1[3-9]\d{9}$/, { message: '请输入有效的手机号' }),
        verificationCode: z
            .string({ required_error: '验证码不能为空' })
            .length(6, { message: '验证码长度应为6位' }),
        newPassword: z
            .string({ required_error: '新密码不能为空' })
            .min(8, { message: '密码长度至少8位' })
            .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, {
                message: '密码必须包含大小写字母和数字'
            }),
        confirmPassword: z.string({ required_error: '确认密码不能为空' })
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: '两次输入的密码不一致',
        path: ['confirmPassword']
    })

export const VerificationCodeSchema = z.object({
    phoneNumber: z
        .string({ required_error: '手机号不能为空' })
        .regex(/^1[3-9]\d{9}$/, { message: '请输入有效的手机号' })
})

export type LoginDto = z.infer<typeof LoginSchema>
export type RegisterDto = z.infer<typeof RegisterSchema>
