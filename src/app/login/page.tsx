'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import Link from 'next/link'
import { AuthLayout } from './auth-layout'

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
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function fill(acc: typeof TEST_ACCOUNTS[0]) {
    setEmail(acc.email)
    setPassword(acc.password)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) {
      setError('Invalid email or password.')
      setLoading(false)
      return
    }
    window.location.href = '/'
  }

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-white">Welcome back</h1>
          <p className="mt-1 text-sm text-white/40">Sign in to your workspace</p>
        </div>

        {/* Test account pills */}
        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-white/25">Quick fill — test accounts</p>
          <div className="flex flex-wrap gap-1.5">
            {TEST_ACCOUNTS.map(a => (
              <button
                key={a.email}
                type="button"
                onClick={() => fill(a)}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-white/60 transition-all hover:border-[oklch(0.65_0.22_265)] hover:bg-[oklch(0.65_0.22_265)] hover:text-white hover:shadow-[0_0_12px_oklch(0.55_0.22_265/0.3)]"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Google OAuth */}
        <button
          type="button"
          disabled={loading}
          onClick={() => { setLoading(true); signIn('google', { callbackUrl: '/' }) }}
          className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/80 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/[0.07] disabled:opacity-40"
        >
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-white/8" />
          <span className="text-[11px] text-white/25">or sign in with email</span>
          <div className="h-px flex-1 bg-white/8" />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-medium text-white/50">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@company.com"
              className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 outline-none transition-all focus:border-[oklch(0.65_0.22_265)] focus:shadow-[0_0_0_3px_oklch(0.65_0.22_265/0.15)]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium text-white/50">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 pr-10 text-sm text-white placeholder:text-white/20 outline-none transition-all focus:border-[oklch(0.65_0.22_265)] focus:shadow-[0_0_0_3px_oklch(0.65_0.22_265/0.15)]"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 transition-colors hover:text-white/60"
                aria-label="Toggle password"
              >
                {showPass ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" /></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <Link href="/login/forgot-password" className="text-xs text-white/35 transition-colors hover:text-white/60">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[oklch(0.65_0.22_265)] px-4 py-2.5 text-sm font-medium text-white shadow-[0_0_15px_oklch(0.55_0.22_265/0.3)] transition-all hover:shadow-[0_0_25px_oklch(0.6_0.25_265/0.45)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Error message */}
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-center text-sm text-red-400">
            {error}
          </div>
        )}
      </div>
    </AuthLayout>
  )
}
