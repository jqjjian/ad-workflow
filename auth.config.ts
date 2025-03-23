import { NextAuthConfig } from 'next-auth'
import CredentialProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from '@/lib/db'
import { UserRole } from '@prisma/client'
import { getUserbyId, getUserbyUsername } from '@/data/user'
import { LoginSchema } from '@/schemas/auth'
import bcryptjs from 'bcryptjs'
// import GithubProvider from 'next-auth/providers/github'
// import GoogleProvider from 'next-auth/providers/google'
// import { createAppClient, viemConnector } from '@farcaster/auth-client'
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
        signIn: '/' //sigin page
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
            console.log('account', account)
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
            if (token.sub && session.user) {
                session.user.id = token.sub
            }
            if (token.role && session.user) {
                session.user.role = token.role as UserRole
            }
            return session
        },
        async jwt({ token }) {
            if (!token.sub) return token
            const existingUser = await getUserbyId(token.sub)
            if (!existingUser) return token
            token.role = existingUser.role
            return token
        }
    },
    adapter: PrismaAdapter(db),
    session: { strategy: 'jwt' }
} satisfies NextAuthConfig

export default authConfig
