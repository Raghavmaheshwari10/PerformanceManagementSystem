// Reads the Auth.js session and attaches it to each request.
// Route-level access control is enforced by getCurrentUser() / requireRole()
// in each server component — NOT by this middleware.
// Uses Edge-compatible auth config (no Prisma) to avoid Node.js-only modules in Edge Runtime.
import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'

const { auth } = NextAuth(authConfig)
export { auth as middleware }

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon\\.ico|login|unauthorized).*)',
  ],
}
