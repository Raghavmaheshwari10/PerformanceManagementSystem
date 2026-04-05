import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { compare } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@prisma/client'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email    = credentials?.email    as string | undefined
        const password = credentials?.password as string | undefined
        if (!email || !password) return null

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user || !user.password_hash || !user.is_active) return null

        const valid = await compare(password, user.password_hash)
        if (!valid) return null

        return {
          id:    user.id,
          email: user.email,
          name:  user.full_name,
          role:  user.role as UserRole,
        }
      },
    }),

    Google({
      clientId:     process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      // Google OAuth: user must already exist in users table
      if (account?.provider === 'google') {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
        })
        if (!dbUser || !dbUser.is_active) {
          return '/login?error=not_provisioned'
        }
        // Inject DB id and role for JWT callback
        user.id = dbUser.id
        user.role = dbUser.role as UserRole

        // Clear invite token on first Google sign-in (marks as accepted)
        if (dbUser.invite_token) {
          await prisma.user.update({
            where: { id: dbUser.id },
            data: { invite_token: null, invite_token_expires_at: null },
          })
        }
      }
      return true
    },

    async jwt({ token, user }) {
      if (user) {
        token.id   = user.id
        token.role = user.role
      }
      return token
    },

    async session({ session, token }) {
      session.user.id   = token.id as string
      session.user.role = token.role as UserRole
      return session
    },
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 60, // 30 minutes absolute max
  },

  pages: {
    signIn: '/login',
    error:  '/login',
  },
})
