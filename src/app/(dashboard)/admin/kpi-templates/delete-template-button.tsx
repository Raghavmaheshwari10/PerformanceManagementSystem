'use client'

import { useState, useRef } from 'react'
import { useToast } from '@/lib/toast'
import { Trash2 } from 'lucide-react'

export function DeleteTemplateButton({ id, action }: { id: string; action: (id: string) => Promise<void> }) {
  const { toast } = useToast()
  const [hidden, setHidden] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (hidden) return null

  return (
    <button
      onClick={() => {
        setHidden(true)
        timer.current = setTimeout(() => action(id), 5000)
        toast.success('Template deleted', {
          action: {
            label: 'Undo',
            onClick: () => {
              if (timer.current) clearTimeout(timer.current)
              setHidden(false)
            },
          },
          duration: 5000,
        })
      }}
      className="text-destructive hover:text-destructive/80"
      aria-label="Delete template"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )
}
