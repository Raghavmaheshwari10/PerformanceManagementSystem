# KPI Comment Threads Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-KPI comment threads for manager-employee discussion during self_review and manager_review phases.

**Architecture:** New `KpiComment` model with cascade delete on KPI. Two server actions (add + fetch). One shared client component (`KpiCommentThread`) embedded in both self-review and manager review forms. In-app notifications via existing `prisma.notification.create`.

**Tech Stack:** Prisma 7 (schema + generate), Next.js 16 server actions, React 19 client components, existing glass UI system.

---

### Task 1: Schema — Add KpiComment model

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add KpiComment model**

Add after the `Kpi` model (after line ~356):

```prisma
model KpiComment {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  kpi_id     String   @db.Uuid
  author_id  String   @db.Uuid
  body       String
  created_at DateTime @default(now()) @db.Timestamptz(6)

  kpi    Kpi  @relation(fields: [kpi_id], references: [id], onDelete: Cascade)
  author User @relation("KpiCommentAuthor", fields: [author_id], references: [id])

  @@index([kpi_id, created_at])
  @@map("kpi_comments")
}
```

**Step 2: Add inverse relation on Kpi model**

In the `Kpi` model, add after `mis_mappings`:

```prisma
  comments     KpiComment[]
```

**Step 3: Add inverse relation on User model**

In the `User` model, add with the other relation fields:

```prisma
  kpi_comments KpiComment[] @relation("KpiCommentAuthor")
```

**Step 4: Add `kpi_comment` to NotificationType enum**

In the `NotificationType` enum, add:

```prisma
  kpi_comment
```

**Step 5: Run prisma generate**

Run: `npx prisma generate`
Expected: Success, Prisma client regenerated.

**Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add KpiComment model and kpi_comment notification type"
```

---

### Task 2: Create kpi_comments table in NeonDB

**Files:**
- Create: `scripts/create-kpi-comments-table.mjs`

The project uses Prisma 7 with NeonDB and `prisma migrate` isn't configured for direct use. Create the table via a Node script using `@neondatabase/serverless` (same pattern used for `kra_template_departments` table).

**Step 1: Write the migration script**

```javascript
import { neon } from '@neondatabase/serverless'
import ws from 'ws'
import { neonConfig } from '@neondatabase/serverless'

neonConfig.webSocketConstructor = ws

const sql = neon(process.env.DIRECT_URL)

await sql`
  CREATE TABLE IF NOT EXISTS kpi_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kpi_id UUID NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
  )
`

await sql`CREATE INDEX IF NOT EXISTS idx_kpi_comments_kpi_created ON kpi_comments(kpi_id, created_at)`

console.log('kpi_comments table created successfully')
```

**Step 2: Run the script**

Run: `node scripts/create-kpi-comments-table.mjs`
Expected: "kpi_comments table created successfully"

**Step 3: Also add `kpi_comment` to the notification_type enum in the database**

Check if the enum already has it — if not, run:

```javascript
await sql`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'kpi_comment'`
```

**Step 4: Commit**

```bash
git add scripts/create-kpi-comments-table.mjs
git commit -m "chore: add migration script for kpi_comments table"
```

---

### Task 3: Server actions — addKpiComment and fetchKpiComments

**Files:**
- Create: `src/app/(dashboard)/shared/kpi-comment-actions.ts`

Shared location because both employee and manager routes use these actions. Use `'use server'` directive.

**Step 1: Write the server actions**

```typescript
'use server'

import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getStatusForEmployee } from '@/lib/cycle-helpers'
import { revalidatePath } from 'next/cache'
import type { ActionResult, CycleStatus } from '@/lib/types'

const COMMENTABLE_STATUSES: CycleStatus[] = ['self_review', 'manager_review']

export async function addKpiComment(
  kpiId: string,
  body: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser()
  if (!user) return { data: null, error: 'Not authenticated' }

  const trimmed = body.trim()
  if (!trimmed) return { data: null, error: 'Comment cannot be empty' }
  if (trimmed.length > 2000) return { data: null, error: 'Comment too long (max 2000 characters)' }

  // Load the KPI with cycle info
  const kpi = await prisma.kpi.findUnique({
    where: { id: kpiId },
    select: {
      id: true,
      title: true,
      cycle_id: true,
      employee_id: true,
      manager_id: true,
    },
  })
  if (!kpi) return { data: null, error: 'KPI not found' }

  // Only the KPI's employee or manager can comment
  const isEmployee = user.id === kpi.employee_id
  const isManager = user.id === kpi.manager_id
  if (!isEmployee && !isManager) {
    return { data: null, error: 'Only the KPI employee or manager can comment' }
  }

  // Check cycle phase — must be self_review or manager_review
  const status = await getStatusForEmployee(kpi.cycle_id, kpi.employee_id)
  if (!COMMENTABLE_STATUSES.includes(status)) {
    return { data: null, error: 'Comments are only allowed during self-review and manager review phases' }
  }

  // Create the comment
  const comment = await prisma.kpiComment.create({
    data: {
      kpi_id: kpiId,
      author_id: user.id,
      body: trimmed,
    },
    select: { id: true },
  })

  // Notify the other party (in-app only)
  const recipientId = isEmployee ? kpi.manager_id : kpi.employee_id
  try {
    await prisma.notification.create({
      data: {
        recipient_id: recipientId,
        type: 'kpi_comment',
        payload: {
          kpi_id: kpi.id,
          kpi_title: kpi.title,
          commenter_name: user.full_name,
          cycle_id: kpi.cycle_id,
        },
      },
    })
  } catch {
    // Notification failure shouldn't block the comment
  }

  revalidatePath('/employee')
  revalidatePath('/manager')
  return { data: { id: comment.id }, error: null }
}

export interface KpiCommentData {
  id: string
  body: string
  created_at: Date
  author: {
    id: string
    full_name: string
    role: string
  }
}

export async function fetchKpiComments(kpiId: string): Promise<KpiCommentData[]> {
  const comments = await prisma.kpiComment.findMany({
    where: { kpi_id: kpiId },
    orderBy: { created_at: 'asc' },
    select: {
      id: true,
      body: true,
      created_at: true,
      author: {
        select: {
          id: true,
          full_name: true,
          role: true,
        },
      },
    },
  })
  return comments
}
```

**Step 2: Commit**

```bash
git add src/app/(dashboard)/shared/kpi-comment-actions.ts
git commit -m "feat: add KPI comment server actions with phase validation and notifications"
```

---

### Task 4: KpiCommentThread client component

**Files:**
- Create: `src/components/kpi-comment-thread.tsx`

**Step 1: Write the component**

```tsx
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
        // Refresh comments
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
```

**Step 2: Commit**

```bash
git add src/components/kpi-comment-thread.tsx
git commit -m "feat: add KpiCommentThread client component with chat-style UI"
```

---

### Task 5: Integrate into employee self-review form

**Files:**
- Modify: `src/app/(dashboard)/employee/self-review-form.tsx`

**Step 1: Add imports**

Add at top of file:

```typescript
import { KpiCommentThread } from '@/components/kpi-comment-thread'
```

**Step 2: Add props for comment support**

Extend `SelfReviewFormProps` to include:

```typescript
interface SelfReviewFormProps {
  cycleId: string
  review: Review | null
  kpis: Kpi[]
  kras: Kra[]
  questions?: ReviewQuestionWithCompetency[]
  existingResponses?: Record<string, { rating_value: number | null; text_value: string | null }>
  currentUserId: string        // NEW
  cycleStatus: string          // NEW
}
```

**Step 3: Add KpiCommentThread after each KPI's comments textarea**

In the `KpiRatingCard` function, after the existing comments textarea (row 3, around line 389), add:

```tsx
<KpiCommentThread
  kpiId={kpi.id}
  currentUserId={currentUserId}
  readOnly={cycleStatus !== 'self_review' && cycleStatus !== 'manager_review'}
/>
```

**Step 4: Update the page that renders this form to pass the new props**

Modify `src/app/(dashboard)/employee/page.tsx` (or wherever `SelfReviewForm` is rendered) to pass `currentUserId={user.id}` and `cycleStatus={effectiveStatus}`.

**Step 5: Commit**

```bash
git add src/app/(dashboard)/employee/self-review-form.tsx src/app/(dashboard)/employee/page.tsx
git commit -m "feat: add KPI comment threads to employee self-review form"
```

---

### Task 6: Integrate into manager review form

**Files:**
- Modify: `src/app/(dashboard)/manager/[employeeId]/review/review-form.tsx`

**Step 1: Add imports**

```typescript
import { KpiCommentThread } from '@/components/kpi-comment-thread'
```

**Step 2: Add props**

Extend `ReviewFormProps`:

```typescript
interface ReviewFormProps {
  cycleId: string
  employeeId: string
  kpis: Kpi[]
  kras: Kra[]
  defaultRating?: string
  defaultComments?: string
  competencyQuestions?: ReviewQuestionWithCompetency[]
  existingCompetencyResponses?: Record<string, { rating_value: number | null; text_value: string | null }>
  competencyWeight?: number
  currentUserId: string        // NEW
  cycleStatus: string          // NEW
}
```

**Step 3: Add KpiCommentThread after each KPI's manager comments textarea**

In the `KpiRatingCard` function, after the manager comments textarea (row 4, around line 355), add:

```tsx
<KpiCommentThread
  kpiId={kpi.id}
  currentUserId={currentUserId}
  readOnly={cycleStatus !== 'self_review' && cycleStatus !== 'manager_review'}
/>
```

**Step 4: Update the page that renders this form to pass the new props**

Modify `src/app/(dashboard)/manager/[employeeId]/review/page.tsx` to pass `currentUserId={user.id}` and `cycleStatus`.

**Step 5: Commit**

```bash
git add src/app/(dashboard)/manager/[employeeId]/review/review-form.tsx src/app/(dashboard)/manager/[employeeId]/review/page.tsx
git commit -m "feat: add KPI comment threads to manager review form"
```

---

### Task 7: Add kpi_comments cleanup to user deletion

**Files:**
- Modify: `src/app/(dashboard)/admin/users/actions.ts`

**Step 1: Add kpiComment cleanup to delete transaction**

In the `deleteUser` function's `prisma.$transaction` array (around line 458), add before the KPI deletion line:

```typescript
prisma.kpiComment.deleteMany({ where: { author_id: userId } }),
```

Also add to `bulkDeleteUsers` transaction.

**Step 2: Commit**

```bash
git add src/app/(dashboard)/admin/users/actions.ts
git commit -m "fix: include kpi_comments in user deletion cleanup"
```

---

### Task 8: Tests

**Files:**
- Create: `src/lib/__tests__/kpi-comments.test.ts`

**Step 1: Write tests**

Test suites:
1. **addKpiComment** — validates empty body rejected, long body rejected, non-employee/manager rejected, wrong cycle phase rejected, successful comment created
2. **fetchKpiComments** — returns ordered by created_at asc, returns author info
3. **Phase gating** — comments allowed in self_review and manager_review, blocked in other phases
4. **Notification** — notification created for the other party when comment is added

Mock Prisma client using the same pattern as existing tests in `src/lib/__tests__/`.

**Step 2: Run tests**

Run: `npx vitest run src/lib/__tests__/kpi-comments.test.ts`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add src/lib/__tests__/kpi-comments.test.ts
git commit -m "test: add KPI comment thread tests"
```

---

## Verification

1. Employee opens self-review → sees comment toggle on each KPI → can post comment
2. Manager opens review → sees same thread with employee's comments → can reply
3. Comment appears in chat-style with role badge and timestamp
4. In-app notification created when comment is posted
5. Comments are read-only outside self_review/manager_review phases
6. HRBP/admin can view threads but cannot post
7. Deleting a KPI cascades to delete its comments
8. Deleting a user cleans up their authored comments
