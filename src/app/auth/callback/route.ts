import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Fetch user role and redirect to appropriate dashboard
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: dbUser } = await supabase
          .from('users')
          .select('role')
          .eq('email', user.email)
          .single()

        const rolePath = dbUser?.role === 'admin' ? '/admin'
          : dbUser?.role === 'hrbp' ? '/hrbp'
          : dbUser?.role === 'manager' ? '/manager'
          : '/employee'

        return NextResponse.redirect(`${origin}${rolePath}`)
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
