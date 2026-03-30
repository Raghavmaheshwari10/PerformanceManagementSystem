'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// ─── Section data ──────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'overview',        label: 'Overview' },
  { id: 'roles',           label: 'User Roles' },
  { id: 'cycle-lifecycle', label: 'Cycle Lifecycle' },
  { id: 'kra-kpi',         label: 'KRA & KPI Setup' },
  { id: 'user-flows',      label: 'User Flows' },
  { id: 'peer-reviews',    label: 'Peer Reviews' },
  { id: 'calculations',    label: 'Payout Calculations' },
  { id: 'quick-ref',       label: 'Quick Reference' },
]

// ─── Reusable primitives ───────────────────────────────────────────────────────

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-6 text-xl font-semibold text-foreground border-b pb-2 mb-5">
      {children}
    </h2>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-foreground mt-6 mb-2">{children}</h3>
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40 px-4 py-3 text-sm text-blue-900 dark:text-blue-200 my-4">
      {children}
    </div>
  )
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-200 my-4">
      {children}
    </div>
  )
}

function Tag({ children, color = 'default' }: { children: React.ReactNode; color?: 'default' | 'green' | 'blue' | 'purple' | 'amber' | 'red' }) {
  const colors = {
    default: 'bg-muted text-muted-foreground',
    green:   'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    blue:    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    purple:  'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    amber:   'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    red:     'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  }
  return (
    <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium', colors[color])}>
      {children}
    </span>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto rounded-md border my-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            {headers.map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-sm align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground">
      {children}
    </code>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="rounded-md border bg-muted/60 p-4 text-xs font-mono overflow-x-auto my-4 leading-relaxed whitespace-pre">
      {children}
    </pre>
  )
}

// ─── Stage flow component ──────────────────────────────────────────────────────

const STAGES = [
  { key: 'draft',           label: 'Draft',           who: 'Admin',       desc: 'Cycle created with scope (departments/employees) and deadlines' },
  { key: 'kpi_setting',     label: 'KPI Setting',     who: 'Managers',    desc: 'Managers define KRAs first, then add KPIs under each KRA' },
  { key: 'self_review',     label: 'Self Review',     who: 'Employees',   desc: 'Employees submit self-ratings and comments' },
  { key: 'manager_review',  label: 'Manager Review',  who: 'Managers',    desc: 'Managers rate each employee and add comments' },
  { key: 'calibrating',     label: 'Calibrating',     who: 'HRBP',        desc: 'HRBP reviews distribution, overrides if needed' },
  { key: 'locked',          label: 'Locked',          who: 'HRBP',        desc: 'Payouts calculated, results frozen' },
  { key: 'published',       label: 'Published',       who: 'HRBP',        desc: 'Employees can now see their rating and payout' },
]

function StageFlow() {
  return (
    <div className="relative my-6">
      <div className="flex flex-col gap-0">
        {STAGES.map((stage, i) => (
          <div key={stage.key} className="flex items-stretch gap-4">
            <div className="flex flex-col items-center w-8 flex-shrink-0">
              <div className={cn(
                'w-3 h-3 rounded-full border-2 flex-shrink-0 mt-3',
                stage.key === 'published' ? 'border-green-500 bg-green-500' : 'border-primary bg-background'
              )} />
              {i < STAGES.length - 1 && <div className="w-px flex-1 bg-border mt-0.5 mb-0.5 min-h-[24px]" />}
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-medium text-sm">{stage.label}</span>
                <Tag color={stage.key === 'published' ? 'green' : stage.key === 'locked' ? 'purple' : stage.key === 'calibrating' ? 'amber' : 'default'}>
                  {stage.who}
                </Tag>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{stage.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Collapsible role section ─────────────────────────────────────────────────

function RoleSection({
  title, color, badge, children
}: {
  title: string; color: 'blue' | 'green' | 'purple' | 'amber'; badge: string; children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  const borderColors = { blue: 'border-blue-200 dark:border-blue-900', green: 'border-green-200 dark:border-green-900', purple: 'border-purple-200 dark:border-purple-900', amber: 'border-amber-200 dark:border-amber-900' }
  const bgColors = { blue: 'bg-blue-50/50 dark:bg-blue-950/20', green: 'bg-green-50/50 dark:bg-green-950/20', purple: 'bg-purple-50/50 dark:bg-purple-950/20', amber: 'bg-amber-50/50 dark:bg-amber-950/20' }

  return (
    <div className={cn('rounded-lg border mb-4', borderColors[color])}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn('w-full flex items-center justify-between px-5 py-4 rounded-lg', open && 'rounded-b-none', bgColors[color])}
      >
        <div className="flex items-center gap-3">
          <Tag color={color}>{badge}</Tag>
          <span className="font-semibold text-sm">{title}</span>
        </div>
        <span className="text-muted-foreground text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-5 py-4 text-sm leading-relaxed space-y-3">
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Main docs page ────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [activeId, setActiveId] = useState('overview')
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id)
        }
      },
      { rootMargin: '-10% 0% -80% 0%', threshold: 0 }
    )
    const headings = contentRef.current?.querySelectorAll('h2[id]') ?? []
    headings.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="flex gap-8 min-h-0">
      {/* Sticky TOC */}
      <aside className="hidden lg:flex flex-col w-48 flex-shrink-0">
        <div className="sticky top-0 pt-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-2">Contents</p>
          <nav className="flex flex-col gap-0.5">
            {SECTIONS.map(s => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={cn(
                  'rounded px-2 py-1.5 text-sm transition-colors',
                  activeId === s.id
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                )}
                onClick={e => {
                  e.preventDefault()
                  document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              >
                {s.label}
              </a>
            ))}
          </nav>
        </div>
      </aside>

      {/* Content */}
      <div ref={contentRef} className="flex-1 max-w-3xl space-y-10 pb-16 min-w-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Documentation</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Reference guide for admins and HR business partners.
          </p>
        </div>

        {/* ── OVERVIEW ──────────────────────────────────────────── */}
        <section>
          <SectionHeading id="overview">Overview</SectionHeading>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            PMS is the organisation&apos;s performance review and variable payout management system.
            Each quarter, a <strong>review cycle</strong> is created and progresses through seven stages — from KPI setting
            through to published payouts. Cycles can be scoped to specific departments, and each department advances
            through stages independently. The system enforces role-based access at every step and maintains a full audit trail.
          </p>

          <Table
            headers={['Component', 'Purpose']}
            rows={[
              ['Cycles',        'Quarterly review periods scoped to departments/employees with independent stage progression'],
              ['KRAs',          'Key Result Areas — broad outcome categories (e.g., Product Delivery) set by managers for each employee'],
              ['KPIs',          'Key Performance Indicators — specific measurable targets under each KRA, with weighted percentages'],
              ['Self Reviews',  'Employee self-assessment submitted during self_review stage'],
              ['Peer Reviews',  'Colleagues review each other — employee-initiated, rating + comments'],
              ['Appraisals',    'Manager rating + HRBP override + final payout record per employee per cycle'],
              ['Goals',         'Individual employee objectives (business/development/behavior) with manager approval workflow'],
              ['Audit Log',     'Immutable record of every override, lock, publish, and sync action'],
            ]}
          />
        </section>

        {/* ── ROLES ─────────────────────────────────────────────── */}
        <section>
          <SectionHeading id="roles">User Roles</SectionHeading>

          <Table
            headers={['Role', 'Who', 'Key Capabilities']}
            rows={[
              [<Tag key="e" color="default">employee</Tag>,  'Individual contributors',     'View KRAs/KPIs, submit self-review, request peer reviews, view final payout'],
              [<Tag key="m" color="default">manager</Tag>,   'Team leads with direct reports', 'Define KRAs and KPIs, finalize/lock KPIs, submit manager ratings, view team'],
              [<Tag key="h" color="amber">hrbp</Tag>,        'HR Business Partners',        'Override ratings, calibrate, lock cycles, publish results, export payroll'],
              [<Tag key="a" color="blue">admin</Tag>,        'System administrators',       'Create cycles with dept scoping, manage users, advance department stages, configure flags'],
            ]}
          />

          <Warn>
            <strong>is_active flag:</strong> Inactive users are blocked from all data access.
            They cannot log in and do not appear in review lists. Use <Code>/admin/users</Code> to manage.
          </Warn>
        </section>

        {/* ── CYCLE LIFECYCLE ───────────────────────────────────── */}
        <section>
          <SectionHeading id="cycle-lifecycle">Cycle Lifecycle</SectionHeading>

          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Every cycle moves through seven stages. Transitions are one-way. With department-scoped cycles,
            <strong> each department advances independently</strong> — Engineering can be in self_review while Sales is still in kpi_setting.
          </p>

          <StageFlow />

          <SubHeading>Cycle Scoping</SubHeading>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            When creating a cycle, admins choose the scope:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
            <li><strong>Org-wide</strong> — All active employees are included. Single status for everyone.</li>
            <li><strong>Department-scoped</strong> — Select specific departments. Each department has its own stage progression.</li>
            <li><strong>Employee exceptions</strong> — Within a scoped cycle, individual employees can be excluded or employees from non-selected departments can be included.</li>
            <li><strong>Employee status overrides</strong> — Admin can hold back or advance an individual employee ahead of their department.</li>
          </ul>

          <Note>
            <strong>Status resolution priority:</strong> Employee override &rarr; Department status &rarr; Cycle status (org-wide fallback).
            The system resolves the effective status for each employee using this chain.
          </Note>

          <SubHeading>Per-department transitions</SubHeading>
          <Table
            headers={['Transition', 'Who', 'Scope']}
            rows={[
              ['draft → kpi_setting',             <Tag key="1" color="blue">admin</Tag>,  'Per department or org-wide'],
              ['kpi_setting → self_review',        <Tag key="2" color="blue">admin</Tag>,  'Per department or org-wide'],
              ['self_review → manager_review',     <Tag key="3" color="blue">admin</Tag>,  'Per department or org-wide'],
              ['manager_review → calibrating',     <Tag key="4" color="blue">admin</Tag>,  'Per department or org-wide'],
              ['calibrating → locked',             <Tag key="5" color="amber">hrbp</Tag>, 'Per department or org-wide'],
              ['locked → published',               <Tag key="6" color="amber">hrbp</Tag>, 'Per department or org-wide'],
            ]}
          />

          <SubHeading>What happens at lock?</SubHeading>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            When HRBP locks a cycle (or department), the system calculates payouts:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
            <li>Sets <Code>final_rating</Code> = manager_rating (unless HRBP overrode it)</li>
            <li>Calculates <Code>payout_amount</Code> from the employee&apos;s snapshotted variable pay and rating multiplier</li>
            <li>Sets <Code>locked_at</Code> = now()</li>
            <li><strong>Skips</strong> rows where <Code>is_final = true</Code> (HRBP overrides preserved)</li>
          </ul>
        </section>

        {/* ── KRA & KPI SETUP ─────────────────────────────────── */}
        <section>
          <SectionHeading id="kra-kpi">KRA &amp; KPI Setup</SectionHeading>

          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            During the <Code>kpi_setting</Code> phase, managers define performance expectations for each direct report
            using a structured KRA → KPI hierarchy.
          </p>

          <SubHeading>Step 1: Define KRAs (Key Result Areas)</SubHeading>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            KRAs are broad outcome categories. Each has a title, category (performance/behaviour/learning), weight, and optional description.
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
            <li>Managers create KRAs first — the &quot;Add KRA&quot; form is prominently placed at the top of the page</li>
            <li>KRA weights across all KRAs should total 100%</li>
            <li>Role-based KRA templates are available for quick setup</li>
          </ul>

          <SubHeading>Step 2: Add KPIs under each KRA</SubHeading>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            KPIs are specific, measurable targets nested under KRAs.
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
            <li>Each KRA has an inline &quot;Add KPI&quot; form</li>
            <li><strong>KPI weights within a KRA are capped at 100%</strong> — enforced both server-side and in the UI</li>
            <li>Once KPI weights reach 100%, the Add KPI form is hidden and replaced with a &quot;Fully allocated&quot; indicator</li>
            <li>A progress bar inside each KRA card shows weight allocation</li>
            <li>KPIs can be linked to MIS (AOP targets) for automated scoring</li>
          </ul>

          <SubHeading>Step 3: Finalize &amp; Lock</SubHeading>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            When all KRAs have KPIs totaling 100% each, the manager clicks <strong>Finalize KRAs &amp; KPIs</strong>.
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
            <li>Finalization validates: at least one KRA exists, every KRA has KPIs, KPI weights per KRA sum to exactly 100%</li>
            <li>Once finalized, all add/edit/delete forms are hidden — KPIs are read-only</li>
            <li>Manager can <strong>Unlock</strong> to make changes again if needed</li>
            <li>Employees can view their assigned KRAs and KPIs (read-only) on their dashboard</li>
          </ul>

          <Warn>
            <strong>Orphaned KPIs:</strong> If a KRA is deleted, its child KPIs become &quot;unassigned&quot; (kra_id set to null).
            They appear in a muted &quot;Unassigned KPIs&quot; section and should be reassigned to a new KRA.
          </Warn>
        </section>

        {/* ── USER FLOWS ────────────────────────────────────────── */}
        <section>
          <SectionHeading id="user-flows">User Flows</SectionHeading>

          <RoleSection title="Admin" color="blue" badge="admin">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Create a new cycle at <Code>/admin/cycles/new</Code> — set name, quarter, year, and deadlines</li>
              <li>Choose scope: org-wide or select specific departments (with employee-level include/exclude)</li>
              <li>Advance each department independently from <Code>draft</Code> → <Code>kpi_setting</Code> on the cycle detail page</li>
              <li>Monitor per-department pipeline progress with visual stepper and readiness stats</li>
              <li>Send reminder notifications when deadlines approach</li>
              <li>Optionally hold back or advance individual employees with status overrides</li>
              <li>Manage users at <Code>/admin/users</Code>: set roles, password, variable pay amount, activate/deactivate</li>
              <li>Manage KPI/KRA templates for quick setup by managers</li>
            </ol>
          </RoleSection>

          <RoleSection title="HRBP" color="amber" badge="hrbp">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Monitor all cycles from <Code>/hrbp</Code> — see per-department status, deadlines, and overdue indicators</li>
              <li>During <Code>calibrating</Code>: review the rating distribution at <Code>/hrbp/calibration</Code></li>
              <li>Override any manager rating — select new tier, write mandatory justification (sets <Code>is_final = true</Code>)</li>
              <li>Lock cycle/department — triggers payout calculation for in-scope employees</li>
              <li>Publish results to make ratings and payouts visible to employees</li>
              <li>Export payroll CSV from cycle detail page</li>
            </ol>
          </RoleSection>

          <RoleSection title="Manager" color="green" badge="manager">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>During <Code>kpi_setting</Code>: go to each team member&apos;s page and follow the KRA → KPI workflow</li>
              <li>Step 1: Create KRAs (broad outcome areas) with category and weight</li>
              <li>Step 2: Add KPIs under each KRA — weights within a KRA must total 100%</li>
              <li>Step 3: Click <strong>Finalize KRAs &amp; KPIs</strong> to lock for the employee</li>
              <li>During <Code>manager_review</Code>: view self-review, MIS auto-score (if available), and submit rating + comments</li>
              <li>Managers also submit their own self-review at <Code>/manager/my-review</Code></li>
            </ol>
          </RoleSection>

          <RoleSection title="Employee" color="purple" badge="employee">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>During <Code>kpi_setting</Code>: view assigned KRAs and KPIs (read-only) on <Code>/employee</Code></li>
              <li>During <Code>self_review</Code>: select a self-rating, write comments, and submit</li>
              <li>Request peer reviews from colleagues at <Code>/employee/peer-reviews</Code></li>
              <li>Submit peer reviews when requested by colleagues</li>
              <li>After publication: view final rating and payout on the dashboard</li>
              <li>View past cycle history at <Code>/employee/history</Code></li>
            </ol>
          </RoleSection>
        </section>

        {/* ── PEER REVIEWS ────────────────────────────────────── */}
        <section>
          <SectionHeading id="peer-reviews">Peer Reviews</SectionHeading>

          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Peer reviews allow employees to request feedback from colleagues. The peer score feeds into the final rating calculation during HRBP calibration.
          </p>

          <SubHeading>Workflow</SubHeading>
          <Table
            headers={['Step', 'Who', 'Action']}
            rows={[
              ['1. Request',  <Tag key="1" color="purple">Employee</Tag>, 'Select a colleague from dropdown, creates request with status "requested"'],
              ['2. Submit',   <Tag key="2" color="default">Peer</Tag>,    'Peer fills in rating (FEE/EE/ME/SME/BE) + comments, status becomes "submitted"'],
              ['3. Scoring',  <Tag key="3" color="amber">HRBP</Tag>,      'Peer scores are averaged and included in final rating calculation during calibration'],
            ]}
          />

          <SubHeading>Statuses</SubHeading>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
            <li><Tag color="blue">requested</Tag> — Peer review has been requested, awaiting response</li>
            <li><Tag color="green">submitted</Tag> — Peer has submitted their rating and comments</li>
          </ul>

          <Note>
            <strong>Scoring:</strong> Peer ratings are converted to numeric scores (FEE=95, EE=80, ME=60, SME=40, BE=15)
            and averaged across all submitted reviews. This average feeds into the composite final score.
          </Note>
        </section>

        {/* ── CALCULATIONS ──────────────────────────────────────── */}
        <section>
          <SectionHeading id="calculations">Payout Calculations</SectionHeading>

          <SubHeading>How it works</SubHeading>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            Payout settings (multipliers, budget) are configured <strong>after ratings are locked</strong>, not during cycle creation.
            Each employee&apos;s <Code>variable_pay</Code> (annual performance payout amount, can be zero) is set on their user profile.
          </p>

          <SubHeading>The formula</SubHeading>
          <CodeBlock>{`payout_amount = snapshotted_variable_pay
              × rating_multiplier
              × business_multiplier`}</CodeBlock>

          <Table
            headers={['Rating', 'Label', 'Multiplier', 'Notes']}
            rows={[
              [<Tag key="fee" color="green">FEE</Tag>,  'Far Exceeded Expectations',      '× 1.25', 'Highest fixed band'],
              [<Tag key="ee"  color="blue">EE</Tag>,   'Exceeded Expectations',           '× 1.10', ''],
              [<Tag key="me"  color="default">ME</Tag>, 'Met Expectations',               '× 1.00', 'Target band'],
              [<Tag key="sme" color="amber">SME</Tag>, 'Significantly Met Expectations',  '× (1.00 + sme_multiplier)', 'Dynamic — set per cycle'],
              [<Tag key="be"  color="red">BE</Tag>,    'Below Expectations',              '× 0.00', 'No variable payout'],
            ]}
          />

          <SubHeading>Where values are configured</SubHeading>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
            <li><strong>variable_pay</strong> — Set per user at <Code>/admin/users</Code>. Can be zero. Snapshotted at appraisal creation so mid-cycle changes don&apos;t affect payouts</li>
            <li><strong>business_multiplier</strong> — Configured on the cycle after ratings are locked. Applies uniformly to all payouts</li>
            <li><strong>sme_multiplier</strong> — Also set per cycle after lock. Only affects employees rated SME</li>
          </ul>
        </section>

        {/* ── QUICK REFERENCE ───────────────────────────────────── */}
        <section>
          <SectionHeading id="quick-ref">Quick Reference</SectionHeading>

          <SubHeading>What can each role do at each stage?</SubHeading>
          <Table
            headers={['Stage', 'Employee', 'Manager', 'HRBP', 'Admin']}
            rows={[
              ['draft',           '—',                      '—',                        '—',                              'Create cycle, set scope & deadlines'],
              ['kpi_setting',     'View KRAs & KPIs',       'Create KRAs → KPIs → Finalize', '—',                        'Advance dept, send reminders'],
              ['self_review',     'Submit self-review',     'View team status',         '—',                              'Advance dept, send reminders'],
              ['manager_review',  'View own KPIs',          'Submit ratings + comments', '—',                             'Advance dept, send reminders'],
              ['calibrating',     '—',                      '—',                        'Override ratings, view bell curve', 'Advance dept'],
              ['locked',          '—',                      '—',                        'Publish, export payroll',         '—'],
              ['published',       'See rating & payout',    'See team results',         'Full access',                    'Full access'],
            ]}
          />

          <SubHeading>Audit log — what gets recorded?</SubHeading>
          <Table
            headers={['Action', 'Triggered by', 'Contains']}
            rows={[
              ['cycle_status_changed',       'Admin advances cycle (org-wide)',     'old_value, new_value'],
              ['department_status_changed',   'Admin advances a department',        'cycle_id, department_id, status change'],
              ['employee_status_override',    'Admin holds/advances employee',      'cycle_id, employee_id, status_override'],
              ['kpis_finalized',              'Manager finalizes KPIs',             'cycle_id, employee_id'],
              ['kra_added / kpi_added',       'Manager adds KRA or KPI',           'title, employee_id, cycle_id'],
              ['override_rating',             'HRBP overrides a rating',           'old_value, new_value, justification'],
              ['lock_cycle',                  'HRBP locks cycle/dept',             'cycle_id, locked_at'],
              ['publish_cycle',               'HRBP publishes results',            'cycle_id, published_at'],
              ['user_created',                'Admin creates user',                'email, full_name, role'],
              ['zimyo_sync',                  'Admin triggers Zimyo sync',         'users added/updated/deactivated'],
            ]}
          />
        </section>
      </div>
    </div>
  )
}
