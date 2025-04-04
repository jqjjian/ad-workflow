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
            console.log('jwt回调执行:', {
                tokenSub: token.sub,
                tokenRole: token.role,
                user: user
            })

            if (user) {
                token.user = user
                // 直接从登录用户设置角色
                if (user.role) {
                    token.role = user.role
                    console.log('从用户直接设置token角色:', user.role)
                }
            }

            if (!token.sub) return token

            // 从数据库获取最新用户信息
            const existingUser = await getUserbyId(token.sub)
            console.log('从数据库获取用户:', existingUser)

            if (!existingUser) return token

            // 更新token角色
            token.role = existingUser.role
            console.log('更新token角色为:', existingUser.role)

            return token
        },
        redirect({ url, baseUrl }) {
            // 处理相对路径
            if (url.startsWith('/')) return `${baseUrl}${url}`

            try {
                const urlObj = new URL(url)
                const baseUrlObj = new URL(baseUrl)
                const trustedHosts =
                    process.env.NEXTAUTH_TRUSTED_HOSTS?.split(',') || []

                // 允许同源或可信域名
                if (
                    urlObj.hostname === baseUrlObj.hostname ||
                    trustedHosts.includes(urlObj.hostname)
                ) {
                    return url
                }
            } catch (error) {
                console.error('Invalid redirect URL:', error)
            }
            return baseUrl // 默认安全路径
        }
        // redirect({ url, baseUrl }) {
        //     // 输出详细调试信息
        //     console.log('AUTH REDIRECT:', {
        //         url,
        //         baseUrl,
        //         nodeEnv: process.env.NODE_ENV,
        //         nextAuthUrl: process.env.NEXTAUTH_URL,
        //         nextAuthUrlInternal: process.env.NEXTAUTH_URL_INTERNAL,
        //         trustedHosts: process.env.NEXTAUTH_TRUSTED_HOSTS
        //     })

        //     // 1. 处理相对路径
        //     if (url.startsWith('/')) {
        //         const newUrl = `${baseUrl}${url}`
        //         console.log('返回相对路径:', newUrl)
        //         return newUrl
        //     }

        //     // 2. 尝试解析和验证URL
        //     try {
        //         // 解析URL并获取hostname
        //         const urlObj = new URL(url)
        //         const hostname = urlObj.hostname
        //         const baseUrlObj = new URL(baseUrl)

        //         // 检查是否为可信域名
        //         const trustedHosts = (process.env.NEXTAUTH_TRUSTED_HOSTS || '')
        //             .split(',')
        //             .map((h) => h.trim())

        //         console.log('URL检查:', {
        //             hostname,
        //             baseUrlHostname: baseUrlObj.hostname,
        //             trustedHosts,
        //             isSameHost: baseUrlObj.hostname === hostname,
        //             isTrusted: trustedHosts.includes(hostname)
        //         })

        //         // 如果是同一主机名，直接返回URL
        //         if (baseUrlObj.hostname === hostname) {
        //             return url
        //         }

        //         // 如果是受信任的主机名，直接返回URL
        //         if (trustedHosts.includes(hostname)) {
        //             return url
        //         }

        //         // 不受信任的主机名，返回基础URL
        //         console.log('不受信任的主机，重定向到:', baseUrl)
        //         return baseUrl
        //     } catch (error) {
        //         // 详细记录错误
        //         console.error('重定向URL解析错误:', {
        //             url,
        //             baseUrl,
        //             error:
        //                 error instanceof Error ? error.message : String(error)
        //         })

        //         // 如果URL无效，则返回默认重定向
        //         return baseUrl
        //     }
        // }
    },
    adapter: PrismaAdapter(db),
    session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
    // 解决UntrustedHost错误 - 在Docker环境中信任所有主机
    trustHost: true,
    cookies: {
        sessionToken: {
            name: 'next-auth.session-token',
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: false,
                domain: undefined
            }
        }
    }
} satisfies NextAuthConfig

export default authConfig
