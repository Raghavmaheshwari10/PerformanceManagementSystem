'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// ─── Section data ──────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'overview',        label: 'Overview' },
  { id: 'roles',           label: 'User Roles' },
  { id: 'cycle-lifecycle', label: 'Cycle Lifecycle' },
  { id: 'user-flows',      label: 'User Flows' },
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
  { key: 'draft',           label: 'Draft',           who: 'Admin',       desc: 'Cycle created with deadlines & multipliers' },
  { key: 'kpi_setting',     label: 'KPI Setting',     who: 'Managers',    desc: 'Managers set KPIs for direct reports' },
  { key: 'self_review',     label: 'Self Review',     who: 'Employees',   desc: 'Employees submit self-ratings & comments' },
  { key: 'manager_review',  label: 'Manager Review',  who: 'Managers',    desc: 'Managers rate each employee and add comments' },
  { key: 'calibrating',     label: 'Calibrating',     who: 'HRBP',        desc: 'HRBP reviews distribution, overrides if needed' },
  { key: 'locked',          label: 'Locked',          who: 'HRBP',        desc: 'Payouts calculated, results frozen' },
  { key: 'published',       label: 'Published',       who: 'HRBP',        desc: 'Employees can now see their rating & payout' },
]

function StageFlow() {
  return (
    <div className="relative my-6">
      <div className="flex flex-col gap-0">
        {STAGES.map((stage, i) => (
          <div key={stage.key} className="flex items-stretch gap-4">
            {/* connector column */}
            <div className="flex flex-col items-center w-8 flex-shrink-0">
              <div className={cn(
                'w-3 h-3 rounded-full border-2 flex-shrink-0 mt-3',
                stage.key === 'published' ? 'border-green-500 bg-green-500' : 'border-primary bg-background'
              )} />
              {i < STAGES.length - 1 && <div className="w-px flex-1 bg-border mt-0.5 mb-0.5 min-h-[24px]" />}
            </div>
            {/* content */}
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
            through to published payouts. The system enforces role-based access at every step and maintains a full audit trail.
          </p>

          <Table
            headers={['Component', 'Purpose']}
            rows={[
              ['Cycles',        'Quarterly review periods with deadlines and payout multipliers'],
              ['KPIs',          'Goals set by managers for each employee, with weighted percentages'],
              ['Self Reviews',  'Employee self-assessment submitted during self_review stage'],
              ['Appraisals',    'Manager rating + HRBP override + final payout record per employee per cycle'],
              ['Audit Log',     'Immutable record of every override, lock, publish, and sync action'],
              ['Notifications', 'System + manual messages (reminders, announcements) sent to users'],
            ]}
          />

          <Note>
            <strong>Source of truth:</strong> All access control is enforced by PostgreSQL Row Level Security policies
            — the UI respects them, but they&apos;re independently enforced at the database level regardless of any
            frontend state.
          </Note>
        </section>

        {/* ── ROLES ─────────────────────────────────────────────── */}
        <section>
          <SectionHeading id="roles">User Roles</SectionHeading>

          <Table
            headers={['Role', 'Who', 'Key Capabilities']}
            rows={[
              [<Tag key="e" color="default">employee</Tag>,  'Individual contributors',     'Submit self-review, view own KPIs and final payout'],
              [<Tag key="m" color="default">manager</Tag>,   'Team leads with direct reports', 'Set KPIs, submit manager ratings, view team'],
              [<Tag key="h" color="amber">hrbp</Tag>,        'HR Business Partners',        'Override ratings, lock cycles, publish results, export payroll'],
              [<Tag key="a" color="blue">admin</Tag>,        'System administrators',       'Full access: create cycles, manage users, send notifications, configure flags'],
            ]}
          />

          <Warn>
            <strong>is_active flag:</strong> Inactive users (is_active = false) are blocked from all data access by RLS.
            They cannot log in and do not appear in manager review lists. Use <Code>/admin/users</Code> to activate or deactivate accounts.
          </Warn>
        </section>

        {/* ── CYCLE LIFECYCLE ───────────────────────────────────── */}
        <section>
          <SectionHeading id="cycle-lifecycle">Cycle Lifecycle</SectionHeading>

          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Every cycle moves through exactly seven stages in order. Transitions are one-way — a cycle can never go backwards.
          </p>

          <StageFlow />

          <SubHeading>Who advances each stage?</SubHeading>
          <Table
            headers={['Transition', 'Who', 'Where']}
            rows={[
              ['draft → kpi_setting',             <Tag key="1" color="blue">admin</Tag>,  '/admin/cycles/[id]'],
              ['kpi_setting → self_review',        <Tag key="2" color="blue">admin</Tag>,  '/admin/cycles/[id]'],
              ['self_review → manager_review',     <Tag key="3" color="blue">admin</Tag>,  '/admin/cycles/[id]'],
              ['manager_review → calibrating',     <Tag key="4" color="blue">admin</Tag>,  '/admin/cycles/[id]'],
              ['calibrating → locked',             <Tag key="5" color="amber">hrbp</Tag>, '/hrbp'],
              ['locked → published',               <Tag key="6" color="amber">hrbp</Tag>, '/hrbp'],
            ]}
          />

          <SubHeading>What happens at lock?</SubHeading>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            When HRBP locks a cycle, the database runs <Code>bulk_lock_appraisals()</Code> — a single SQL UPDATE that:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
            <li>Sets <Code>final_rating</Code> = manager_rating (for rows where HRBP has not overridden)</li>
            <li>Calculates <Code>payout_multiplier</Code> = rating multiplier × business_multiplier</li>
            <li>Calculates <Code>payout_amount</Code> = snapshotted_variable_pay × payout_multiplier</li>
            <li>Sets <Code>locked_at</Code> = now()</li>
            <li><strong>Skips</strong> rows where <Code>is_final = true</Code> — HRBP overrides are already set</li>
          </ul>

          <Note>
            <strong>Snapshotted variable pay:</strong> When an appraisal row is first created, a database trigger
            captures <Code>users.variable_pay</Code> → <Code>appraisals.snapshotted_variable_pay</Code>.
            This means if an employee&apos;s salary changes mid-cycle, the payout calculation is unaffected.
          </Note>
        </section>

        {/* ── USER FLOWS ────────────────────────────────────────── */}
        <section>
          <SectionHeading id="user-flows">User Flows</SectionHeading>

          <RoleSection title="Admin" color="blue" badge="admin">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Create a new cycle at <Code>/admin/cycles/new</Code> — set name, quarter, year, all four deadlines, SME multiplier, business multiplier, and optional budget</li>
              <li>Advance the cycle from <Code>draft</Code> → <Code>kpi_setting</Code> to open it for managers</li>
              <li>Send reminder notifications when deadlines approach (<Code>/admin/cycles/[id]</Code>)</li>
              <li>Advance stages as each phase completes: self_review → manager_review → calibrating</li>
              <li>Monitor progress via the dashboard progress rings</li>
              <li>Manage users at <Code>/admin/users</Code>: edit roles, activate/deactivate, trigger Zimyo sync, or upload a CSV</li>
              <li>Manage KPI templates at <Code>/admin/kpi-templates</Code> — create role-specific templates managers can apply in one click</li>
              <li>Send manual announcements at <Code>/admin/notifications</Code> — scoped to individual, role, department, or everyone</li>
              <li>Toggle feature flags at <Code>/admin/feature-flags</Code> for org, role, or individual user overrides</li>
            </ol>
          </RoleSection>

          <RoleSection title="HRBP" color="amber" badge="hrbp">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Monitor all cycles from <Code>/hrbp</Code> — see status, deadlines, and any overdue indicators</li>
              <li>During <Code>calibrating</Code>: go to <Code>/hrbp/calibration</Code> to review the rating distribution bell curve</li>
              <li>Override any manager rating — select the new rating tier, write a mandatory justification, and save. This sets <Code>is_final = true</Code> and writes to the audit log</li>
              <li>When calibration is complete, click <strong>Lock Cycle</strong> — this triggers the bulk payout calculation</li>
              <li>Review locked payouts, then click <strong>Publish</strong> to make results visible to employees</li>
              <li>Export payroll CSV (zimyo_employee_id, name, department, final_rating, payout_multiplier, payout_amount) from the cycle detail page</li>
              <li>Review the full audit trail at <Code>/hrbp/audit-log</Code> — all overrides, locks, and publishes are recorded with timestamps and justifications</li>
            </ol>
          </RoleSection>

          <RoleSection title="Manager" color="green" badge="manager">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>During <Code>kpi_setting</Code>: go to each team member&apos;s KPI page, add KPIs manually (title, description, weight), apply a role template, or copy from the previous cycle</li>
              <li>KPI weights must not exceed 100% per employee — enforced by DB trigger</li>
              <li>During <Code>manager_review</Code>: view each employee&apos;s submitted self-review, select a rating (FEE/EE/ME/SME/BE), and write comments</li>
              <li>Ratings auto-save as draft; submit when ready</li>
              <li>Managers also submit their own self-review at <Code>/manager/my-review</Code></li>
            </ol>
          </RoleSection>

          <RoleSection title="Employee" color="purple" badge="employee">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>During <Code>self_review</Code>: go to <Code>/employee</Code>, select a self-rating, write comments, and submit. The form auto-saves every 500 ms</li>
              <li>After the cycle is published, the final rating and payout amount become visible</li>
              <li>View the full history of past cycles at <Code>/employee/history</Code></li>
            </ol>
          </RoleSection>
        </section>

        {/* ── CALCULATIONS ──────────────────────────────────────── */}
        <section>
          <SectionHeading id="calculations">Payout Calculations</SectionHeading>

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

          <SubHeading>Example — Q1 FY2025 (business_multiplier = 0.9)</SubHeading>
          <Table
            headers={['Employee', 'Variable Pay', 'Rating', 'Formula', 'Payout']}
            rows={[
              ['Bob',   '₹80,000', <Tag key="1" color="blue">EE</Tag>,    '80,000 × 1.10 × 0.9', '₹79,200'],
              ['Dave',  '₹75,000', <Tag key="2" color="default">ME</Tag>,  '75,000 × 1.00 × 0.9', '₹67,500'],
              ['Eve',   '₹72,000', <Tag key="3" color="green">FEE</Tag>,   '72,000 × 1.25 × 0.9', '₹81,000'],
              ['Grace', '₹68,000', <Tag key="4" color="default">ME</Tag>,  '68,000 × 1.00 × 0.9', '₹61,200'],
              ['Henry', '₹65,000', <Tag key="5" color="red">BE</Tag>,      '65,000 × 0.00',        '₹0'],
              ['Irene', '₹60,000', <Tag key="6" color="blue">EE</Tag>,     '60,000 × 1.10 × 0.9', '₹59,400'],
              [<strong key="total">Total</strong>, '', '', '', <strong key="amt">₹3,48,300</strong>],
            ]}
          />

          <Note>
            <strong>SME multiplier example:</strong> If a cycle has <Code>sme_multiplier = 0.25</Code> and an employee is
            rated SME with variable pay ₹80,000 and business_multiplier 1.0:{' '}
            <Code>80,000 × (1.00 + 0.25) × 1.0 = ₹1,00,000</Code>
          </Note>

          <SubHeading>Where multipliers are configured</SubHeading>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
            <li><strong>business_multiplier</strong> — set when creating or editing a cycle (<Code>/admin/cycles/new</Code>). Applies uniformly to all payouts in that cycle</li>
            <li><strong>sme_multiplier</strong> — also set per cycle. Only affects employees rated SME</li>
            <li><strong>variable_pay</strong> — set per user in <Code>/admin/users</Code>. Snapshotted at appraisal creation</li>
          </ul>
        </section>

        {/* ── QUICK REFERENCE ───────────────────────────────────── */}
        <section>
          <SectionHeading id="quick-ref">Quick Reference</SectionHeading>

          <SubHeading>What can each role do at each stage?</SubHeading>
          <Table
            headers={['Stage', 'Employee', 'Manager', 'HRBP', 'Admin']}
            rows={[
              ['draft',           '—',           '—',               '—',                    'Create cycle, set deadlines'],
              ['kpi_setting',     'View KPIs',   'Set / edit KPIs', '—',                    'Advance stage, send reminders'],
              ['self_review',     'Submit review','View team status','—',                    'Advance stage, send reminders'],
              ['manager_review',  'View own KPIs','Submit ratings',  '—',                    'Advance stage, send reminders'],
              ['calibrating',     '—',           '—',               'Override ratings, view bell curve', 'Lock cycle'],
              ['locked',          '—',           '—',               'Publish, export payroll CSV','—'],
              ['published',       'See results', 'See team results', 'Full access',          'Full access'],
            ]}
          />

          <SubHeading>Audit log — what gets recorded?</SubHeading>
          <Table
            headers={['Action', 'Triggered by', 'Contains']}
            rows={[
              ['override_rating',    'HRBP overrides a rating',         'old_value, new_value, justification'],
              ['lock_cycle',         'HRBP locks a cycle',              'cycle_id, locked_at'],
              ['publish_cycle',      'HRBP publishes a cycle',          'cycle_id, published_at'],
              ['csv_upload',         'Admin uploads users CSV',         'rows inserted/updated'],
              ['zimyo_sync',         'Admin triggers Zimyo sync',       'users added/deactivated'],
              ['role_change',        'Admin changes a user role',       'old_role, new_role'],
              ['status_change',      'Admin deactivates/activates user','old_status, new_status'],
            ]}
          />

          <SubHeading>Notification types</SubHeading>
          <Table
            headers={['Type', 'When sent', 'Recipients']}
            rows={[
              [<Code key="1">cycle_kpi_setting_open</Code>,    'Cycle advances to kpi_setting',    'All managers'],
              [<Code key="2">cycle_self_review_open</Code>,    'Cycle advances to self_review',    'All employees'],
              [<Code key="3">cycle_manager_review_open</Code>, 'Cycle advances to manager_review', 'All managers'],
              [<Code key="4">cycle_published</Code>,           'Cycle published',                  'All employees'],
              [<Code key="5">review_reminder</Code>,           'Admin sends reminder',             'Employees with pending reviews'],
              [<Code key="6">admin_message</Code>,             'Admin sends manual notification',  'Selected scope (individual/role/dept/all)'],
            ]}
          />

          <Warn>
            <strong>HRBP overrides are permanent.</strong> Once <Code>is_final = true</Code> is set on an appraisal,
            the bulk lock will not overwrite it. The only way to undo an override is to manually set another override
            via the calibration page before the cycle is locked.
          </Warn>
        </section>
      </div>
    </div>
  )
}
