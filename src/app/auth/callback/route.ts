import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function redirectByRole(supabase: Awaited<ReturnType<typeof createClient>>, origin: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login?error=auth`)

  const { data: dbUser } = await supabase
    .from('users')
    .select('role')
    .eq('email', user.email)
    .single()

  if (!dbUser) {
    // User authenticated with Google but not provisioned in public.users
    return NextResponse.redirect(`${origin}/auth/not-provisioned`)
  }

  const rolePath = dbUser.role === 'admin' ? '/admin'
    : dbUser.role === 'hrbp' ? '/hrbp'
    : dbUser.role === 'manager' ? '/manager'
    : '/employee'

  return NextResponse.redirect(`${origin}${rolePath}`)
}

export async function GET(request: Request) {
  const { searchParams, origin: rawOrigin } = new URL(request.url)
  const origin = rawOrigin
  const code = searchParams.get('code')
  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      const msg = error.message ?? ''
      if (msg.toLowerCase().includes('forbidden') || msg.includes('not_provisioned')) {
        return NextResponse.redirect(`${origin}/auth/not-provisioned`)
      }
      return NextResponse.redirect(`${origin}/login?error=auth`)
    }
    return redirectByRole(supabase, origin)
  }

  // Password login — session already set client-side, just redirect by role
  return redirectByRole(supabase, origin)
}
