import NextAuth from 'next-auth'
import authConfig from '@/auth.config'

export const { auth, handlers, signOut, signIn } = NextAuth({
    ...authConfig,
    trustHost: true,
    debug: process.env.NODE_ENV !== 'production',
    cookies: {
        ...authConfig.cookies,
        csrfToken: {
            name: `next-auth.csrf-token`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production'
            }
        }
    },
    events: {
        ...authConfig.events,
        signOut: async (message) => {
            console.log('用户登出事件触发', message)
            // 可以在这里添加登出相关的清理逻辑
        }
    }
})
