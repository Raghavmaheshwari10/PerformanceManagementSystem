'use client'

import { useTransition } from 'react'
import { acceptPeerReview, declinePeerReview } from './actions'
import { useToast } from '@/lib/toast'

export function PeerReviewActions({ requestId }: { requestId: string }) {
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  function handleAccept() {
    startTransition(async () => {
      const result = await acceptPeerReview(requestId)
      if (result.error) toast.error(result.error)
      else toast.success('Peer review accepted. You can now submit your review.')
    })
  }

  function handleDecline() {
    startTransition(async () => {
      const result = await declinePeerReview(requestId)
      if (result.error) toast.error(result.error)
      else toast.success('Peer review declined.')
    })
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleAccept}
        disabled={isPending}
        className="rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        {isPending ? 'Processing…' : 'Accept'}
      </button>
      <button
        onClick={handleDecline}
        disabled={isPending}
        className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {isPending ? 'Processing…' : 'Decline'}
      </button>
    </div>
  )
}
