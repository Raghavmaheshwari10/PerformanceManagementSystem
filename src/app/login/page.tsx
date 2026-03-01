'use client'

import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useState } from 'react'

const TEST_ACCOUNTS = [
  { label: 'Admin',   email: 'admin@test.com',    password: 'admin123' },
  { label: 'Alice',   email: 'manager@test.com',  password: 'manager123' },
  { label: 'Frank',   email: 'frank@test.com',    password: 'frank123' },
  { label: 'Bob',     email: 'employee@test.com', password: 'employee123' },
  { label: 'Dave',    email: 'dave@test.com',     password: 'dave123' },
  { label: 'Eve',     email: 'eve@test.com',      password: 'eve123' },
  { label: 'Grace',   email: 'grace@test.com',    password: 'grace123' },
  { label: 'Henry',   email: 'henry@test.com',    password: 'henry123' },
  { label: 'Irene',   email: 'irene@test.com',    password: 'irene123' },
  { label: 'HRBP',    email: 'hrbp@test.com',     password: 'hrbp123' },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }
    const role = data.session?.access_token
      ? JSON.parse(atob(data.session.access_token.split('.')[1])).user_role
      : null
    const path = role === 'admin' ? '/admin'
      : role === 'hrbp' ? '/hrbp'
      : role === 'manager' ? '/manager'
      : '/employee'
    window.location.href = path
  }

  async function handleMagicLink() {
    if (!email) { setMessage('Enter your email first.'); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    setMessage(error ? error.message : 'Check your email for the login link.')
    setLoading(false)
  }

  async function handleGoogleLogin() {
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          hd: 'embglobal.com',
          access_type: 'online',
          prompt: 'select_account',
        },
      },
    })
    if (error) {
      setMessage(error.message)
      setLoading(false)
    }
    // On success, browser redirects to Google — no need to setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-4 p-8">
        <h1 className="text-2xl font-bold text-center">PMS Login</h1>

        <div className="rounded-md border bg-muted/40 p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick fill — test accounts</p>
          <div className="flex flex-wrap gap-2">
            {TEST_ACCOUNTS.map(a => (
              <button
                key={a.email}
                type="button"
                onClick={() => { setEmail(a.email); setPassword(a.password); setMessage('') }}
                className="rounded-full border px-3 py-1 text-xs font-medium hover:bg-accent transition-colors"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Google OAuth */}
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          disabled={loading}
          onClick={handleGoogleLogin}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
          <Button type="button" variant="ghost" className="w-full" disabled={loading} onClick={handleMagicLink}>
            Send Magic Link instead
          </Button>
          {message && <p className="text-sm text-center text-muted-foreground">{message}</p>}
        </form>
      </div>
    </div>
  )
}
