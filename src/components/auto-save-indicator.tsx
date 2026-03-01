import { cn } from '@/lib/utils'

interface Props {
  status: 'idle' | 'saving' | 'saved' | 'error'
  label: string
  onRetry?: () => void
}

export function AutoSaveIndicator({ status, label, onRetry }: Props) {
  if (status === 'idle' || !label) return null
  return (
    <span className={cn(
      'text-xs',
      status === 'saving' && 'text-muted-foreground',
      status === 'saved'  && 'text-green-600',
      status === 'error'  && 'text-destructive'
    )}>
      {label}
      {status === 'error' && onRetry && (
        <button onClick={onRetry} className="ml-1 underline">Retry</button>
      )}
    </span>
  )
}
