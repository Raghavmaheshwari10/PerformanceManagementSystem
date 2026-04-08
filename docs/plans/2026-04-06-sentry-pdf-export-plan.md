# Sentry Error Monitoring + PDF Appraisal Export — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add production error monitoring via Sentry and allow employees/HRBP/admins to download a full appraisal PDF after cycle results are published.

**Architecture:** Sentry uses `@sentry/nextjs` with automatic instrumentation + manual capture on critical server actions. PDF uses `@react-pdf/renderer` in a Next.js API route (`/api/pdf/appraisal`) that fetches data server-side, renders a branded A4 document, and streams it back as `application/pdf`.

**Tech Stack:** `@sentry/nextjs`, `@react-pdf/renderer`, Next.js 16 API routes, Prisma 7, NextAuth session

---

## PART 1 — Sentry Error Monitoring

---

### Task 1: Install Sentry SDK

**Files:**
- Modify: `package.json` (via npm install)

**Step 1: Install the package**

```bash
cd "C:\Users\Raghav Maheshwari\Performance-System-hRMS\.claude\worktrees\charming-bouman"
npm install @sentry/nextjs
```

Expected: `@sentry/nextjs` appears in `node_modules` and `package.json` dependencies.

**Step 2: Verify install**

```bash
node -e "require('@sentry/nextjs'); console.log('ok')"
```

Expected: prints `ok`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @sentry/nextjs"
```

---

### Task 2: Create Sentry config files

**Files:**
- Create: `sentry.client.config.ts`
- Create: `sentry.server.config.ts`
- Create: `sentry.edge.config.ts`

**Step 1: Create `sentry.client.config.ts`**

```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  debug: false,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  integrations: [
    Sentry.replayIntegration(),
  ],
})
```

**Step 2: Create `sentry.server.config.ts`**

```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  debug: false,
})
```

**Step 3: Create `sentry.edge.config.ts`**

```typescript
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  debug: false,
})
```

**Step 4: Add DSN placeholder to `.env.local`**

Open `.env.local` and add at the bottom:
```
# Sentry — paste DSN from https://sentry.io after creating a Next.js project
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
SENTRY_AUTH_TOKEN=
```

**Step 5: Commit**

```bash
git add sentry.client.config.ts sentry.server.config.ts sentry.edge.config.ts .env.local
git commit -m "feat(sentry): add client, server, and edge config files"
```

---

### Task 3: Wrap next.config.ts with withSentryConfig

**Files:**
- Modify: `next.config.ts`

**Step 1: Read current next.config.ts** — it currently contains:
```typescript
import type { NextConfig } from "next";
const nextConfig: NextConfig = { ... };
export default nextConfig;
```

**Step 2: Replace with Sentry-wrapped version**

```typescript
import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: ['100.103.227.36', '127.0.0.1', 'localhost', '0.0.0.0'],
  }),
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,           // suppress build output noise
  hideSourceMaps: true,   // don't expose source maps to client
  disableLogger: true,
  automaticVercelMonitors: false,
})
```

**Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

**Step 4: Commit**

```bash
git add next.config.ts
git commit -m "feat(sentry): wrap next.config with withSentryConfig"
```

---

### Task 4: Attach user context in dashboard layout

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

**Step 1: Add Sentry user context after `getCurrentUser()`**

After the line `const user = await getCurrentUser()`, add:

```typescript
// Sentry user context — attaches user identity to every error event
import * as Sentry from '@sentry/nextjs'
// (add import at top of file)
```

At top of file add:
```typescript
import * as Sentry from '@sentry/nextjs'
```

After `const user = await getCurrentUser()` add:
```typescript
  Sentry.setUser({ id: user.id, email: user.email, username: user.full_name })
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add "src/app/(dashboard)/layout.tsx"
git commit -m "feat(sentry): attach user context to all error events"
```

---

### Task 5: Create global error boundary for client-side errors

**Files:**
- Create: `src/app/global-error.tsx`

**Step 1: Create the file**

```typescript
'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            An unexpected error occurred. Our team has been notified automatically.
          </p>
          <button
            onClick={reset}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/global-error.tsx
git commit -m "feat(sentry): add global error boundary with Sentry capture"
```

---

### Task 6: Create Sentry helper for server actions

**Files:**
- Create: `src/lib/sentry.ts`

**Step 1: Create the helper**

```typescript
import * as Sentry from '@sentry/nextjs'

/**
 * Wrap a server action with Sentry error capture.
 * Usage: captureServerActionError('uploadUsersCsv', error, { source: 'csv' })
 */
export function captureServerActionError(
  actionName: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  Sentry.withScope(scope => {
    scope.setTag('server_action', actionName)
    if (context) scope.setContext('action_context', context)
    Sentry.captureException(error)
  })
}
```

**Step 2: Add manual capture to critical server actions**

In each of these files, import and call `captureServerActionError` inside existing `catch` or error branches:

**`src/app/(dashboard)/admin/users/upload/actions.ts`** — inside the main try/catch:
```typescript
import { captureServerActionError } from '@/lib/sentry'
// inside catch:
captureServerActionError('uploadUsersWithMapping', err, { source })
```

**`src/lib/mis-sync.ts`** — inside sync error handlers:
```typescript
import { captureServerActionError } from '@/lib/sentry'
// inside catch:
captureServerActionError('misSync', err, { syncType })
```

**`src/lib/email.ts`** — inside send failures:
```typescript
import { captureServerActionError } from '@/lib/sentry'
// inside catch:
captureServerActionError('sendEmail', err, { to, type })
```

**Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/lib/sentry.ts src/app/\(dashboard\)/admin/users/upload/actions.ts src/lib/mis-sync.ts src/lib/email.ts
git commit -m "feat(sentry): add captureServerActionError helper + instrument critical paths"
```

---

## PART 2 — PDF Appraisal Export

---

### Task 7: Install @react-pdf/renderer

**Files:**
- Modify: `package.json` (via npm install)

**Step 1: Install**

```bash
npm install @react-pdf/renderer
npm install --save-dev @types/react-pdf 2>/dev/null || true
```

**Step 2: Verify**

```bash
node -e "require('@react-pdf/renderer'); console.log('ok')"
```

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @react-pdf/renderer"
```

---

### Task 8: Create the PDF document component

**Files:**
- Create: `src/components/pdf/appraisal-document.tsx`

This is a pure `@react-pdf/renderer` component — it uses `Document`, `Page`, `View`, `Text`, `StyleSheet` from that library, NOT regular HTML/Tailwind.

**Step 1: Create the file**

```typescript
import {
  Document, Page, View, Text, StyleSheet,
} from '@react-pdf/renderer'

// ── Types ───────────────────────────────────────────────────────────────────
export interface AppraisalPdfData {
  cycleName: string
  generatedAt: string
  employee: {
    fullName: string
    designation: string | null
    department: string | null
    managerName: string | null
    empCode: string | null
  }
  kras: Array<{
    title: string
    weight: number | null
    kpis: Array<{
      title: string
      unit: string | null
      target: number | null
      selfRating: number | null
      managerRating: number | null
      weight: number | null
      score: number | null
    }>
  }>
  competencies: Array<{
    name: string
    category: string
    rating: number | null
    proficiencyLabel: string | null
  }>
  finalRating: string | null
  compositeScore: number | null
  variablePay: number
  multiplier: number
  payoutAmount: number
}

// ── Styles ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page:        { fontSize: 9, fontFamily: 'Helvetica', padding: 36, color: '#1a1a2e' },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 10, borderBottom: '1.5pt solid #4f46e5' },
  headerTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#4f46e5' },
  headerSub:   { fontSize: 8, color: '#6b7280', marginTop: 2 },
  section:     { marginBottom: 12 },
  sectionTitle:{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#4f46e5', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5, paddingBottom: 3, borderBottom: '0.5pt solid #e5e7eb' },
  row:         { flexDirection: 'row', marginBottom: 2 },
  label:       { width: 120, color: '#6b7280' },
  value:       { flex: 1, fontFamily: 'Helvetica-Bold' },
  table:       { marginTop: 4 },
  th:          { flexDirection: 'row', backgroundColor: '#f3f4f6', padding: '4pt 6pt', borderBottom: '0.5pt solid #d1d5db' },
  td:          { flexDirection: 'row', padding: '3pt 6pt', borderBottom: '0.5pt solid #f3f4f6' },
  col1:        { flex: 3 },
  col2:        { flex: 1, textAlign: 'center' },
  colHeader:   { fontFamily: 'Helvetica-Bold', fontSize: 8, color: '#374151' },
  kraTitle:    { fontFamily: 'Helvetica-Bold', marginTop: 6, marginBottom: 2, backgroundColor: '#eff6ff', padding: '3pt 6pt', fontSize: 8.5 },
  finalBox:    { backgroundColor: '#f0fdf4', border: '1pt solid #86efac', borderRadius: 4, padding: 10, marginTop: 8 },
  finalLabel:  { fontSize: 8, color: '#15803d' },
  finalValue:  { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#15803d', marginTop: 1 },
  footer:      { position: 'absolute', bottom: 24, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: '#9ca3af', borderTop: '0.5pt solid #e5e7eb', paddingTop: 4 },
})

function fmt(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toFixed(1)
}

function fmtCurrency(n: number): string {
  return '₹' + n.toLocaleString('en-IN')
}

// ── Document ────────────────────────────────────────────────────────────────
export function AppraisalDocument({ data }: { data: AppraisalPdfData }) {
  return (
    <Document title={`Appraisal — ${data.employee.fullName} — ${data.cycleName}`}>
      <Page size="A4" style={S.page}>

        {/* Header */}
        <View style={S.header}>
          <View>
            <Text style={S.headerTitle}>Performance Appraisal</Text>
            <Text style={S.headerSub}>{data.cycleName}</Text>
          </View>
          <Text style={{ fontSize: 8, color: '#9ca3af' }}>CONFIDENTIAL</Text>
        </View>

        {/* Employee Info */}
        <View style={S.section}>
          <Text style={S.sectionTitle}>Employee Details</Text>
          <View style={S.row}><Text style={S.label}>Name</Text><Text style={S.value}>{data.employee.fullName}</Text></View>
          {data.employee.empCode && <View style={S.row}><Text style={S.label}>Employee Code</Text><Text style={S.value}>{data.employee.empCode}</Text></View>}
          {data.employee.designation && <View style={S.row}><Text style={S.label}>Designation</Text><Text style={S.value}>{data.employee.designation}</Text></View>}
          {data.employee.department && <View style={S.row}><Text style={S.label}>Department</Text><Text style={S.value}>{data.employee.department}</Text></View>}
          {data.employee.managerName && <View style={S.row}><Text style={S.label}>Reporting Manager</Text><Text style={S.value}>{data.employee.managerName}</Text></View>}
        </View>

        {/* KRA / KPI Breakdown */}
        {data.kras.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>KRA / KPI Breakdown</Text>
            <View style={S.table}>
              <View style={S.th}>
                <Text style={[S.col1, S.colHeader]}>KPI</Text>
                <Text style={[S.col2, S.colHeader]}>Target</Text>
                <Text style={[S.col2, S.colHeader]}>Weight</Text>
                <Text style={[S.col2, S.colHeader]}>Self</Text>
                <Text style={[S.col2, S.colHeader]}>Manager</Text>
                <Text style={[S.col2, S.colHeader]}>Score</Text>
              </View>
              {data.kras.map((kra, ki) => (
                <View key={ki}>
                  <Text style={S.kraTitle}>{kra.title}{kra.weight != null ? ` (${kra.weight}% weight)` : ''}</Text>
                  {kra.kpis.map((kpi, pi) => (
                    <View key={pi} style={S.td}>
                      <Text style={S.col1}>{kpi.title}</Text>
                      <Text style={S.col2}>{kpi.target != null ? `${kpi.target}${kpi.unit === 'percent' ? '%' : ''}` : '—'}</Text>
                      <Text style={S.col2}>{kpi.weight != null ? `${kpi.weight}%` : '—'}</Text>
                      <Text style={S.col2}>{fmt(kpi.selfRating)}</Text>
                      <Text style={S.col2}>{fmt(kpi.managerRating)}</Text>
                      <Text style={S.col2}>{fmt(kpi.score)}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Competencies */}
        {data.competencies.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionTitle}>Competency Assessment</Text>
            <View style={S.table}>
              <View style={S.th}>
                <Text style={[S.col1, S.colHeader]}>Competency</Text>
                <Text style={[S.col2, S.colHeader]}>Category</Text>
                <Text style={[S.col2, S.colHeader]}>Proficiency</Text>
                <Text style={[S.col2, S.colHeader]}>Rating</Text>
              </View>
              {data.competencies.map((c, i) => (
                <View key={i} style={S.td}>
                  <Text style={S.col1}>{c.name}</Text>
                  <Text style={S.col2}>{c.category}</Text>
                  <Text style={S.col2}>{c.proficiencyLabel ?? '—'}</Text>
                  <Text style={S.col2}>{fmt(c.rating)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Final Result */}
        <View style={S.finalBox}>
          <Text style={[S.sectionTitle, { color: '#15803d', borderBottomColor: '#86efac' }]}>Final Result</Text>
          <View style={{ flexDirection: 'row', gap: 20, flexWrap: 'wrap', marginTop: 4 }}>
            <View>
              <Text style={S.finalLabel}>Composite Score</Text>
              <Text style={S.finalValue}>{data.compositeScore != null ? `${data.compositeScore.toFixed(1)}%` : '—'}</Text>
            </View>
            <View>
              <Text style={S.finalLabel}>Rating</Text>
              <Text style={S.finalValue}>{data.finalRating ?? '—'}</Text>
            </View>
            <View>
              <Text style={S.finalLabel}>Variable Pay</Text>
              <Text style={S.finalValue}>{fmtCurrency(data.variablePay)}</Text>
            </View>
            <View>
              <Text style={S.finalLabel}>Multiplier</Text>
              <Text style={S.finalValue}>{data.multiplier.toFixed(2)}x</Text>
            </View>
            <View>
              <Text style={S.finalLabel}>Payout</Text>
              <Text style={[S.finalValue, { fontSize: 15 }]}>{fmtCurrency(data.payoutAmount)}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={S.footer} fixed>
          <Text>Generated: {data.generatedAt}</Text>
          <Text>CONFIDENTIAL — For internal use only</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/pdf/appraisal-document.tsx
git commit -m "feat(pdf): add AppraisalDocument component with @react-pdf/renderer"
```

---

### Task 9: Create the PDF API route

**Files:**
- Create: `src/app/api/pdf/appraisal/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AppraisalDocument } from '@/components/pdf/appraisal-document'
import type { AppraisalPdfData } from '@/components/pdf/appraisal-document'
import React from 'react'

export async function GET(req: NextRequest) {
  // 1. Auth
  let user: Awaited<ReturnType<typeof getCurrentUser>>
  try {
    user = await getCurrentUser()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse params
  const { searchParams } = req.nextUrl
  const cycleId    = searchParams.get('cycleId')
  const employeeId = searchParams.get('employeeId')
  if (!cycleId || !employeeId) {
    return NextResponse.json({ error: 'cycleId and employeeId are required' }, { status: 400 })
  }

  // 3. Role-based access control
  if (user.role === 'employee') {
    if (user.id !== employeeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (user.role === 'hrbp') {
    const hrbpDepts = await prisma.hrbpDepartment.findMany({
      where: { hrbp_id: user.id },
      select: { department_id: true },
    })
    const deptIds = hrbpDepts.map(d => d.department_id)
    const emp = await prisma.user.findUnique({ where: { id: employeeId }, select: { department_id: true } })
    if (!emp || !deptIds.includes(emp.department_id!)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (!['admin', 'manager'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 4. Fetch cycle (must be published for employees)
  const cycle = await prisma.cycle.findUnique({
    where: { id: cycleId },
    select: { name: true, status: true },
  })
  if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })
  if (user.role === 'employee' && cycle.status !== 'published') {
    return NextResponse.json({ error: 'Results not yet published' }, { status: 403 })
  }

  // 5. Fetch employee
  const employee = await prisma.user.findUnique({
    where: { id: employeeId },
    select: {
      full_name: true,
      designation: true,
      emp_code: true,
      department: { select: { name: true } },
      manager: { select: { full_name: true } },
    },
  })
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

  // 6. Fetch appraisal
  const appraisal = await prisma.appraisal.findFirst({
    where: { cycle_id: cycleId, employee_id: employeeId },
    select: {
      final_rating: true,
      composite_score: true,
      payout_multiplier: true,
      payout_amount: true,
      snapshotted_variable_pay: true,
    },
  })

  // 7. Fetch KRAs + KPIs
  const kras = await prisma.kra.findMany({
    where: { cycle_id: cycleId, employee_id: employeeId },
    select: {
      title: true,
      weight: true,
      kpis: {
        select: {
          title: true,
          unit: true,
          target: true,
          weight: true,
          self_rating: true,
          manager_rating: true,
          score: true,
        },
      },
    },
    orderBy: { created_at: 'asc' },
  })

  // 8. Fetch competency review responses
  const responses = await prisma.reviewResponse.findMany({
    where: {
      review: { cycle_id: cycleId, reviewee_id: employeeId },
      question: { competency_id: { not: null } },
    },
    select: {
      rating_value: true,
      question: {
        select: {
          competency: {
            select: { name: true, category: true },
          },
        },
      },
    },
  })

  // 9. Build PDF data
  const pdfData: AppraisalPdfData = {
    cycleName: cycle.name,
    generatedAt: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
    employee: {
      fullName: employee.full_name,
      designation: employee.designation,
      department: employee.department?.name ?? null,
      managerName: employee.manager?.full_name ?? null,
      empCode: employee.emp_code,
    },
    kras: kras.map(k => ({
      title: k.title,
      weight: k.weight ? Number(k.weight) : null,
      kpis: k.kpis.map(p => ({
        title: p.title,
        unit: p.unit,
        target: p.target ? Number(p.target) : null,
        weight: p.weight ? Number(p.weight) : null,
        selfRating: p.self_rating ? Number(p.self_rating) : null,
        managerRating: p.manager_rating ? Number(p.manager_rating) : null,
        score: p.score ? Number(p.score) : null,
      })),
    })),
    competencies: responses
      .filter(r => r.question.competency)
      .map(r => ({
        name: r.question.competency!.name,
        category: r.question.competency!.category,
        rating: r.rating_value ? Number(r.rating_value) : null,
        proficiencyLabel: null, // extend later if needed
      })),
    finalRating: appraisal?.final_rating ?? null,
    compositeScore: appraisal?.composite_score ? Number(appraisal.composite_score) : null,
    variablePay: appraisal?.snapshotted_variable_pay ? Number(appraisal.snapshotted_variable_pay) : 0,
    multiplier: appraisal?.payout_multiplier ? Number(appraisal.payout_multiplier) : 0,
    payoutAmount: appraisal?.payout_amount ? Number(appraisal.payout_amount) : 0,
  }

  // 10. Render PDF
  const buffer = await renderToBuffer(
    React.createElement(AppraisalDocument, { data: pdfData })
  )

  const safeName = employee.full_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  const safeCycle = cycle.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="appraisal_${safeName}_${safeCycle}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Fix any Prisma field name mismatches (e.g. `composite_score`, `self_rating`, `manager_rating` — check exact names in `prisma/schema.prisma` if errors appear).

**Step 3: Commit**

```bash
git add src/app/api/pdf/appraisal/route.ts
git commit -m "feat(pdf): add /api/pdf/appraisal API route with role-based access"
```

---

### Task 10: Create reusable DownloadAppraisalButton component

**Files:**
- Create: `src/components/download-appraisal-button.tsx`

**Step 1: Create the component**

```typescript
'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface DownloadAppraisalButtonProps {
  cycleId: string
  employeeId: string
  label?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'icon'
}

export function DownloadAppraisalButton({
  cycleId,
  employeeId,
  label = 'Download Appraisal',
  variant = 'outline',
  size = 'sm',
}: DownloadAppraisalButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleDownload() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/pdf/appraisal?cycleId=${cycleId}&employeeId=${employeeId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Error ${res.status}`)
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `appraisal.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Button
        variant={variant}
        size={size}
        onClick={handleDownload}
        disabled={loading}
        className="gap-1.5"
      >
        {loading
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <Download className="h-3.5 w-3.5" />
        }
        {size !== 'icon' && (loading ? 'Generating…' : label)}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
```

**Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/download-appraisal-button.tsx
git commit -m "feat(pdf): add DownloadAppraisalButton reusable component"
```

---

### Task 11: Add download button to employee dashboard

**Files:**
- Modify: `src/app/(dashboard)/employee/page.tsx`

**Step 1: Find the published results section**

Search for `isPublished && appraisal` in `src/app/(dashboard)/employee/page.tsx` — this is around line 848. The results block is rendered here.

**Step 2: Import the button at the top of the file**

```typescript
import { DownloadAppraisalButton } from '@/components/download-appraisal-button'
```

**Step 3: Add the download button after the payout breakdown**

Find `{isPublished && appraisal && (() => {` block. Inside it, after the `<PayoutBreakdown .../>` section and before the closing of that block, add:

```tsx
<div className="mt-4 flex justify-end">
  <DownloadAppraisalButton
    cycleId={cycle.id}
    employeeId={user.id}
    label="Download My Appraisal"
  />
</div>
```

Where `cycle.id` is the active cycle id and `user.id` is the current user. Check existing variable names in scope.

**Step 4: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add "src/app/(dashboard)/employee/page.tsx"
git commit -m "feat(pdf): add Download Appraisal button on employee dashboard"
```

---

### Task 12: Add download button to HRBP & Admin payouts pages

**Files:**
- Modify: `src/components/payout-table.tsx`

**Step 1: Find the per-row action area**

In `src/components/payout-table.tsx`, find where each employee row is rendered (around where `r.employeeName`, `r.payoutAmount` etc are shown). The `PayoutRow` interface needs two new fields:

Add to the `PayoutRow` interface at the top:
```typescript
interface PayoutRow {
  // ...existing fields...
  employeeId: string
  cycleId: string
}
```

**Step 2: Add DownloadAppraisalButton import**

```typescript
import { DownloadAppraisalButton } from '@/components/download-appraisal-button'
```

**Step 3: Add download button as last column in each row**

In the table header row, add:
```tsx
<th className="p-3 text-right text-muted-foreground">PDF</th>
```

In each data row, add the last cell:
```tsx
<td className="p-3 text-right">
  <DownloadAppraisalButton
    cycleId={r.cycleId}
    employeeId={r.employeeId}
    size="icon"
    variant="ghost"
  />
</td>
```

**Step 4: Update callers** — `src/app/(dashboard)/hrbp/payouts/page.tsx` and `src/app/(dashboard)/admin/payouts/page.tsx` need to pass `employeeId` and `cycleId` in each row. Add those fields to the query selects and the row mapping.

In `hrbp/payouts/page.tsx`, update the appraisal select:
```typescript
select: {
  cycle_id: true,
  employee_id: true,   // add this
  // ...existing fields...
}
```

And in the push:
```typescript
payoutsByCycle[a.cycle_id].push({
  employeeId: a.employee_id,   // add this
  cycleId: a.cycle_id,         // add this
  // ...existing fields...
})
```

Repeat for `admin/payouts/page.tsx`.

**Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add src/components/payout-table.tsx "src/app/(dashboard)/hrbp/payouts/page.tsx" "src/app/(dashboard)/admin/payouts/page.tsx"
git commit -m "feat(pdf): add per-employee PDF download button on HRBP and Admin payouts pages"
```

---

### Task 13: Final verification and push

**Step 1: Full TypeScript check**

```bash
npx tsc --noEmit
```

**Step 2: Build check**

```bash
npx next build 2>&1 | tail -20
```

Expected: successful build, `/api/pdf/appraisal` listed as a dynamic route.

**Step 3: Push to master**

```bash
git push origin claude/charming-bouman:master
```

---

## Sentry Setup Reminder (manual step for user)

After implementation:
1. Go to [sentry.io](https://sentry.io) → New Project → Next.js
2. Copy the DSN
3. In `.env.local` set: `NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...`
4. In Sentry project settings → Auth Tokens → create one and set `SENTRY_AUTH_TOKEN`
5. Set `SENTRY_ORG` and `SENTRY_PROJECT` to match your Sentry org/project slugs
6. On Vercel: add the same env vars to project settings

---

## Summary of all new files

| File | Purpose |
|------|---------|
| `sentry.client.config.ts` | Sentry browser init |
| `sentry.server.config.ts` | Sentry Node.js init |
| `sentry.edge.config.ts` | Sentry edge init |
| `src/app/global-error.tsx` | Root error boundary |
| `src/lib/sentry.ts` | `captureServerActionError` helper |
| `src/components/pdf/appraisal-document.tsx` | PDF layout component |
| `src/app/api/pdf/appraisal/route.ts` | PDF generation API route |
| `src/components/download-appraisal-button.tsx` | Reusable download button |
