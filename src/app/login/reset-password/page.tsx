'use client'

import { useActionState, useEffect, useState, Suspense } from 'react'
import { resetPassword } from './actions'
import { SubmitButton } from '@/components/submit-button'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { ActionResult } from '@/lib/types'
import { AuthLayout } from '../auth-layout'

const INITIAL: ActionResult = { data: null, error: null }

function ResetForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [state, action] = useActionState(resetPassword, INITIAL)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (state !== INITIAL && !state.error) setDone(true)
  }, [state])

  if (!token) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-500/15">
          <svg xmlns="http://www.w3.org/2000/svg" className="size-7 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-white">Invalid reset link</h1>
        <p className="text-sm text-white/40">This link is invalid or has expired.</p>
        <Link href="/login/forgot-password" className="inline-block text-sm text-[oklch(0.7_0.22_265)] underline underline-offset-2">
          Request a new link
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/15">
          <svg xmlns="http://www.w3.org/2000/svg" className="size-7 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-white">Password updated!</h1>
        <p className="text-sm text-white/40">Your password has been reset successfully.</p>
        <Link
          href="/login"
          className="inline-block rounded-lg bg-[oklch(0.65_0.22_265)] px-6 py-2.5 text-sm font-medium text-white shadow-[0_0_15px_oklch(0.55_0.22_265/0.3)] transition-all hover:shadow-[0_0_25px_oklch(0.6_0.25_265/0.45)]"
        >
          Sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-white">Set new password</h1>
        <p className="mt-1 text-sm text-white/40">Choose a strong password for your account.</p>
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="token" value={token} />

        {state.error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
            {state.error}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-medium text-white/50">New password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 outline-none transition-all focus:border-[oklch(0.65_0.22_265)] focus:shadow-[0_0_0_3px_oklch(0.65_0.22_265/0.15)]"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirm" className="text-xs font-medium text-white/50">Confirm password</label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            required
            minLength={8}
            placeholder="Repeat your password"
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 outline-none transition-all focus:border-[oklch(0.65_0.22_265)] focus:shadow-[0_0_0_3px_oklch(0.65_0.22_265/0.15)]"
          />
        </div>

        <SubmitButton
          pendingLabel="Resetting..."
          className="w-full rounded-lg bg-[oklch(0.65_0.22_265)] px-4 py-2.5 text-sm font-medium text-white shadow-[0_0_15px_oklch(0.55_0.22_265/0.3)] transition-all hover:shadow-[0_0_25px_oklch(0.6_0.25_265/0.45)]"
        >
          Reset Password
        </SubmitButton>
      </form>

      <Link
        href="/login"
        className="block text-center text-sm text-white/35 underline underline-offset-2 transition-colors hover:text-white/60"
      >
        Back to sign in
      </Link>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<p className="text-sm text-white/40">Loading...</p>}>
        <ResetForm />
      </Suspense>
    </AuthLayout>
  )
}
