'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ComponentProps } from 'react'

type ButtonProps = ComponentProps<typeof Button>

interface SubmitButtonProps extends Omit<ButtonProps, 'formAction'> {
  pendingLabel?: string
  formAction?: (formData: FormData) => void | Promise<void>
}

export function SubmitButton({ pendingLabel, children, formAction, disabled, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus()
  return (
    <Button
      {...props}
      type="submit"
      formAction={formAction}
      disabled={disabled || pending}
      aria-disabled={disabled || pending}
    >
      {pending && (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      )}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  )
}
