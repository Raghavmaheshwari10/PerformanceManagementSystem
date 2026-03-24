/**
 * Edge-compatible Auth.js config — no Prisma, no Node.js-only modules.
 * Used by middleware.ts (Edge Runtime) for session reading.
 * The full config in auth.ts adds providers and DB-dependent callbacks.
 */
import type { NextAuthConfig } from 'next-auth'

export const authConfig: NextAuthConfig = {
  providers: [], // providers are not needed for session reading in middleware

  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id   = user.id
        token.role = user.role
      }
      return token
    },
    session({ session, token }) {
      session.user.id   = token.id as string
      session.user.role = token.role as import('@prisma/client').UserRole
      return session
    },
  },

  pages: {
    signIn: '/login',
    error:  '/login',
  },
}
