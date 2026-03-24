'use client'

import { useActionState, useEffect, useState } from 'react'
import { requestPasswordReset } from './actions'
import { SubmitButton } from '@/components/submit-button'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import type { ActionResult } from '@/lib/types'

const INITIAL: ActionResult = { data: null, error: null }

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(requestPasswordReset, INITIAL)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (state !== INITIAL && !state.error) {
      setSubmitted(true)
    }
  }, [state])

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="text-4xl">✉️</div>
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-muted-foreground">
            If that email is registered, we sent a password reset link. Check your inbox.
          </p>
          <Link href="/login" className="text-sm underline text-muted-foreground">
            Back to login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Forgot password</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter your email to receive a reset link.</p>
        </div>
        <form action={action} className="space-y-4">
          {state.error && (
            <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
          )}
          <div className="space-y-1">
            <Label htmlFor="email">Email address</Label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded border bg-background px-3 py-1.5 text-sm"
              placeholder="you@company.com"
            />
          </div>
          <SubmitButton pendingLabel="Sending…" className="w-full">Send reset link</SubmitButton>
        </form>
        <Link href="/login" className="block text-center text-sm underline text-muted-foreground">
          Back to login
        </Link>
      </div>
    </div>
  )
}
