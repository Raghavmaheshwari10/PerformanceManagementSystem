// Reads the Auth.js session and attaches it to each request.
// Route-level access control is enforced by getCurrentUser() / requireRole()
// in each server component — NOT by this middleware.
// The matcher excludes API auth routes and static assets to avoid conflicts.
export { auth as middleware } from '@/auth'

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon\\.ico|login|unauthorized).*)',
  ],
}
