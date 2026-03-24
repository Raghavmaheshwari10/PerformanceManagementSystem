'use client'

import { useActionState, useEffect, useState } from 'react'
import { resetPassword } from './actions'
import { SubmitButton } from '@/components/submit-button'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import type { ActionResult } from '@/lib/types'

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
      <div className="text-center space-y-3">
        <p className="text-destructive">Invalid reset link. Please request a new one.</p>
        <Link href="/login/forgot-password" className="text-sm underline">Request new link</Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="text-center space-y-3">
        <div className="text-4xl">✅</div>
        <h2 className="text-xl font-semibold">Password updated!</h2>
        <Link href="/login" className="block text-sm underline text-muted-foreground">Sign in with your new password</Link>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.error && (
        <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}
      <div className="space-y-1">
        <Label htmlFor="password">New password</Label>
        <input id="password" name="password" type="password" required minLength={8} className="w-full rounded border bg-background px-3 py-1.5 text-sm" placeholder="At least 8 characters" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirm">Confirm password</Label>
        <input id="confirm" name="confirm" type="password" required minLength={8} className="w-full rounded border bg-background px-3 py-1.5 text-sm" />
      </div>
      <SubmitButton pendingLabel="Resetting…" className="w-full">Reset Password</SubmitButton>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold">Set new password</h1>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
          <ResetForm />
        </Suspense>
        <Link href="/login" className="block text-center text-sm underline text-muted-foreground">Back to login</Link>
      </div>
    </div>
  )
}
