# PMS Additions Plan — Comprehensive Research-Backed Specification

**Date:** 2026-03-01
**Status:** Research Complete — Ready for Implementation
**Research method:** 6 parallel sub-agents covering codebase audit, KPI templates, help/docs patterns, command palette, OAuth + Zimyo independence, and budget/payout.

---

## Table of Contents

1. [Critical Bug Fix — FEE / EE Multipliers](#1-critical-bug-fix--fee--ee-multipliers)
2. [KPI Templates by Role](#2-kpi-templates-by-role)
3. [In-App Help & Documentation](#3-in-app-help--documentation)
4. [Command Palette (⌘K / Ctrl+K)](#4-command-palette-k--ctrlk)
5. [Google Workspace OAuth](#5-google-workspace-oauth)
6. [Cycle Budget & Per-Employee Payout](#6-cycle-budget--per-employee-payout)
7. [Zimyo Independence](#7-zimyo-independence)
8. [Migration Sequence](#8-migration-sequence)

---

## 1. Critical Bug Fix — FEE / EE Multipliers

### Root cause (confirmed by codebase audit)

`src/lib/constants.ts` has correct values:
```typescript
{ code: 'FEE', fixedMultiplier: 1.25 }   // Far Exceeds Expectations → 125%
{ code: 'EE',  fixedMultiplier: 1.10 }   // Exceeds Expectations     → 110%
```

`supabase/migrations/00006_integrity_and_indexes.sql` `bulk_lock_appraisals` has **wrong** values:
```sql
WHEN 'FEE' THEN 0      -- BUG: should be 1.25
WHEN 'EE'  THEN 1.5    -- BUG: should be 1.10 (was copying old SME formula)
```

This means every cycle lock **zeros out FEE payouts** and **overpays EE by 40%**.

### Fix — migration 00008

```sql
-- supabase/migrations/00008_fix_multipliers.sql

CREATE OR REPLACE FUNCTION bulk_lock_appraisals(p_cycle_id uuid, p_sme_multiplier numeric)
RETURNS void AS $$
BEGIN
  UPDATE appraisals a
  SET
    final_rating      = COALESCE(a.final_rating, a.manager_rating),
    payout_multiplier = CASE COALESCE(a.final_rating, a.manager_rating)
      WHEN 'FEE' THEN 1.25
      WHEN 'EE'  THEN 1.10
      WHEN 'ME'  THEN 1.00
      WHEN 'SME' THEN 1.00 + p_sme_multiplier   -- variable: 0 → sme_multiplier
      WHEN 'BE'  THEN 0.00
      ELSE 0
    END,
    payout_amount = COALESCE(a.snapshotted_variable_pay, u.variable_pay)
      * CASE COALESCE(a.final_rating, a.manager_rating)
          WHEN 'FEE' THEN 1.25
          WHEN 'EE'  THEN 1.10
          WHEN 'ME'  THEN 1.00
          WHEN 'SME' THEN 1.00 + p_sme_multiplier
          WHEN 'BE'  THEN 0.00
          ELSE 0
        END
      * COALESCE(c.business_multiplier, 1.0),    -- see §6
    locked_at = now()
  FROM users u
  JOIN cycles c ON c.id = p_cycle_id
  WHERE a.cycle_id = p_cycle_id
    AND a.employee_id = u.id
    AND a.is_final = false
    AND COALESCE(a.final_rating, a.manager_rating) IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 2. KPI Templates by Role

### Purpose
Users have no idea what KPIs to enter. Templates surface sensible defaults per role, cut setup time from 20 min → 2 min, and embed SMART criteria to improve quality.

### Database additions

```sql
-- migration 00009_kpi_templates.sql

CREATE TABLE kpi_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_slug   text NOT NULL,                    -- e.g. 'software_engineer'
  title       text NOT NULL,                    -- e.g. 'Sprint Velocity'
  description text,
  unit        text NOT NULL DEFAULT 'percent',  -- percent | number | boolean | rating
  target      numeric,
  weight      numeric CHECK (weight > 0 AND weight <= 100),
  category    text NOT NULL DEFAULT 'performance', -- performance | behaviour | learning
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Public read; only admin can write
ALTER TABLE kpi_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads templates" ON kpi_templates FOR SELECT USING (true);
CREATE POLICY "admin writes templates" ON kpi_templates FOR ALL
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');
```

### RPC for applying a template

```sql
-- Copies template rows into kpis for a specific employee/cycle
CREATE OR REPLACE FUNCTION apply_kpi_template(
  p_role_slug   text,
  p_cycle_id    uuid,
  p_employee_id uuid
) RETURNS void AS $$
BEGIN
  INSERT INTO kpis (cycle_id, employee_id, title, description, unit, target, weight, category)
  SELECT p_cycle_id, p_employee_id, title, description, unit, target, weight, category
  FROM kpi_templates
  WHERE role_slug = p_role_slug
  ORDER BY sort_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Seed data — 10 role templates

#### 2.1 Software Engineer
| KPI | Unit | Target | Weight | Category |
|-----|------|--------|--------|----------|
| Sprint Velocity (story points/sprint) | number | 40 | 20 | performance |
| Code Review Turnaround (hrs) | number | 24 | 10 | performance |
| Bug Escape Rate (per release) | number | 2 | 15 | performance |
| Unit Test Coverage (%) | percent | 80 | 15 | performance |
| On-Time Feature Delivery (%) | percent | 90 | 20 | performance |
| Documentation Quality (self-rating 1–5) | rating | 4 | 10 | behaviour |
| Knowledge Sharing / Tech Talks | number | 2 | 10 | learning |

#### 2.2 Senior / Staff Engineer
| KPI | Unit | Target | Weight | Category |
|-----|------|--------|--------|----------|
| Architecture Reviews Completed | number | 4 | 15 | performance |
| Cross-Team Unblocking (incidents) | number | 6 | 15 | performance |
| Mentoring Sessions Conducted | number | 12 | 20 | behaviour |
| System Uptime / SLA Adherence (%) | percent | 99.5 | 20 | performance |
| RFC / Design Docs Authored | number | 3 | 15 | performance |
| Team Velocity Improvement (%) | percent | 10 | 15 | performance |

#### 2.3 Engineering Manager
| KPI | Unit | Target | Weight | Category |
|-----|------|--------|--------|----------|
| Team Delivery Predictability (%) | percent | 85 | 25 | performance |
| Employee Retention Rate (%) | percent | 90 | 20 | performance |
| 1:1 Completion Rate (%) | percent | 95 | 15 | behaviour |
| Hiring Targets Met (%) | percent | 100 | 15 | performance |
| Team Health Score (survey avg 1–5) | rating | 4 | 15 | behaviour |
| Cross-Functional Escalations Resolved | number | 3 | 10 | performance |

#### 2.4 Product Manager
| KPI | Unit | Target | Weight | Category |
|-----|------|--------|--------|----------|
| Feature Adoption Rate (%) | percent | 40 | 20 | performance |
| NPS / CSAT Score | number | 50 | 20 | performance |
| Roadmap Delivery on Time (%) | percent | 85 | 20 | performance |
| Stakeholder Satisfaction (1–5) | rating | 4 | 15 | behaviour |
| Discovery : Delivery Ratio | number | 2 | 15 | performance |
| Documentation / PRD Completeness | percent | 90 | 10 | behaviour |

#### 2.5 QA / SDET
| KPI | Unit | Target | Weight | Category |
|-----|------|--------|--------|----------|
| Test Automation Coverage (%) | percent | 70 | 25 | performance |
| Defect Detection Rate (before prod %) | percent | 85 | 25 | performance |
| Critical Bugs Found in Production | number | 0 | 20 | performance |
| Regression Cycle Time (days) | number | 3 | 15 | performance |
| Test Documentation Quality (1–5) | rating | 4 | 15 | behaviour |

#### 2.6 DevOps / SRE / Infrastructure
| KPI | Unit | Target | Weight | Category |
|-----|------|--------|--------|----------|
| System Uptime (%) | percent | 99.9 | 25 | performance |
| Mean Time To Recovery (MTTR, hrs) | number | 2 | 20 | performance |
| Deployment Frequency (per week) | number | 10 | 15 | performance |
| CI/CD Pipeline Success Rate (%) | percent | 95 | 15 | performance |
| Incident Prevention Actions | number | 4 | 15 | performance |
| Security Patch Compliance (%) | percent | 100 | 10 | performance |

#### 2.7 Sales / Business Development
| KPI | Unit | Target | Weight | Category |
|-----|------|--------|--------|----------|
| Revenue vs Target (%) | percent | 100 | 30 | performance |
| New Accounts Acquired | number | 5 | 20 | performance |
| Pipeline Coverage Ratio | number | 3 | 15 | performance |
| Client Retention Rate (%) | percent | 90 | 20 | performance |
| Proposal Conversion Rate (%) | percent | 30 | 15 | performance |

#### 2.8 HR / People Operations
| KPI | Unit | Target | Weight | Category |
|-----|------|--------|--------|----------|
| Time-to-Fill (days) | number | 30 | 20 | performance |
| Offer Acceptance Rate (%) | percent | 80 | 15 | performance |
| Employee Satisfaction Score (eNPS) | number | 40 | 20 | performance |
| Training Completion Rate (%) | percent | 90 | 15 | performance |
| Attrition Rate (%) | percent | 10 | 20 | performance |
| Policy Compliance Audits Completed | number | 4 | 10 | behaviour |

#### 2.9 Finance / Accounting
| KPI | Unit | Target | Weight | Category |
|-----|------|--------|--------|----------|
| Financial Report On-Time Delivery (%) | percent | 100 | 25 | performance |
| Budget Variance (%) | percent | 5 | 25 | performance |
| Accounts Receivable Days Outstanding | number | 30 | 20 | performance |
| Audit Findings (count) | number | 0 | 20 | performance |
| Process Automation Initiatives | number | 2 | 10 | learning |

#### 2.10 Operations / Project Management
| KPI | Unit | Target | Weight | Category |
|-----|------|--------|--------|----------|
| Project On-Time Delivery (%) | percent | 90 | 25 | performance |
| Budget Adherence (%) | percent | 95 | 20 | performance |
| SLA Breach Rate (%) | percent | 2 | 20 | performance |
| Process Improvement Initiatives | number | 3 | 20 | performance |
| Stakeholder Satisfaction (1–5) | rating | 4 | 15 | behaviour |

### UI — Template Picker Component

```tsx
// src/components/kpi-template-picker.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'

const ROLE_OPTIONS = [
  { value: 'software_engineer',    label: 'Software Engineer' },
  { value: 'senior_engineer',      label: 'Senior / Staff Engineer' },
  { value: 'engineering_manager',  label: 'Engineering Manager' },
  { value: 'product_manager',      label: 'Product Manager' },
  { value: 'qa_sdet',              label: 'QA / SDET' },
  { value: 'devops_sre',           label: 'DevOps / SRE' },
  { value: 'sales_bizdev',         label: 'Sales / BizDev' },
  { value: 'hr_people_ops',        label: 'HR / People Ops' },
  { value: 'finance',              label: 'Finance / Accounting' },
  { value: 'operations_pm',        label: 'Operations / PM' },
]

interface Props {
  cycleId: string
  employeeId: string
  onApplied?: () => void
}

export function KpiTemplatePicker({ cycleId, employeeId, onApplied }: Props) {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<string>()
  const [pending, setPending] = useState(false)

  async function handleApply() {
    if (!role) return
    setPending(true)
    // Call server action that invokes apply_kpi_template RPC
    // await applyKpiTemplate(role, cycleId, employeeId)
    setPending(false)
    setOpen(false)
    onApplied?.()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Use Template</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply KPI Template</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Pre-fills KPIs for your role. You can edit or delete them after.
        </p>
        <Select onValueChange={setRole}>
          <SelectTrigger><SelectValue placeholder="Select your role…" /></SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map(r => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleApply} disabled={!role || pending}>
          {pending ? 'Applying…' : 'Apply Template'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
```

---

## 3. In-App Help & Documentation

### Core insight (from research)
PMS users log in **~4 times per year** (once per cycle phase). Standard onboarding is useless — users have forgotten everything between sessions. The help system must be **contextual and surfaced at the moment of need**, not buried in a docs page.

### 5-tier help architecture

| Tier | Where | What |
|------|-------|------|
| 0 | Every dashboard | **CycleActionCard** — tells user exactly what to do next |
| 1 | Form labels | Inline copy + `?` tooltip icons |
| 2 | Any element | `HelpTooltip` component (hover/focus) |
| 3 | Complex pages | `HelpDrawer` — slides in from right, contextual |
| 4 | Dedicated page | `/help` route — full docs, Fuse.js search |

### Tier 0 — CycleActionCard (most important)

The single most impactful thing. Every role's dashboard leads with a card telling them the current state and the single next action.

```tsx
// src/components/cycle-action-card.tsx
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, CheckCircle2, Clock, ArrowRight } from 'lucide-react'
import Link from 'next/link'

type ActionState = 'action_required' | 'waiting' | 'complete' | 'no_cycle'

interface CycleActionCardProps {
  cycleName: string
  cycleStatus: string
  role: 'employee' | 'manager' | 'hrbp' | 'admin'
  actionState: ActionState
  actionLabel?: string
  actionHref?: string
  waitingFor?: string
  dueDate?: string
}

const icons = {
  action_required: <AlertCircle className="h-5 w-5 text-amber-500" />,
  waiting:         <Clock className="h-5 w-5 text-blue-500" />,
  complete:        <CheckCircle2 className="h-5 w-5 text-green-500" />,
  no_cycle:        null,
}

export function CycleActionCard({
  cycleName, cycleStatus, role,
  actionState, actionLabel, actionHref, waitingFor, dueDate
}: CycleActionCardProps) {
  return (
    <Card className="border-l-4" style={{
      borderLeftColor: {
        action_required: '#f59e0b',
        waiting: '#3b82f6',
        complete: '#22c55e',
        no_cycle: '#e5e7eb',
      }[actionState]
    }}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {icons[actionState]}
          <CardTitle className="text-base">{cycleName}</CardTitle>
          <Badge variant="outline" className="ml-auto text-xs">{cycleStatus}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {actionState === 'action_required' && actionLabel && actionHref && (
          <>
            {dueDate && (
              <p className="text-xs text-muted-foreground">Due: {dueDate}</p>
            )}
            <Button asChild size="sm">
              <Link href={actionHref}>
                {actionLabel} <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </>
        )}
        {actionState === 'waiting' && waitingFor && (
          <p className="text-sm text-muted-foreground">
            Waiting for: <span className="font-medium">{waitingFor}</span>
          </p>
        )}
        {actionState === 'complete' && (
          <p className="text-sm text-green-600">All done for this cycle phase!</p>
        )}
      </CardContent>
    </Card>
  )
}
```

### Tier 2 — HelpTooltip

```tsx
// src/components/help-tooltip.tsx
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from '@/components/ui/tooltip'
import { HelpCircle } from 'lucide-react'

interface HelpTooltipProps {
  content: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
}

export function HelpTooltip({ content, side = 'top' }: HelpTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex text-muted-foreground hover:text-foreground"
            aria-label="Help"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-sm">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
```

### Tier 3 — HelpDrawer

```tsx
// src/components/help-drawer.tsx
'use client'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { HelpCircle } from 'lucide-react'

interface HelpDrawerProps {
  title: string
  children: React.ReactNode
}

export function HelpDrawer({ title, children }: HelpDrawerProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <HelpCircle className="h-4 w-4" />
          Help
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4 text-sm leading-relaxed prose prose-sm max-w-none">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

### Tier 4 — /help route with Fuse.js search

```
src/app/help/
  page.tsx              ← search + category grid
  layout.tsx            ← breadcrumbs + back nav
  [slug]/page.tsx       ← individual article

src/lib/help-content.ts ← static array of help articles (no DB needed)
```

```typescript
// src/lib/help-content.ts
export interface HelpArticle {
  slug: string
  title: string
  summary: string
  roles: ('employee' | 'manager' | 'hrbp' | 'admin')[]
  body: string   // Markdown
}

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: 'what-is-pms',
    title: 'What is the Performance Management System?',
    summary: 'An overview of PMS and how it works at EMB Global.',
    roles: ['employee', 'manager', 'hrbp', 'admin'],
    body: `
## What is PMS?

The Performance Management System (PMS) is EMB Global's tool for setting goals,
tracking performance, and calculating variable pay (bonuses) every appraisal cycle.

## The 7-stage cycle

1. **Draft** — Admin creates the cycle
2. **KPI Setting** — Employees set their goals
3. **Self Review** — Employees rate themselves
4. **Manager Review** — Managers rate each team member
5. **Calibrating** — HRBP reviews and may override ratings
6. **Locked** — Payouts are calculated; no more changes
7. **Published** — Employees can see their final rating and payout

## Your variable pay

\`Variable Pay × Individual Multiplier × Business Multiplier\`

- **FEE** (Far Exceeds Expectations) → 1.25×
- **EE** (Exceeds Expectations) → 1.10×
- **ME** (Meets Expectations) → 1.00×
- **SME** (Some Meets Expectations) → variable (set each cycle)
- **BE** (Below Expectations) → 0×
    `
  },
  {
    slug: 'setting-kpis',
    title: 'How to set your KPIs',
    summary: 'Step-by-step guide to setting meaningful, measurable goals.',
    roles: ['employee'],
    body: `
## When can I set KPIs?

You can set KPIs when the cycle is in **KPI Setting** stage.
Check your dashboard for the action card.

## Using templates

Click **"Use Template"** to load pre-built KPIs for your role.
You can edit, delete, or add to them.

## Weights

Each KPI has a weight (percentage). All weights must add up to exactly 100%.
    `
  },
  {
    slug: 'self-review',
    title: 'Completing your self-review',
    summary: 'How to rate yourself and write meaningful comments.',
    roles: ['employee'],
    body: `
## Rating scale

| Rating | Meaning |
|--------|---------|
| FEE | Far Exceeds Expectations |
| EE  | Exceeds Expectations |
| ME  | Meets Expectations |
| SME | Some Meets Expectations |
| BE  | Below Expectations |

## Writing good comments

Be specific — cite deliverables, metrics, or incidents. Keep it factual.
    `
  },
  {
    slug: 'manager-review',
    title: 'How to review your team',
    summary: 'Guide for managers on rating employees and submitting reviews.',
    roles: ['manager'],
    body: `
## Before you start

1. Review each employee's KPIs and self-review
2. Be consistent — calibrate ratings relative to the whole team

## After submission

Your ratings go to HRBP for calibration. They may adjust ratings.
Final ratings are visible after the cycle is locked.
    `
  },
  {
    slug: 'calibration',
    title: 'Calibration and HRBP overrides',
    summary: 'How HRBP reviews, adjusts, and finalises ratings.',
    roles: ['hrbp', 'admin'],
    body: `
## Overriding a rating

Find the appraisal in calibration view. Set a new final rating and add
a justification. Once marked **is_final**, managers cannot overwrite it.

## Locking the cycle

When calibration is complete, click **Lock Cycle**. This calculates final
payouts for every employee and freezes all data. This cannot be undone.
    `
  },
]
```

### CycleStageBanner

```tsx
// src/components/cycle-stage-banner.tsx
import { Badge } from '@/components/ui/badge'
import { CYCLE_STATUS_LABELS } from '@/lib/constants'
import type { CycleStatus } from '@/lib/types'

const STATUS_COLORS: Record<CycleStatus, string> = {
  draft:           'bg-gray-100 text-gray-700',
  kpi_setting:     'bg-blue-100 text-blue-800',
  self_review:     'bg-yellow-100 text-yellow-800',
  manager_review:  'bg-orange-100 text-orange-800',
  calibrating:     'bg-purple-100 text-purple-800',
  locked:          'bg-red-100 text-red-800',
  published:       'bg-green-100 text-green-800',
}

export function CycleStageBanner({ cycleName, status }: { cycleName: string; status: CycleStatus }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-2 text-sm">
      <span className="font-medium">{cycleName}</span>
      <Badge className={STATUS_COLORS[status]}>
        {CYCLE_STATUS_LABELS[status]}
      </Badge>
    </div>
  )
}
```

---

## 4. Command Palette (⌘K / Ctrl+K)

### Library: `cmdk`
The same library shadcn/ui uses internally. Install: `npm install cmdk`

> Note: `cmdk` may already be a transitive dependency via shadcn/ui — check `node_modules/cmdk` before installing.

### Architecture

```
src/
  components/
    command-palette/
      index.tsx                ← provider + context
      command-palette.tsx      ← dialog + Command component
      commands.ts              ← static command registry
  hooks/
    use-contextual-commands.ts ← page-specific command injection
    use-frecency.ts            ← frecency ranking
```

### Frecency hook

```typescript
// src/hooks/use-frecency.ts
'use client'
import { useCallback } from 'react'

interface FrecencyRecord {
  score: number
  lastUsed: number
}

const STORAGE_KEY = 'pms-cmd-frecency'
const DECAY = 0.9   // score decays 10% per day

function load(): Record<string, FrecencyRecord> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  catch { return {} }
}

export function useFrecency() {
  const record = useCallback((id: string) => {
    const data = load()
    const existing = data[id] ?? { score: 0, lastUsed: 0 }
    const daysSince = (Date.now() - existing.lastUsed) / 86_400_000
    data[id] = {
      score: existing.score * Math.pow(DECAY, daysSince) + 1,
      lastUsed: Date.now(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [])

  const getScore = useCallback((id: string): number => {
    const r = load()[id]
    if (!r) return 0
    const daysSince = (Date.now() - r.lastUsed) / 86_400_000
    return r.score * Math.pow(DECAY, daysSince)
  }, [])

  return { record, getScore }
}
```

### Command registry

```typescript
// src/components/command-palette/commands.ts
import type { UserRole } from '@/lib/types'

export interface PaletteCommand {
  id: string
  label: string
  description?: string
  href?: string
  action?: () => void
  roles: UserRole[]      // empty array = all roles
  keywords?: string[]
}

export const STATIC_COMMANDS: PaletteCommand[] = [
  // --- Employee ---
  { id: 'nav-employee-dashboard', label: 'Go to Dashboard',       href: '/employee',        roles: ['employee'], keywords: ['home'] },
  { id: 'nav-employee-kpis',      label: 'Set my KPIs',           href: '/employee/kpis',   roles: ['employee'], keywords: ['goals', 'objectives'] },
  { id: 'nav-employee-review',    label: 'Complete Self Review',  href: '/employee/review', roles: ['employee'], keywords: ['appraisal', 'rating'] },
  // --- Manager ---
  { id: 'nav-manager-team',       label: 'View My Team',          href: '/manager',         roles: ['manager'],  keywords: ['employees'] },
  { id: 'nav-manager-reviews',    label: 'Review Team',           href: '/manager/reviews', roles: ['manager'],  keywords: ['rate', 'appraise'] },
  // --- HRBP ---
  { id: 'nav-hrbp-calibrate',     label: 'Calibration View',      href: '/hrbp/calibration',roles: ['hrbp'],     keywords: ['override', 'final'] },
  { id: 'nav-hrbp-cycles',        label: 'Manage Cycles',         href: '/hrbp/cycles',     roles: ['hrbp'],     keywords: ['cycle'] },
  // --- Admin ---
  { id: 'nav-admin-users',        label: 'Manage Users',          href: '/admin/users',     roles: ['admin'],    keywords: ['people', 'employees'] },
  { id: 'nav-admin-cycles',       label: 'Manage Cycles',         href: '/admin/cycles',    roles: ['admin'],    keywords: ['cycle', 'period'] },
  { id: 'nav-admin-templates',    label: 'Manage KPI Templates',  href: '/admin/kpi-templates', roles: ['admin'], keywords: ['template'] },
  // --- Help (all roles) ---
  { id: 'help-overview',          label: 'Help: What is PMS?',    href: '/help/what-is-pms',roles: [],           keywords: ['help', 'about', 'overview'] },
  { id: 'help-kpis',              label: 'Help: Setting KPIs',    href: '/help/setting-kpis',roles: [],          keywords: ['help', 'kpi', 'goals'] },
  { id: 'help-review',            label: 'Help: Self Review',     href: '/help/self-review',roles: [],           keywords: ['help', 'review', 'rating'] },
]
```

### Command Palette component

```tsx
// src/components/command-palette/command-palette.tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useFrecency } from '@/hooks/use-frecency'
import { STATIC_COMMANDS, type PaletteCommand } from './commands'
import type { UserRole } from '@/lib/types'

interface Props {
  role: UserRole
  extraCommands?: PaletteCommand[]
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function CommandPalette({ role, extraCommands = [], open, onOpenChange }: Props) {
  const router = useRouter()
  const { record, getScore } = useFrecency()

  const all = [...STATIC_COMMANDS, ...extraCommands]
    .filter(cmd => cmd.roles.length === 0 || cmd.roles.includes(role))
    .sort((a, b) => getScore(b.id) - getScore(a.id))

  function run(cmd: PaletteCommand) {
    record(cmd.id)
    onOpenChange(false)
    if (cmd.href) router.push(cmd.href)
    else cmd.action?.()
  }

  const recent  = all.filter(c => getScore(c.id) > 0)
  const theRest = all.filter(c => getScore(c.id) === 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-xl overflow-hidden">
        <Command>
          <Command.Input
            placeholder="Type a command or search…"
            className="h-12 w-full border-0 bg-transparent px-4 text-base outline-none"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>
            {recent.length > 0 && (
              <Command.Group heading="Recent">
                {recent.map(cmd => (
                  <Command.Item
                    key={cmd.id}
                    value={[cmd.label, ...(cmd.keywords ?? [])].join(' ')}
                    onSelect={() => run(cmd)}
                    className="flex cursor-pointer items-center rounded px-2 py-1.5 text-sm aria-selected:bg-accent"
                  >
                    {cmd.label}
                  </Command.Item>
                ))}
              </Command.Group>
            )}
            <Command.Group heading="All">
              {theRest.map(cmd => (
                <Command.Item
                  key={cmd.id}
                  value={[cmd.label, ...(cmd.keywords ?? [])].join(' ')}
                  onSelect={() => run(cmd)}
                  className="flex cursor-pointer items-center rounded px-2 py-1.5 text-sm aria-selected:bg-accent"
                >
                  {cmd.label}
                  {cmd.description && (
                    <span className="ml-auto text-xs text-muted-foreground">{cmd.description}</span>
                  )}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
```

### Provider + global keyboard shortcut

```tsx
// src/components/command-palette/index.tsx
'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { CommandPalette } from './command-palette'
import type { PaletteCommand } from './commands'
import type { UserRole } from '@/lib/types'

interface CtxValue {
  addCommands:    (cmds: PaletteCommand[]) => void
  removeCommands: (ids: string[]) => void
}
const Ctx = createContext<CtxValue | null>(null)
export const useCommandPalette = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('CommandPaletteProvider missing')
  return ctx
}

export function CommandPaletteProvider({
  role, children
}: { role: UserRole; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [extra, setExtra] = useState<PaletteCommand[]>([])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(v => !v)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Ctx.Provider value={{
      addCommands:    cmds => setExtra(p => [...p, ...cmds]),
      removeCommands: ids  => setExtra(p => p.filter(c => !ids.includes(c.id))),
    }}>
      <CommandPalette role={role} extraCommands={extra} open={open} onOpenChange={setOpen} />
      {children}
    </Ctx.Provider>
  )
}
```

### Trigger button for nav bar

```tsx
<button
  onClick={() => setOpen(true)}
  className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
>
  <span>Search…</span>
  <kbd className="ml-auto rounded border bg-muted px-1.5 text-xs font-mono">⌘K</kbd>
</button>
```

---

## 5. Google Workspace OAuth

### What the research confirmed

1. **`src/app/auth/callback/route.ts` already handles PKCE** — `exchangeCodeForSession(code)` is there. No changes needed.
2. **Automatic identity linking** — same email (magic link user + Google sign-in) → Supabase links identities, one `auth.users` row.
3. **`custom_access_token_hook` works unchanged** — it looks up users by email, not `auth.uid`. Google OAuth users are found the same way.
4. **`hd` parameter is UX only** — must also enforce server-side via `before_user_created` hook.

### Step 1 — supabase/config.toml

```toml
# Add after [auth.external.apple] section
[auth.external.google]
enabled = true
client_id = "env(GOOGLE_CLIENT_ID)"
secret    = "env(GOOGLE_CLIENT_SECRET)"
redirect_uri = ""

[auth.hook.before_user_created]
enabled = true
uri = "pg-functions://postgres/public/before_user_created_hook"
```

### Step 2 — .env.local

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

### Step 3 — Domain enforcement hook (migration 00010)

```sql
-- supabase/migrations/00010_google_domain_hook.sql

-- Server-side domain restriction for Google OAuth
-- Rejects any Google account that is not @embglobal.com
CREATE OR REPLACE FUNCTION public.before_user_created_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email    text := (event->>'email')::text;
  v_provider text := (event->'app_metadata'->>'provider')::text;
BEGIN
  IF v_provider = 'google' AND v_email NOT LIKE '%@embglobal.com' THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message',   'Only @embglobal.com accounts are permitted.'
      )
    );
  END IF;
  RETURN event;
END;
$$;

GRANT EXECUTE ON FUNCTION public.before_user_created_hook TO supabase_auth_admin;
```

### Step 4 — Callback error handling

```typescript
// src/app/auth/callback/route.ts — add after exchangeCodeForSession
if (error) {
  const msg = error.message ?? ''
  if (msg.includes('not_provisioned') || msg.includes('forbidden')) {
    return NextResponse.redirect(new URL('/auth/not-provisioned', request.url))
  }
  return NextResponse.redirect(new URL('/login?error=auth_error', request.url))
}
```

```tsx
// src/app/auth/not-provisioned/page.tsx
export default function NotProvisionedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold">Account Not Set Up</h1>
      <p className="max-w-md text-muted-foreground">
        Your Google account was verified, but you haven't been added to PMS yet.
        Contact your HR administrator to get access.
      </p>
    </div>
  )
}
```

### Step 5 — Login page button

```tsx
// src/app/login/page.tsx — add Google button
async function signInWithGoogle() {
  const supabase = createClient()
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        hd: 'embglobal.com',        // shows "only embglobal.com" hint in Google UI
        access_type: 'online',
        prompt: 'select_account',
      },
    },
  })
}
```

### Google Cloud Console checklist

1. APIs & Services → Credentials → Create OAuth 2.0 Client (Web application)
2. **Authorised JavaScript origins:**
   - `http://localhost:3000`
   - `https://your-production-domain.com`
3. **Authorised redirect URIs:**
   - `http://127.0.0.1:54160/auth/v1/callback` (local)
   - `https://<project-ref>.supabase.co/auth/v1/callback` (hosted)
4. Copy Client ID + Secret → `.env.local` + Supabase dashboard secrets

---

## 6. Cycle Budget & Per-Employee Payout

### Formula (SAP SuccessFactors / Workday pattern)

```
Payout = Snapshotted Variable Pay × Individual Multiplier × Business Multiplier
```

| Component | Source |
|-----------|--------|
| Snapshotted Variable Pay | `appraisals.snapshotted_variable_pay` (frozen at appraisal creation) |
| Individual Multiplier | Rating → FEE=1.25, EE=1.10, ME=1.00, SME=variable, BE=0 |
| Business Multiplier | `cycles.business_multiplier` (set by leadership per cycle, 0–2.0) |

### Migration 00012 — Budget fields

```sql
-- supabase/migrations/00012_budget_fields.sql

-- 1. Business multiplier + budget envelope on cycles
ALTER TABLE cycles
  ADD COLUMN business_multiplier numeric NOT NULL DEFAULT 1.0
    CHECK (business_multiplier >= 0 AND business_multiplier <= 2.0),
  ADD COLUMN total_budget numeric,
  ADD COLUMN budget_currency text NOT NULL DEFAULT 'INR';

-- 2. Snapshotted variable pay on appraisals
ALTER TABLE appraisals
  ADD COLUMN snapshotted_variable_pay numeric;

-- 3. Freeze variable_pay at appraisal creation time
CREATE OR REPLACE FUNCTION snapshot_variable_pay()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.snapshotted_variable_pay IS NULL THEN
    SELECT variable_pay INTO NEW.snapshotted_variable_pay
    FROM users WHERE id = NEW.employee_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER appraisal_snapshot_var_pay
  BEFORE INSERT ON appraisals
  FOR EACH ROW EXECUTE FUNCTION snapshot_variable_pay();
```

### Cycle creation / edit form additions

| Field | Type | Validation |
|-------|------|-----------|
| `business_multiplier` | numeric input, step 0.05 | 0.00–2.00, default 1.00 |
| `total_budget` | optional numeric | positive |
| `budget_currency` | select | INR / USD / EUR |

### What-if payout simulator (HRBP / Admin)

```
/hrbp/cycles/[id]/payout-preview
```

Shows table:
- Employee | Variable Pay (snapshotted) | Rating | Individual Mult | Business Mult | Projected Payout
- Header: Total Budgeted | Projected Total | Over/Under Budget indicator
- Slider for `business_multiplier` → live recalculation without saving

### Employee payout breakdown (post-publish)

```tsx
// src/components/payout-breakdown.tsx
interface PayoutBreakdownProps {
  snapshottedVariablePay: number
  rating: string
  individualMultiplier: number
  businessMultiplier: number
  payoutAmount: number
  currency: string
}

// Renders a transparent breakdown:
// Your variable pay (at cycle start):  ₹X,XX,XXX
// × Individual multiplier (EE 1.10):        × 1.10
// × Business multiplier (FY25):             × 1.00
// ──────────────────────────────────────────────────
// = Your payout:                       ₹X,XX,XXX
```

### RLS additions

```sql
-- Employees see own appraisals only when cycle is published
CREATE POLICY "employee sees own published appraisal" ON appraisals
  FOR SELECT
  USING (
    employee_id = public.user_id()
    AND EXISTS (
      SELECT 1 FROM cycles c
      WHERE c.id = cycle_id AND c.status = 'published'
    )
  );
```

---

## 7. Zimyo Independence

### Root cause

```sql
-- migration 00002: zimyo_id text UNIQUE NOT NULL
-- → Every INSERT INTO users requires a zimyo_id
-- → bulk_update_manager_links only works via zimyo_id
```

### Migration 00011 — Zimyo independence

```sql
-- supabase/migrations/00011_zimyo_independence.sql

-- 1. Make zimyo_id optional
ALTER TABLE users ALTER COLUMN zimyo_id DROP NOT NULL;
ALTER TABLE users ALTER COLUMN zimyo_id SET DEFAULT NULL;
-- Note: PostgreSQL UNIQUE indexes ignore NULL values, so uniqueness still holds for non-null zimyo_ids

-- 2. Track how each user was created
ALTER TABLE users
  ADD COLUMN data_source text NOT NULL DEFAULT 'manual'
    CHECK (data_source IN ('manual', 'zimyo', 'google'));

-- 3. Update bulk_update_manager_links: skip users without zimyo_id, mark matched ones
CREATE OR REPLACE FUNCTION bulk_update_manager_links(
  p_zimyo_ids  text[],
  p_manager_ids uuid[]
) RETURNS void AS $$
BEGIN
  UPDATE users u
  SET
    manager_id  = m.manager_id,
    data_source = 'zimyo'
  FROM (
    SELECT unnest(p_zimyo_ids) AS zimyo_id,
           unnest(p_manager_ids) AS manager_id
  ) m
  WHERE u.zimyo_id = m.zimyo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Manual user creation

`src/app/admin/users/new/page.tsx` — only required fields:

| Field | Required | Notes |
|-------|----------|-------|
| `email` | ✓ | Must match what user will log in with (password or Google) |
| `full_name` | ✓ | |
| `role` | ✓ | employee / manager / hrbp / admin |
| `department` | ✓ | |
| `variable_pay` | ✓ | Used for payout calculation |
| `manager_id` | optional | Select from existing users |
| `zimyo_id` | optional | Only if this user also exists in Zimyo |

### User list — data source badges

```tsx
// Show per-user in admin user list
const SOURCE_BADGES = {
  manual: <Badge variant="outline">Manual</Badge>,
  zimyo:  <Badge className="bg-blue-100 text-blue-800">Zimyo ✓</Badge>,
  google: <Badge className="bg-red-100 text-red-800">Google</Badge>,
}
```

### Zimyo sync — additive, non-destructive

The sync function should:
1. Match on `zimyo_id` first, then fall back to `email`
2. Update `manager_id`, `department`, `variable_pay`
3. Set `data_source = 'zimyo'`, fill in `zimyo_id` if matched by email
4. **Never delete** users not found in Zimyo (they may be manually created admins/HRBPs)

---

## 8. Migration Sequence

| # | File | Contents |
|---|------|----------|
| 00008 | `00008_fix_multipliers.sql` | **P0** Fix FEE=0 / EE=1.5 bugs in `bulk_lock_appraisals` |
| 00009 | `00009_kpi_templates.sql` | `kpi_templates` table, RLS, `apply_kpi_template` RPC, 10-role seed data |
| 00010 | `00010_google_domain_hook.sql` | `before_user_created_hook` blocking non-`@embglobal.com` Google accounts |
| 00011 | `00011_zimyo_independence.sql` | `zimyo_id DROP NOT NULL`, `data_source` column, updated `bulk_update_manager_links` |
| 00012 | `00012_budget_fields.sql` | `business_multiplier`, `total_budget`, `budget_currency` on cycles; `snapshotted_variable_pay` + trigger on appraisals |

After migrations, update `supabase/config.toml`:
- Add `[auth.external.google]` block
- Add `[auth.hook.before_user_created]` block

Run: `npx supabase db reset` (local) or push migrations to hosted project.

---

## Implementation Priority

| Priority | Feature | Complexity | Impact |
|----------|---------|------------|--------|
| **P0** | Fix FEE/EE multiplier bug (00008) | Low — SQL only | Critical — data integrity |
| **P1** | Zimyo independence (00011) | Low — SQL only | High — unblocks manual user mgmt |
| **P1** | KPI Templates (00009 + picker UI) | Medium | High — biggest UX win for employees |
| **P1** | CycleActionCard component | Low — UI only | High — biggest help win, no migration needed |
| **P2** | Budget/Payout fields (00012 + UI) | Medium | High — requested feature |
| **P2** | Google OAuth (config + 00010) | Medium | High — EMB uses Google Workspace |
| **P2** | `/help` route + articles | Medium | Medium — searchable docs |
| **P3** | Command Palette (cmdk) | Medium | Medium — power-user feature |
| **P3** | HelpDrawer on complex pages | Low | Medium — contextual help |
| **P3** | Payout what-if simulator | Medium | Medium — HRBP planning tool |
