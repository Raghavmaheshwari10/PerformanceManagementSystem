'use client'

import { useState, useTransition, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { MessageCircle } from 'lucide-react'
import { addKpiComment, fetchKpiComments } from '@/app/(dashboard)/shared/kpi-comment-actions'
import type { KpiCommentData } from '@/app/(dashboard)/shared/kpi-comment-actions'
import { useToast } from '@/lib/toast'

interface Props {
  kpiId: string
  currentUserId: string
  readOnly: boolean
  initialComments?: KpiCommentData[]
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const ROLE_BADGE: Record<string, string> = {
  employee: 'bg-blue-500/15 text-blue-400',
  manager: 'bg-amber-500/15 text-amber-400',
  hrbp: 'bg-purple-500/15 text-purple-400',
  admin: 'bg-red-500/15 text-red-400',
}

export function KpiCommentThread({ kpiId, currentUserId, readOnly, initialComments }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [comments, setComments] = useState<KpiCommentData[]>(initialComments ?? [])
  const [body, setBody] = useState('')
  const [isPending, startTransition] = useTransition()
  const [loaded, setLoaded] = useState(!!initialComments)
  const { toast } = useToast()

  useEffect(() => {
    if (expanded && !loaded) {
      fetchKpiComments(kpiId).then(data => {
        setComments(data)
        setLoaded(true)
      })
    }
  }, [expanded, loaded, kpiId])

  function handleSubmit() {
    if (!body.trim()) return
    startTransition(async () => {
      const result = await addKpiComment(kpiId, body)
      if (result.error) {
        toast.error(result.error)
      } else {
        setBody('')
        const updated = await fetchKpiComments(kpiId)
        setComments(updated)
      }
    })
  }

  const count = comments.length

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        {count > 0 ? `${count} comment${count > 1 ? 's' : ''}` : 'Comments'}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 rounded-lg border bg-muted/20 p-3">
          {comments.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No comments yet</p>
          )}

          {comments.map(c => (
            <div key={c.id} className={`flex gap-2 ${c.author.id === currentUserId ? 'flex-row-reverse' : ''}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                c.author.id === currentUserId
                  ? 'bg-primary/10 text-foreground'
                  : 'bg-muted/50 text-foreground'
              }`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-xs">{c.author.full_name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ROLE_BADGE[c.author.role] ?? 'bg-muted text-muted-foreground'}`}>
                    {c.author.role}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                </div>
                <p className="whitespace-pre-wrap">{c.body}</p>
              </div>
            </div>
          ))}

          {!readOnly && (
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={body}
                onChange={e => setBody(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
                placeholder="Add a comment..."
                maxLength={2000}
                className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                type="button"
                size="sm"
                onClick={handleSubmit}
                disabled={isPending || !body.trim()}
              >
                {isPending ? 'Sending...' : 'Comment'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
