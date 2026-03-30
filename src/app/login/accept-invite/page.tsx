'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { acceptInvite } from './actions'
import Link from 'next/link'

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>}>
      <AcceptInviteForm />
    </Suspense>
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

    if (!token) {
      setError('Invalid invite link — no token found.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const result = await acceptInvite(token, password)
    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/15">
            <svg xmlns="http://www.w3.org/2000/svg" className="size-8 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Account Set Up!</h1>
          <p className="text-sm text-muted-foreground">
            Your password has been set. You can now log in.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Welcome to hRMS</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set your password to get started.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!token ? (
          <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
            Invalid invite link. Contact your admin for a new invite.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="At least 6 characters"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                placeholder="Repeat your password"
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Setting up...' : 'Set Password & Activate Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
