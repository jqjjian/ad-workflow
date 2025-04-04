import NextAuth from 'next-auth'
import authConfig from '@/auth.config'

export const { auth, handlers, signOut, signIn } = NextAuth({
    ...authConfig,
    trustHost: true,
    debug: true,
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
    }
})
