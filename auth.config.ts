import { NextAuthConfig } from 'next-auth'
import CredentialProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from '@/lib/db'
import { UserRole } from '@prisma/client'
import { getUserbyId, getUserbyUsername } from '@/data/user'
import { LoginSchema } from '@/schemas/auth'
import bcryptjs from 'bcryptjs'
import { DefaultSession } from 'next-auth'
// import GithubProvider from 'next-auth/providers/github'
// import GoogleProvider from 'next-auth/providers/google'
// import { createAppClient, viemConnector } from '@farcaster/auth-client'

// 确保正确导入你的Session类型
type UserSession = {
    id: string
    role?: UserRole
} & DefaultSession['user']

const authConfig = {
    providers: [
        // GithubProvider({
        //     clientId: process.env.GITHUB_ID ?? '',
        //     clientSecret: process.env.GITHUB_SECRET ?? ''
        // }),
        // GoogleProvider({
        //     clientId: process.env.GOOGLE_ID ?? '',
        //     clientSecret: process.env.GOOGLE_SECRET ?? ''
        // }),
        CredentialProvider({
            id: 'credentials',
            name: 'Sign in with Username',
            credentials: {
                username: {
                    type: 'username'
                },
                password: {
                    type: 'password'
                }
            },
            async authorize(credentials, req) {
                console.log('credentials', credentials)
                const validatedFields = LoginSchema.safeParse(credentials)
                if (validatedFields.success) {
                    console.log('validatedFields', validatedFields)
                    const { username, password } = validatedFields.data
                    const user = await getUserbyUsername(username)
                    console.log('user', user)
                    if (!user || !user.password) return null
                    const passwordsMatch = await bcryptjs.compare(
                        password,
                        user.password
                    )
                    console.log('passwordsMatch', passwordsMatch)
                    if (passwordsMatch) return user
                }
                return null
            }
        })
    ],
    pages: {
        signIn: '/login' //sigin page
    },
    events: {
        async linkAccount({ user }) {
            await db.tecdo_users.update({
                where: { id: user.id },
                data: {
                    email_verified: new Date()
                }
            })
        },
        async signIn({ user }) {
            // 更新用户的最后登录时间和登录次数
            try {
                if (user && user.id) {
                    await db.tecdo_users.update({
                        where: { id: user.id },
                        data: {
                            lastLoginAt: new Date(),
                            loginCount: {
                                increment: 1
                            },
                            updatedAt: new Date()
                        }
                    })
                    console.log(`已更新用户 ${user.id} 的登录信息`)
                }
            } catch (error) {
                console.error('更新用户登录信息失败:', error)
                // 不影响登录流程，仅记录错误
            }
        }
    },
    callbacks: {
        async signIn({ user, account }) {
            console.log('signIn回调:', {
                user,
                account,
                provider: account?.provider
            })
            if (account?.provider !== 'credentials') return true
            if (account?.provider === 'credentials') {
                console.log('user', user)
                return true
            }
            const existingUser = await getUserbyId(user.id as string)
            if (!existingUser || !existingUser.email_verified) return false

            return true
        },
        async session({ token, session }) {
            console.log('session回调执行:', {
                tokenSub: token.sub,
                tokenRole: token.role,
                session: session
            })

            if (token.sub && session.user) {
                session.user.id = token.sub
            }

            if (token.role && session.user) {
                session.user.role = token.role as UserRole
                console.log('已设置会话用户角色:', token.role)
            }

            // 额外检查确认角色已设置
            // if (!session.user?.role && token.user && 'role' in token?.user) {
            //     // 直接设置role属性，不重新创建整个user对象
            //     if (session.user) {
            //         session.user.role = (token.user as any).role
            //     }
            // }

            console.log('返回的会话:', session)
            return session
        },
        async jwt({ token, user }) {
            // 只在用户首次登录时设置角色
            if (user) {
                token.user = user
                if (user.role) {
                    token.role = user.role
                }
                return token
            }

            // 优化：不要每次都查询数据库
            // 只在token没有角色信息时查询
            if (token.sub && !token.role) {
                const existingUser = await getUserbyId(token.sub)
                if (existingUser?.role) {
                    token.role = existingUser.role
                }
            }

            return token
        },
        redirect({ url, baseUrl }) {
            // 简化逻辑，避免异常

            // 处理相对路径
            if (url.startsWith('/')) {
                return `${baseUrl}${url}`
            }

            // 直接返回URL，信任框架的安全检查
            // NextAuth已内置基本的安全验证
            return url
        }
    },
    adapter: PrismaAdapter(db),
    session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
    // 解决UntrustedHost错误 - 在Docker环境中信任所有主机
    trustHost: true,
    // 使用统一的SECRET密钥
    secret: process.env.NEXTAUTH_SECRET,
    cookies: {
        sessionToken: {
            name: 'next-auth.session-token',
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: false,
                domain: undefined,
                maxAge: 7 * 24 * 60 * 60
            }
        },
        callbackUrl: {
            name: 'next-auth.callback-url',
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: false,
                domain: undefined,
                maxAge: 7 * 24 * 60 * 60
            }
        },
        csrfToken: {
            name: 'next-auth.csrf-token',
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: false,
                domain: undefined,
                maxAge: 7 * 24 * 60 * 60
            }
        }
    }
} satisfies NextAuthConfig

export default authConfig
