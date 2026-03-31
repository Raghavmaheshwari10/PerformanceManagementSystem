'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { acceptInvite } from './actions'
import Link from 'next/link'
import { AuthLayout } from '../auth-layout'

export default function AcceptInvitePage() {
  return (
    <AuthLayout>
      <Suspense fallback={<p className="text-sm text-white/40">Loading...</p>}>
        <AcceptInviteForm />
      </Suspense>
    </AuthLayout>
  )
}

function AcceptInviteForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!token) { setError('Invalid invite link.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }

    setLoading(true)
    const result = await acceptInvite(token, password)
    setLoading(false)
    if (result.error) setError(result.error)
    else setSuccess(true)
  }

  if (success) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/15">
          <svg xmlns="http://www.w3.org/2000/svg" className="size-7 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-white">Account Set Up!</h1>
        <p className="text-sm text-white/40">Your password has been set. You can now sign in.</p>
        <Link
          href="/login"
          className="inline-block rounded-lg bg-[oklch(0.65_0.22_265)] px-6 py-2.5 text-sm font-medium text-white shadow-[0_0_15px_oklch(0.55_0.22_265/0.3)] transition-all hover:shadow-[0_0_25px_oklch(0.6_0.25_265/0.45)]"
        >
          Go to Sign In
        </Link>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-500/15">
          <svg xmlns="http://www.w3.org/2000/svg" className="size-7 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-white">Invalid invite link</h1>
        <p className="text-sm text-white/40">Contact your admin for a new invite.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-white">Welcome to PMS</h1>
        <p className="mt-1 text-sm text-white/40">Set your password to activate your account.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-medium text-white/50">New password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="At least 6 characters"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 outline-none transition-all focus:border-[oklch(0.65_0.22_265)] focus:shadow-[0_0_0_3px_oklch(0.65_0.22_265/0.15)]"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirm" className="text-xs font-medium text-white/50">Confirm password</label>
          <input
            id="confirm"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            placeholder="Repeat your password"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 outline-none transition-all focus:border-[oklch(0.65_0.22_265)] focus:shadow-[0_0_0_3px_oklch(0.65_0.22_265/0.15)]"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[oklch(0.65_0.22_265)] px-4 py-2.5 text-sm font-medium text-white shadow-[0_0_15px_oklch(0.55_0.22_265/0.3)] transition-all hover:shadow-[0_0_25px_oklch(0.6_0.25_265/0.45)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Setting up...' : 'Set Password & Activate'}
        </button>
      </form>
    </div>
  )
}
