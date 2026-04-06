# PIP (Performance Improvement Plan) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full PIP module with HRBP-approved milestones, check-ins, documents, employee acknowledgment, auto-suggest from cycle results, and role-scoped dashboards.

**Architecture:** 4 new Prisma models (Pip, PipMilestone, PipCheckIn, PipDocument) + 2 new enums. Data layer in `src/lib/db/pip.ts`, 13 server actions in `src/app/(dashboard)/admin/pip/actions.ts`, shared `PipDashboard` client component with 3 tabs, 3 role-scoped route pages + PIP detail page, employee banner component, sidebar nav links.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 7, Zod, Tailwind v4, Lucide icons.

**Design doc:** `docs/plans/2026-04-06-pip-design.md`

---

### Task 1: Schema — Enums + 4 PIP Models

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add PipStatus and PipOutcome enums after existing enums block**

Add after the `PeerReviewStatus` enum:

```prisma
enum PipStatus {
  draft
  active
  extended
  completed
  closed

  @@map("pip_status")
}

enum PipOutcome {
  improved
  partially_improved
  not_improved

  @@map("pip_outcome")
}

enum PipMilestoneStatus {
  pending
  in_progress
  completed
  missed

  @@map("pip_milestone_status")
}
```

**Step 2: Add Pip model after TopTalentConfig**

```prisma
model Pip {
  id                      String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  employee_id             String      @db.Uuid
  manager_id              String      @db.Uuid
  initiated_by            String      @db.Uuid
  hrbp_id                 String      @db.Uuid
  cycle_id                String?     @db.Uuid
  skip_level_manager_id   String?     @db.Uuid
  reason                  String
  start_date              DateTime    @db.Date
  end_date                DateTime    @db.Date
  status                  PipStatus   @default(draft)
  outcome                 PipOutcome?
  employee_acknowledged_at DateTime?  @db.Timestamptz(6)
  escalation_note         String?
  auto_flag_next_cycle    Boolean     @default(true)
  created_at              DateTime    @default(now()) @db.Timestamptz(6)
  updated_at              DateTime    @default(now()) @updatedAt @db.Timestamptz(6)

  employee            User            @relation("PipEmployee", fields: [employee_id], references: [id])
  manager             User            @relation("PipManager", fields: [manager_id], references: [id])
  initiator           User            @relation("PipInitiator", fields: [initiated_by], references: [id])
  hrbp                User            @relation("PipHrbp", fields: [hrbp_id], references: [id])
  cycle               Cycle?          @relation(fields: [cycle_id], references: [id])
  skip_level_manager  User?           @relation("PipSkipLevel", fields: [skip_level_manager_id], references: [id])
  milestones          PipMilestone[]
  check_ins           PipCheckIn[]
  documents           PipDocument[]

  @@index([employee_id], name: "idx_pips_employee")
  @@index([manager_id], name: "idx_pips_manager")
  @@index([hrbp_id], name: "idx_pips_hrbp")
  @@index([status], name: "idx_pips_status")
  @@map("pips")
}

model PipMilestone {
  id                  String             @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  pip_id              String             @db.Uuid
  title               String
  description         String?
  target_metric       String
  due_date            DateTime           @db.Date
  status              PipMilestoneStatus @default(pending)
  hrbp_signed_off_at  DateTime?          @db.Timestamptz(6)
  hrbp_signed_off_by  String?            @db.Uuid
  sort_order          Int                @default(0)
  created_at          DateTime           @default(now()) @db.Timestamptz(6)

  pip          Pip   @relation(fields: [pip_id], references: [id], onDelete: Cascade)
  hrbp_signer  User? @relation("PipMilestoneHrbpSigner", fields: [hrbp_signed_off_by], references: [id])

  @@index([pip_id], name: "idx_pip_milestones_pip")
  @@map("pip_milestones")
}

model PipCheckIn {
  id                String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  pip_id            String   @db.Uuid
  created_by        String   @db.Uuid
  check_in_date     DateTime @db.Date
  progress_rating   Int      // 1-5
  notes             String
  next_steps        String?
  employee_response String?
  created_at        DateTime @default(now()) @db.Timestamptz(6)

  pip     Pip  @relation(fields: [pip_id], references: [id], onDelete: Cascade)
  creator User @relation("PipCheckInCreator", fields: [created_by], references: [id])

  @@index([pip_id], name: "idx_pip_check_ins_pip")
  @@map("pip_check_ins")
}

model PipDocument {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  pip_id      String   @db.Uuid
  uploaded_by String   @db.Uuid
  file_name   String
  file_url    String
  file_type   String
  description String?
  created_at  DateTime @default(now()) @db.Timestamptz(6)

  pip      Pip  @relation(fields: [pip_id], references: [id], onDelete: Cascade)
  uploader User @relation("PipDocumentUploader", fields: [uploaded_by], references: [id])

  @@index([pip_id], name: "idx_pip_documents_pip")
  @@map("pip_documents")
}
```

**Step 3: Add inverse relations on User model**

Add these lines to the User model's relations block:

```prisma
pips_as_employee       Pip[]             @relation("PipEmployee")
pips_as_manager        Pip[]             @relation("PipManager")
pips_initiated         Pip[]             @relation("PipInitiator")
pips_as_hrbp           Pip[]             @relation("PipHrbp")
pips_as_skip_level     Pip[]             @relation("PipSkipLevel")
pip_milestones_signed  PipMilestone[]    @relation("PipMilestoneHrbpSigner")
pip_check_ins_created  PipCheckIn[]      @relation("PipCheckInCreator")
pip_documents_uploaded PipDocument[]     @relation("PipDocumentUploader")
```

**Step 4: Add inverse relation on Cycle model**

Add to the Cycle model's relations block:

```prisma
pips Pip[]
```

**Step 5: Run prisma generate**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client`

**Step 6: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(pip): add Pip, PipMilestone, PipCheckIn, PipDocument schema models"
```

---

### Task 2: Data Layer — PIP Queries

**Files:**
- Create: `src/lib/db/pip.ts`

**Step 1: Create the data layer file with all query functions**

This file exports:
- `fetchPipList(options)` — list PIPs with filters (status, managerId, hrbpDepartmentIds, employeeId). Returns array with employee/manager/hrbp names, milestone progress, days remaining.
- `fetchPipDetail(pipId)` — single PIP with all milestones, check-ins, documents, employee + manager + hrbp info.
- `fetchPipStats(options)` — aggregate stats: total active, by status, by department, avg duration, outcome distribution.
- `fetchPipRecommendations(cycleId)` — employees with SME/BE rating in given cycle who don't already have an active PIP. Used for auto-suggest.

Key patterns to follow (from `src/lib/db/top-talent.ts`):
- Import `prisma` from `@/lib/prisma`
- Export typed interfaces for return values
- Use `Promise.all` for parallel queries
- Handle nullable relations gracefully

```typescript
import { prisma } from '@/lib/prisma'
import type { PipStatus, PipOutcome } from '@prisma/client'

/* ── Types ── */

export interface PipListItem {
  id: string
  employeeName: string
  employeeEmail: string
  department: string
  managerId: string
  managerName: string
  hrbpName: string
  reason: string
  startDate: Date
  endDate: Date
  status: string
  outcome: string | null
  daysRemaining: number
  milestoneProgress: { total: number; completed: number }
  isAcknowledged: boolean
  cycleId: string | null
  cycleName: string | null
  createdAt: Date
}

export interface PipDetail {
  id: string
  employee: { id: string; fullName: string; email: string; department: string; designation: string | null }
  manager: { id: string; fullName: string }
  initiator: { id: string; fullName: string }
  hrbp: { id: string; fullName: string }
  skipLevelManager: { id: string; fullName: string } | null
  cycle: { id: string; name: string } | null
  reason: string
  startDate: Date
  endDate: Date
  status: string
  outcome: string | null
  employeeAcknowledgedAt: Date | null
  escalationNote: string | null
  autoFlagNextCycle: boolean
  milestones: Array<{
    id: string
    title: string
    description: string | null
    targetMetric: string
    dueDate: Date
    status: string
    hrbpSignedOffAt: Date | null
    hrbpSignedOffBy: string | null
    sortOrder: number
  }>
  checkIns: Array<{
    id: string
    createdBy: { id: string; fullName: string }
    checkInDate: Date
    progressRating: number
    notes: string
    nextSteps: string | null
    employeeResponse: string | null
    createdAt: Date
  }>
  documents: Array<{
    id: string
    uploadedBy: { id: string; fullName: string }
    fileName: string
    fileUrl: string
    fileType: string
    description: string | null
    createdAt: Date
  }>
  createdAt: Date
  updatedAt: Date
}

export interface PipStats {
  totalActive: number
  totalAll: number
  byStatus: Record<string, number>
  byDepartment: Array<{ department: string; active: number; completed: number }>
  avgDurationDays: number
  outcomeDistribution: Record<string, number>
}

export interface PipRecommendation {
  employeeId: string
  employeeName: string
  email: string
  department: string
  managerId: string
  managerName: string
  finalRating: string
  cycleName: string
  cycleId: string
  hasActivePip: boolean
}
```

Implementation:
- `fetchPipList`: Query `prisma.pip.findMany` with includes for employee (department), manager, hrbp, milestones (count completed). Compute `daysRemaining` from `end_date - now()`. Filter by status, managerId, hrbpDepartmentIds array, or employeeId.
- `fetchPipDetail`: `prisma.pip.findUnique` with all nested includes. Map to flat `PipDetail` shape.
- `fetchPipStats`: `groupBy` on pip status + department aggregation.
- `fetchPipRecommendations`: Query published cycle's appraisals where `final_rating IN ('SME','BE')` and LEFT JOIN against active pips to mark `hasActivePip`.

**Step 2: Commit**

```bash
git add src/lib/db/pip.ts
git commit -m "feat(pip): add data layer with list, detail, stats, recommendation queries"
```

---

### Task 3: Server Actions — All 13 PIP Actions

**Files:**
- Create: `src/app/(dashboard)/admin/pip/actions.ts`

**Step 1: Create actions file with Zod schemas and all 13 server actions**

Follow the pattern from `src/app/(dashboard)/admin/top-talent/actions.ts`:
- `'use server'` directive
- Import `requireRole`, `getCurrentUser` from `@/lib/auth`
- Import `prisma` from `@/lib/prisma`
- Import `revalidatePath` from `next/cache`
- Import `z` from `zod`
- Use `ActionResult` return type from `@/lib/types`
- Audit log every mutation

Zod schemas:

```typescript
const createPipSchema = z.object({
  employeeId: z.string().uuid(),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  cycleId: z.string().uuid().optional(),
})

const milestoneSchema = z.object({
  pipId: z.string().uuid(),
  title: z.string().min(3),
  description: z.string().optional(),
  targetMetric: z.string().min(3, 'Target metric is required'),
  dueDate: z.coerce.date(),
})

const checkInSchema = z.object({
  pipId: z.string().uuid(),
  checkInDate: z.coerce.date(),
  progressRating: z.coerce.number().int().min(1).max(5),
  notes: z.string().min(5),
  nextSteps: z.string().optional(),
})
```

Actions list (each follows pattern: role check → Zod parse → DB mutation → audit log → revalidatePath):

1. `createPip(_prev, formData)` — roles: manager, hrbp. Auto-resolves skip-level from employee's manager's manager. Sets `initiated_by` to current user. Sets `hrbp_id` to current user if HRBP, else looks up HRBP for employee's department.
2. `activatePip(pipId)` — role: hrbp only. Sets status → active. TODO: notification in future.
3. `acknowledgePip(pipId)` — role: employee (own PIP). Sets `employee_acknowledged_at = now()`.
4. `addMilestone(_prev, formData)` — roles: manager, hrbp.
5. `updateMilestoneStatus(milestoneId, status)` — roles: manager, hrbp.
6. `signOffMilestone(milestoneId)` — role: hrbp only. Sets `hrbp_signed_off_at` and `hrbp_signed_off_by`.
7. `addCheckIn(_prev, formData)` — roles: manager, hrbp.
8. `respondToCheckIn(checkInId, response)` — role: employee (own PIP).
9. `extendPip(pipId, newEndDate)` — roles: manager, hrbp. Sets status → extended then active.
10. `completePip(pipId, outcome, escalationNote?)` — role: hrbp. Sets outcome, status → completed.
11. `closePip(pipId)` — roles: hrbp, admin. Sets status → closed. If outcome=not_improved + auto_flag → create audit log flag.
12. `uploadDocument(_prev, formData)` — roles: manager, hrbp. Stores file reference (URL-based, actual upload handled client-side).
13. `exportPipCsv()` — roles: admin, hrbp. Returns CSV string.

Revalidate paths: `/admin/pip`, `/hrbp/pip`, `/manager/pip`

**Step 2: Commit**

```bash
git add "src/app/(dashboard)/admin/pip/actions.ts"
git commit -m "feat(pip): add 13 server actions with Zod validation and audit logging"
```

---

### Task 4: PipDashboard Client Component

**Files:**
- Create: `src/components/pip-dashboard.tsx`

**Step 1: Build the shared dashboard component**

Follow the pattern from `src/components/report-dashboard.tsx`:
- `'use client'`
- 3 tabs: Active PIPs, History, Settings (admin-only)
- Props: `pips: PipListItem[]`, `stats: PipStats`, `recommendations: PipRecommendation[]`, `role: UserRole`, `title: string`, `subtitle?: string`
- Tab navigation with Lucide icons (same style as ReportDashboard)
- Glass styling classes (`glass`, `glass-interactive`)

**Active PIPs tab:**
- Table columns: Employee, Department, Start Date, End Date, Days Left, Milestones (progress bar), Status badge, Actions
- Status badges: draft=slate, active=blue, extended=amber, completed=emerald, closed=gray
- "New PIP" button (manager/hrbp)
- "PIP Recommended" section at top showing `recommendations` with amber chip badges
- Filter by: status, department (dropdown)
- Row click → navigates to PIP detail page

**History tab:**
- Same table but for completed/closed PIPs
- Outcome badges: improved=green, partially_improved=amber, not_improved=red
- Search by employee name + date range filter

**Settings tab (admin only):**
- Auto-suggest tiers: multi-select checkboxes for rating tiers (default SME+BE)
- Note: settings are informational for now — auto-suggest logic uses hardcoded SME/BE. Full config model deferred to avoid over-engineering.

**Step 2: Commit**

```bash
git add src/components/pip-dashboard.tsx
git commit -m "feat(pip): add PipDashboard client component with 3 tabs"
```

---

### Task 5: PIP Detail Page Component

**Files:**
- Create: `src/components/pip-detail.tsx`

**Step 1: Build the detail page component**

Props: `pip: PipDetail`, `role: UserRole`, `currentUserId: string`

Sections:
- **Header**: Employee name + department, status badge, date range with progress ring (days elapsed / total days), outcome badge if set
- **Milestones timeline**: Vertical timeline, each node shows title, target metric, due date, status badge, HRBP sign-off indicator. Action buttons per role (mark status, sign off).
- **Check-ins list**: Chronological cards. Each shows: date, creator name, progress dots (1-5), notes, next steps, employee response (indented). "Add Check-in" button for manager/hrbp. "Respond" button for employee on their check-ins.
- **Documents section**: Simple list with file icon, name, uploader, date, download link. "Upload" button for manager/hrbp.
- **Actions bar** (bottom sticky): role-gated buttons:
  - HRBP: Activate (if draft), Sign Off Milestone, Complete PIP, Close PIP
  - Manager/HRBP: Add Milestone, Add Check-in, Extend, Upload Document
  - Employee: Acknowledge (one-time), Respond to Check-in

**Step 2: Commit**

```bash
git add src/components/pip-detail.tsx
git commit -m "feat(pip): add PipDetail component with milestones, check-ins, documents"
```

---

### Task 6: Route Pages — List + Detail

**Files:**
- Create: `src/app/(dashboard)/admin/pip/page.tsx`
- Create: `src/app/(dashboard)/admin/pip/[id]/page.tsx`
- Create: `src/app/(dashboard)/hrbp/pip/page.tsx`
- Create: `src/app/(dashboard)/hrbp/pip/[id]/page.tsx`
- Create: `src/app/(dashboard)/manager/pip/page.tsx`
- Create: `src/app/(dashboard)/manager/pip/[id]/page.tsx`

**Step 1: Create admin list page**

```typescript
import { requireRole } from '@/lib/auth'
import { fetchPipList, fetchPipStats, fetchPipRecommendations } from '@/lib/db/pip'
import { PipDashboard } from '@/components/pip-dashboard'

export default async function AdminPipPage() {
  await requireRole(['admin'])
  const [pips, stats, recommendations] = await Promise.all([
    fetchPipList({}),
    fetchPipStats({}),
    fetchPipRecommendations(),
  ])
  return <PipDashboard pips={pips} stats={stats} recommendations={recommendations} role="admin" title="PIP Management" subtitle="All departments" />
}
```

**Step 2: Create admin detail page**

```typescript
import { requireRole } from '@/lib/auth'
import { fetchPipDetail } from '@/lib/db/pip'
import { PipDetailView } from '@/components/pip-detail'
import { notFound } from 'next/navigation'

export default async function AdminPipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(['admin'])
  const { id } = await params
  const pip = await fetchPipDetail(id)
  if (!pip) notFound()
  return <PipDetailView pip={pip} role="admin" currentUserId={user.id} />
}
```

**Step 3: Create HRBP pages** — same pattern, `requireRole(['hrbp'])`, scope `fetchPipList` by `hrbpDepartmentIds` from user's `hrbp_departments`.

**Step 4: Create Manager pages** — same pattern, `requireRole(['manager'])`, scope `fetchPipList` by `managerId: user.id`.

**Step 5: Commit**

```bash
git add "src/app/(dashboard)/admin/pip/" "src/app/(dashboard)/hrbp/pip/" "src/app/(dashboard)/manager/pip/"
git commit -m "feat(pip): add 6 route pages (list + detail) for admin, hrbp, manager"
```

---

### Task 7: Employee PIP Banner Component

**Files:**
- Create: `src/components/pip-banner.tsx`
- Modify: `src/app/(dashboard)/employee/page.tsx` — add PIP banner at top

**Step 1: Create PipBanner component**

Server component that:
1. Queries `prisma.pip.findFirst({ where: { employee_id, status: { in: ['active', 'extended'] } } })` with milestone counts
2. If no active PIP → renders nothing
3. If active PIP → renders alert banner:
   - Amber/red background glass card
   - "You are on a Performance Improvement Plan" heading
   - Milestone progress: "2/4 milestones completed"
   - Days remaining
   - "View Details" link to `/employee/pip/[id]` (or modal)
   - "Acknowledge" button if not yet acknowledged

**Step 2: Add banner to employee dashboard**

Import `PipBanner` and place it above existing content in `src/app/(dashboard)/employee/page.tsx`.

**Step 3: Commit**

```bash
git add src/components/pip-banner.tsx "src/app/(dashboard)/employee/page.tsx"
git commit -m "feat(pip): add employee PIP banner with milestone progress"
```

---

### Task 8: Sidebar Nav Links

**Files:**
- Modify: `src/components/sidebar.tsx`

**Step 1: Add PIP nav items**

Import `AlertTriangle` from `lucide-react` (or `ClipboardMinus` — pick an icon that conveys improvement/warning).

Add to `NAV_ITEMS`:

- **admin** array: After `{ label: 'Top Talent', ... }`, add:
  ```typescript
  { label: 'PIP', href: '/admin/pip', icon: AlertTriangle },
  ```

- **hrbp** array: After `{ label: 'Top Talent', ... }`, add:
  ```typescript
  { label: 'PIP', href: '/hrbp/pip', icon: AlertTriangle },
  ```

- **manager** array: After `{ label: 'Top Talent', ... }`, add:
  ```typescript
  { label: 'PIP', href: '/manager/pip', icon: AlertTriangle },
  ```

**Step 2: Commit**

```bash
git add src/components/sidebar.tsx
git commit -m "feat(pip): add PIP nav links to sidebar for admin, hrbp, manager"
```

---

### Task 9: Tests — PIP Data Layer + Actions

**Files:**
- Create: `src/lib/__tests__/pip.test.ts`

**Step 1: Write tests for PIP data layer and business logic**

Test suites:
1. **fetchPipList** — returns correct shape, filters by status, filters by managerId, filters by hrbpDepartmentIds, computes daysRemaining correctly, computes milestone progress
2. **fetchPipDetail** — returns full PIP with milestones/check-ins/documents, returns null for non-existent ID
3. **fetchPipRecommendations** — returns SME/BE employees, excludes employees with active PIP, returns empty for non-published cycle
4. **PIP lifecycle** — draft → active requires HRBP, acknowledge sets timestamp, extend resets status, complete requires outcome, close with not_improved flags correctly
5. **Role enforcement** — manager can create, employee cannot create, HRBP can activate, manager cannot activate, employee can acknowledge own PIP only

Follow testing patterns from `src/lib/__tests__/cycle-flow.test.ts` and `src/lib/__tests__/role-access.test.ts`:
- Mock `@/lib/prisma`, `@/lib/auth` (using `@/auth`), `next/navigation`, `react` cache
- Use `vi.mock()` at top level
- Use `makeUser`/`makeManager`/`makeHrbp` helpers from `src/test/helpers.ts`

**Step 2: Run tests**

Run: `npx vitest run src/lib/__tests__/pip.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/lib/__tests__/pip.test.ts
git commit -m "test(pip): add PIP data layer and lifecycle tests"
```

---

## Batch Execution Strategy

**Batch 1 (Tasks 1-3):** Schema + Data Layer + Server Actions — foundation, no UI
**Batch 2 (Tasks 4-6):** Dashboard + Detail + Route Pages — UI layer
**Batch 3 (Tasks 7-8):** Employee Banner + Sidebar Links — integration
**Batch 4 (Task 9):** Tests
