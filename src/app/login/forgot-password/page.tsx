'use client'

import { useActionState, useEffect, useState } from 'react'
import { requestPasswordReset } from './actions'
import { SubmitButton } from '@/components/submit-button'
import Link from 'next/link'
import type { ActionResult } from '@/lib/types'
import { AuthLayout } from '../auth-layout'

const INITIAL: ActionResult = { data: null, error: null }

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(requestPasswordReset, INITIAL)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (state !== INITIAL && !state.error) setSubmitted(true)
  }, [state])

  return (
    <AuthLayout>
      {submitted ? (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[oklch(0.65_0.22_265/0.15)]">
            <svg xmlns="http://www.w3.org/2000/svg" className="size-7 text-[oklch(0.7_0.22_265)]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white">Check your email</h1>
          <p className="text-sm text-white/40">
            If that email is registered, we sent a password reset link. Check your inbox.
          </p>
          <Link
            href="/login"
            className="inline-block text-sm text-white/40 underline underline-offset-2 transition-colors hover:text-white/60"
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h1 className="text-[1.75rem] font-semibold tracking-tight text-white">Forgot password</h1>
            <p className="mt-1 text-sm text-white/40">Enter your email and we&apos;ll send a reset link.</p>
          </div>

          <form action={action} className="space-y-4">
            {state.error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                {state.error}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-white/50">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 outline-none transition-all focus:border-[oklch(0.65_0.22_265)] focus:shadow-[0_0_0_3px_oklch(0.65_0.22_265/0.15)]"
              />
            </div>

            <SubmitButton
              pendingLabel="Sending..."
              className="w-full rounded-lg bg-[oklch(0.65_0.22_265)] px-4 py-2.5 text-sm font-medium text-white shadow-[0_0_15px_oklch(0.55_0.22_265/0.3)] transition-all hover:shadow-[0_0_25px_oklch(0.6_0.25_265/0.45)]"
            >
              Send reset link
            </SubmitButton>
          </form>

          <Link
            href="/login"
            className="block text-center text-sm text-white/35 underline underline-offset-2 transition-colors hover:text-white/60"
          >
            Back to sign in
          </Link>
        </div>
      )}
    </AuthLayout>
  )
}
