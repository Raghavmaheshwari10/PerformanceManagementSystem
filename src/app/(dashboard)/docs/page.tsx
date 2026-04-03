'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

// ─── Section data ──────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'overview',        label: 'Overview' },
  { id: 'roles',           label: 'User Roles' },
  { id: 'cycle-lifecycle', label: 'Cycle Lifecycle' },
  { id: 'kra-kpi',         label: 'KRA & KPI Setup' },
  { id: 'goals',           label: 'Goals' },
  { id: 'competency',      label: 'Competency Assessment' },
  { id: 'scoring',         label: 'Score Engine' },
  { id: 'mis',             label: 'MIS Integration' },
  { id: 'feedback',        label: 'Feedback' },
  { id: 'user-flows',      label: 'User Flows' },
  { id: 'calculations',    label: 'Payout Calculations' },
  { id: 'admin-config',    label: 'Admin Configuration' },
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
  { key: 'manager_review',  label: 'Manager Review',  who: 'Managers',    desc: 'Managers rate each employee, assess competencies, and add comments' },
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
            Complete reference guide for all PMS users — employees, managers, HRBPs, and admins.
          </p>
        </div>

        {/* ── OVERVIEW ──────────────────────────────────────────── */}
        <section>
          <SectionHeading id="overview">Overview</SectionHeading>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            PMS is the organisation&apos;s performance review, goal tracking, and variable payout management system.
            Each quarter, a <strong>review cycle</strong> is created and progresses through seven stages — from KPI setting
            through to published payouts. Cycles can be scoped to specific departments, and each department advances
            through stages independently. The system enforces role-based access at every step and maintains a full audit trail.
            The sidebar can be collapsed to icon-only mode for more workspace — your preference is saved automatically.
          </p>

          <Table
            headers={['Component', 'Purpose']}
            rows={[
              ['Cycles',              'Quarterly review periods scoped to departments/employees with independent stage progression'],
              ['KRAs',                'Key Result Areas — broad outcome categories (e.g., Revenue Growth) set by managers per employee'],
              ['KPIs',                'Key Performance Indicators — measurable targets under each KRA, with weighted percentages'],
              ['Goals',               'Individual employee objectives (business/development/behavior) with manager approval and progress tracking'],
              ['Self Reviews',        'Employee self-assessment submitted during the self_review stage'],
              ['Competency Assessment', 'Behavioral competency rating (1-5 scale) by managers using configurable review templates'],
              ['MIS Integration',     'Auto-import AOP targets and actuals from external MIS to calculate KPI scores automatically'],
              ['Feedback',            'Peer-to-peer feedback across categories (teamwork, leadership, ownership, communication, innovation)'],
              ['Appraisals',          'Manager rating + competency score + HRBP override + final payout per employee per cycle'],
              ['Audit Log',           'Immutable record of every override, lock, publish, sync, and configuration change'],
            ]}
          />
        </section>

        {/* ── ROLES ─────────────────────────────────────────────── */}
        <section>
          <SectionHeading id="roles">User Roles</SectionHeading>

          <Table
            headers={['Role', 'Who', 'Key Capabilities']}
            rows={[
              [<Tag key="e" color="default">Employee</Tag>,  'Individual contributors',     'View KRAs/KPIs, submit self-review, track goals, send feedback, view MIS targets, view final payout'],
              [<Tag key="m" color="default">Manager</Tag>,   'Team leads with direct reports', 'Define KRAs/KPIs, approve goals, submit manager ratings + competency assessment, link KPIs to MIS, view team reports'],
              [<Tag key="h" color="amber">HRBP</Tag>,        'HR Business Partners (multi-department)', 'Override ratings, calibrate with bell curve, lock/publish cycles, export payroll, view department reports. Can be assigned to multiple departments.'],
              [<Tag key="a" color="blue">Admin</Tag>,        'System administrators',       'Create cycles, manage users, configure templates/roles/departments, MIS settings, feature flags, payout config'],
            ]}
          />

          <Note>
            <strong>Dual roles:</strong> Managers and HRBPs can also be employees in the review cycle. If marked as <Code>is_also_employee</Code>,
            they can submit their own self-review alongside their managerial duties.
          </Note>

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

          <SubHeading>Cycle Configuration</SubHeading>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            When creating a cycle, admins also configure:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
            <li><strong>Review Template</strong> — Optional competency assessment template with behavioral questions (see Competency Assessment section)</li>
            <li><strong>Competency Weight</strong> — Percentage of final score attributed to competency ratings (0-100%). The remainder is split between goals and manager review.</li>
            <li><strong>Deadlines</strong> — KPI setting, self-review, manager review, and calibration deadlines</li>
            <li><strong>Multipliers</strong> — Business multiplier, SME multiplier, and per-rating-tier overrides</li>
          </ul>

          <SubHeading>Per-department transitions</SubHeading>
          <Table
            headers={['Transition', 'Who', 'Scope']}
            rows={[
              ['draft → kpi_setting',             <Tag key="1" color="blue">admin</Tag>,  'Per department or org-wide'],
              ['kpi_setting → self_review',        <Tag key="2" color="blue">admin</Tag>,  'Per department or org-wide'],
              ['self_review → manager_review',     <Tag key="3" color="blue">admin</Tag>,  'Per department or org-wide'],
              ['manager_review → calibrating',     <Tag key="4" color="blue">admin</Tag>,  'Per department or org-wide'],
              ['calibrating → locked',             <Tag key="5" color="amber">HRBP</Tag>, 'Per department or org-wide'],
              ['locked → published',               <Tag key="6" color="amber">HRBP</Tag>, 'Per department or org-wide'],
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

          <SubHeading>Mid-cycle employee exit</SubHeading>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            If an employee leaves mid-cycle, their appraisal can be frozen with a prorated payout:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
            <li><Code>exited_at</Code> — Date the employee left</li>
            <li><Code>proration_factor</Code> — Fraction of the cycle worked (e.g., 0.75 for 3 of 4 months)</li>
            <li><Code>is_exit_frozen</Code> — When true, the appraisal is locked and excluded from further calibration</li>
            <li>Payout is calculated as: <Code>variable_pay x multiplier x proration_factor</Code></li>
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
            <li>Role-based KRA templates are available for quick setup (admin configures these at <Code>/admin/kra-templates</Code>)</li>
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
            <li>KPIs can include a <strong>unit</strong> (percent, number, currency) and <strong>target value</strong></li>
            <li>KPIs can be linked to MIS (AOP targets) for automated scoring — see MIS Integration section</li>
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

          <SubHeading>Templates</SubHeading>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            Admins can pre-configure KRA and KPI templates for quick setup:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
            <li><strong>KRA Templates</strong> — Defined per role and/or department. Managers click &quot;KRA Template&quot; to auto-create KRAs. Categories: Performance, Behaviour, Learning.</li>
            <li><strong>KPI Templates</strong> — Defined per role and/or department. Include suggested weights, targets, units (Percent, Number, Currency, Rating, Boolean), and categories.</li>
            <li><strong>Role Slugs</strong> — Dynamic roles (e.g., &quot;Senior Engineer&quot;, &quot;Data Analyst&quot;) managed at <Code>/admin/roles</Code>. Each role has a unique UUID and label. Templates are filtered by role.</li>
            <li><strong>Department Scoping</strong> — Both KRA and KPI templates can be scoped to specific departments. When a manager applies templates, only templates matching the employee&apos;s department (or unscoped templates) are shown.</li>
          </ul>

          <Warn>
            <strong>Orphaned KPIs:</strong> If a KRA is deleted, its child KPIs become &quot;unassigned&quot; (kra_id set to null).
            They appear in a muted &quot;Unassigned KPIs&quot; section and should be reassigned to a new KRA.
          </Warn>
        </section>

        {/* ── GOALS ────────────────────────────────────────────── */}
        <section>
          <SectionHeading id="goals">Goals</SectionHeading>

          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Goals are individual objectives that employees set alongside their KPIs. They run parallel to the review cycle
            and provide a structured way to track development and business contributions.
          </p>

          <SubHeading>Goal Types</SubHeading>
          <Table
            headers={['Type', 'Description', 'Example']}
            rows={[
              [<Tag key="b" color="blue">Business</Tag>,       'Revenue, delivery, or operational targets',    'Increase Q2 sales pipeline by 20%'],
              [<Tag key="d" color="purple">Development</Tag>,   'Skill building and learning objectives',       'Complete AWS Solutions Architect certification'],
              [<Tag key="bh" color="green">Behavior</Tag>,      'Behavioral and cultural improvement goals',    'Improve cross-team collaboration score'],
            ]}
          />

          <SubHeading>Workflow</SubHeading>
          <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2 ml-2">
            <li><strong>Employee creates goals</strong> at <Code>/employee/goals</Code> — sets title, description, type, target value, unit, weight, and due date</li>
            <li><strong>Employee submits</strong> the goal for manager approval (status: <Code>draft</Code> → <Code>submitted</Code>)</li>
            <li><strong>Manager approves or rejects</strong> — can add feedback comments. Rejected goals go back to draft for revision.</li>
            <li><strong>Employee tracks progress</strong> — updates current value with notes over time. Each update is logged.</li>
            <li><strong>Goal closes</strong> — marked as completed or closed at end of cycle</li>
          </ol>

          <Note>
            Goals are linked to a specific cycle. Each goal has a <Code>weight</Code> field that can optionally contribute
            to the overall performance score through the Score Engine.
          </Note>
        </section>

        {/* ── COMPETENCY ASSESSMENT ────────────────────────────── */}
        <section>
          <SectionHeading id="competency">Competency Assessment</SectionHeading>

          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            While KPIs measure <strong>what</strong> an employee achieves (results), competencies measure <strong>how</strong> they
            achieve it (behaviors). The competency assessment uses review templates with structured questions linked to
            behavioral competencies.
          </p>

          <SubHeading>3-Tier Competency Model</SubHeading>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            Competencies are organized into three categories, each serving a different scope:
          </p>
          <Table
            headers={['Category', 'Scope', 'Description', 'Example']}
            rows={[
              [<Tag key="core" color="blue">Core</Tag>,           'Org-wide',              'Universal competencies expected of every employee',                    'Communication, Teamwork, Integrity'],
              [<Tag key="func" color="amber">Functional</Tag>,     'Department-specific',   'Technical or domain competencies scoped to a department',              'Data Analysis (for Analytics dept), Sales Technique (for Sales dept)'],
              [<Tag key="lead" color="purple">Leadership</Tag>,    'Role/band-specific',    'Leadership and strategic competencies for specific role levels',       'Strategic Thinking (for Senior Engineers), People Management (for Team Leads)'],
            ]}
          />

          <SubHeading>Proficiency Levels</SubHeading>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            Each competency can define proficiency levels — expected behaviors at different career bands. For example, a &quot;Communication&quot; competency might have:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
            <li><strong>L1 — Developing</strong>: Communicates clearly in team settings</li>
            <li><strong>L2 — Proficient</strong>: Presents ideas effectively to cross-functional stakeholders</li>
            <li><strong>L3 — Advanced</strong>: Drives strategic communication across the organization</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Proficiency levels help managers calibrate their ratings against role-appropriate expectations.
          </p>

          <SubHeading>How it works</SubHeading>
          <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2 ml-2">
            <li><strong>Admin builds competencies</strong> at <Code>/admin/competencies</Code> — sets category (Core/Functional/Leadership), optional department or role scope, description, and proficiency levels</li>
            <li><strong>Admin creates a review template</strong> at <Code>/admin/review-templates</Code> — adds questions linked to competencies (rating, text, or mixed answer types)</li>
            <li><strong>Admin attaches template to cycle</strong> — when creating a cycle, select a review template and set the competency weight (e.g., 20%)</li>
            <li><strong>Manager rates competencies</strong> during <Code>manager_review</Code> — for each question, selects a 1-5 rating and optionally adds text comments</li>
            <li><strong>Score is calculated</strong> — average of all competency ratings, normalized to a 0-100 scale</li>
          </ol>

          <SubHeading>Competency Score Calculation</SubHeading>
          <CodeBlock>{`competency_score = ((average_rating - 1) / 4) × 100

Example: Ratings of 4, 3, 5 across 3 questions
  Average = 4.0
  Score = ((4.0 - 1) / 4) × 100 = 75%`}</CodeBlock>

          <SubHeading>Competency Library Management</SubHeading>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            The Competency Library at <Code>/admin/competencies</Code> provides full CRUD management:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
            <li><strong>Filter by category</strong> — View All, Core, Functional, or Leadership competencies</li>
            <li><strong>Table view</strong> — Grouped by category with columns for Name, Description, Scope, Proficiency Levels, Usage (linked review questions), and Actions</li>
            <li><strong>Edit competencies</strong> — Click the pencil icon to edit name, description, category, scope, and proficiency levels</li>
            <li><strong>Toggle active/inactive</strong> — Deactivate competencies without deleting them</li>
            <li><strong>Delete competencies</strong> — Remove competencies that are no longer needed</li>
          </ul>

          <Note>
            If a cycle has <Code>competency_weight = 0</Code> or no review template is attached, competency assessment is
            skipped entirely and the final score uses only goals and manager review components.
          </Note>
        </section>

        {/* ── SCORE ENGINE ─────────────────────────────────────── */}
        <section>
          <SectionHeading id="scoring">Score Engine</SectionHeading>

          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            The score engine calculates a single final performance score (0-100) for each employee by blending
            multiple assessment components with configurable weights.
          </p>

          <SubHeading>Score Components</SubHeading>
          <Table
            headers={['Component', 'What it measures', 'Source']}
            rows={[
              ['Goal Score',       'Achievement against KPI targets',                       'Weighted average of KPI ratings or MIS auto-scores'],
              ['Competency Score', 'Behavioral competency ratings',                         'Average of manager competency ratings (1-5 scale, normalized to 0-100)'],
              ['Manager Score',    'Overall manager assessment',                             'Manager rating tier converted to score (FEE=100, EE=80, ME=60, SME=40, BE=0)'],
            ]}
          />

          <SubHeading>Weight Formula</SubHeading>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            The competency weight is set per cycle (0-100%). The remaining weight is split 75/25 between goals and manager review:
          </p>
          <CodeBlock>{`final_score = (goal_score × goal_weight)
            + (competency_score × competency_weight)
            + (manager_score × manager_weight)

Where:
  competency_weight = cycle.competency_weight / 100  (e.g., 0.20 for 20%)
  non_competency    = 1 - competency_weight          (e.g., 0.80)
  goal_weight       = non_competency × 0.75          (e.g., 0.60)
  manager_weight    = non_competency × 0.25          (e.g., 0.20)

Default example (20% competency weight):
  60% Goals + 20% Competency + 20% Manager Review = 100%

Zero competency (competency_weight = 0):
  75% Goals + 25% Manager Review = 100%`}</CodeBlock>

          <SubHeading>Score to Rating Mapping</SubHeading>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            The final score is mapped to a rating tier using configurable thresholds (set at <Code>/admin/mis/settings</Code>):
          </p>
          <Table
            headers={['Rating', 'Default Min Score', 'Label']}
            rows={[
              [<Tag key="fee" color="green">FEE</Tag>,  '90',  'Far Exceeded Expectations'],
              [<Tag key="ee" color="blue">EE</Tag>,     '70',  'Exceeded Expectations'],
              [<Tag key="me" color="default">ME</Tag>,   '50',  'Met Expectations'],
              [<Tag key="sme" color="amber">SME</Tag>,   '30',  'Significantly Met Expectations'],
              [<Tag key="be" color="red">BE</Tag>,       '0',   'Below Expectations'],
            ]}
          />
        </section>

        {/* ── MIS INTEGRATION ──────────────────────────────────── */}
        <section>
          <SectionHeading id="mis">MIS Integration</SectionHeading>

          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            The MIS (Management Information System) integration connects AOP (Annual Operating Plan) targets with
            employee KPIs, enabling automatic performance scoring based on actual business results.
          </p>

          <SubHeading>AOP Targets</SubHeading>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            AOP targets represent measurable business objectives at different levels:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
            <li><strong>Company-level</strong> — Organisation-wide targets (e.g., total revenue)</li>
            <li><strong>Department-level</strong> — Targets for a specific department</li>
            <li><strong>Individual-level</strong> — Targets assigned to a specific employee</li>
          </ul>

          <SubHeading>How MIS Scoring Works</SubHeading>
          <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-2 ml-2">
            <li><strong>Targets are created</strong> — Admin imports via CSV, creates manually at <Code>/admin/mis</Code>, or syncs from external MIS API</li>
            <li><strong>Actuals are recorded</strong> — Monthly actual values are entered (manually or via sync) against each target</li>
            <li><strong>Managers link KPIs to targets</strong> — At <Code>/manager/mis</Code>, managers map employee KPIs to relevant AOP targets</li>
            <li><strong>Scores auto-calculate</strong> — Achievement percentage = (actual / target) × 100, with configurable formulas</li>
            <li><strong>Rating suggested</strong> — Based on MIS score and scoring config thresholds, a rating tier is suggested to the manager</li>
          </ol>

          <SubHeading>Score Formulas</SubHeading>
          <Table
            headers={['Formula', 'Description', 'Use case']}
            rows={[
              [<Code key="l">linear</Code>,   'Score = (actual / target) × 100',                       'Standard targets where higher is better'],
              [<Code key="i">inverse</Code>,   'Score = (target / actual) × 100',                       'Targets where lower is better (e.g., defect rate)'],
              [<Code key="c">capped</Code>,    'Score = min(100, (actual / target) × 100)',              'Targets that cap at 100%'],
            ]}
          />

          <SubHeading>RAG Status (Traffic Light)</SubHeading>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
            <li><Tag color="red">Red</Tag> — Below red threshold (default: &lt;80% of target)</li>
            <li><Tag color="amber">Amber</Tag> — Between red and amber thresholds (default: 80-95%)</li>
            <li><Tag color="green">Green</Tag> — Above amber threshold (default: &gt;95%)</li>
          </ul>

          <Note>
            MIS dashboards are available for all roles: employees see their personal targets at <Code>/employee/mis</Code>,
            managers see team targets at <Code>/manager/mis</Code>, and admins manage everything at <Code>/admin/mis</Code>.
          </Note>
        </section>

        {/* ── FEEDBACK ─────────────────────────────────────────── */}
        <section>
          <SectionHeading id="feedback">Feedback</SectionHeading>

          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            The feedback system enables continuous peer-to-peer recognition and constructive input outside of formal review cycles.
          </p>

          <SubHeading>Feedback Categories</SubHeading>
          <Table
            headers={['Category', 'Description']}
            rows={[
              [<Tag key="t" color="blue">Teamwork</Tag>,         'Collaboration, supporting colleagues, team contribution'],
              [<Tag key="l" color="purple">Leadership</Tag>,      'Taking initiative, mentoring, leading by example'],
              [<Tag key="o" color="green">Ownership</Tag>,        'Accountability, follow-through, taking responsibility'],
              [<Tag key="c" color="amber">Communication</Tag>,    'Clarity, listening, stakeholder management'],
              [<Tag key="i" color="default">Innovation</Tag>,     'Creative problem solving, process improvement, new ideas'],
            ]}
          />

          <SubHeading>Visibility Levels</SubHeading>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
            <li><strong>Private</strong> — Only the recipient can see it</li>
            <li><strong>Recipient + Manager</strong> — Visible to recipient and their direct manager (default)</li>
            <li><strong>Public Team</strong> — Visible to the recipient&apos;s entire team</li>
          </ul>

          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            Send feedback at <Code>/employee/feedback</Code>. Feedback can optionally be linked to a specific goal.
          </p>
        </section>

        {/* ── USER FLOWS ────────────────────────────────────────── */}
        <section>
          <SectionHeading id="user-flows">User Flows</SectionHeading>

          <RoleSection title="Admin" color="blue" badge="admin">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Create a new cycle at <Code>/admin/cycles/new</Code> — set name, quarter, year, deadlines, review template, and competency weight</li>
              <li>Choose scope: org-wide or select specific departments (with employee-level include/exclude)</li>
              <li>Advance each department independently from <Code>draft</Code> → <Code>kpi_setting</Code> on the cycle detail page</li>
              <li>Monitor per-department pipeline progress with visual stepper and readiness stats</li>
              <li>Send reminder notifications when deadlines approach</li>
              <li>Optionally hold back or advance individual employees with status overrides</li>
              <li>Manage users at <Code>/admin/users</Code>: create users, set roles, variable pay, activate/deactivate, bulk import via CSV (with downloadable template) or Google Sheets</li>
              <li>Configure role slugs at <Code>/admin/roles</Code> for use in KPI/KRA templates — each role has a UUID and display label</li>
              <li>Manage KPI/KRA templates for quick setup by managers — templates can be scoped by role and/or department</li>
              <li>Manage the 3-tier Competency Library at <Code>/admin/competencies</Code> — Core (org-wide), Functional (department), Leadership (role/band)</li>
              <li>Delete cycles in draft status if no longer needed</li>
              <li>Build review templates with competency questions at <Code>/admin/review-templates</Code></li>
              <li>Manage MIS targets and sync settings at <Code>/admin/mis</Code></li>
              <li>Configure payout multipliers at <Code>/admin/payout-config</Code></li>
            </ol>
          </RoleSection>

          <RoleSection title="HRBP" color="amber" badge="hrbp">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Monitor all cycles from <Code>/hrbp</Code> — see per-department status, deadlines, and overdue indicators</li>
              <li>During <Code>calibrating</Code>: review the rating distribution at <Code>/hrbp/calibration</Code></li>
              <li>Override any manager rating — select new tier, write mandatory justification (sets <Code>is_final = true</Code>)</li>
              <li>Lock cycle/department — triggers payout calculation for in-scope employees</li>
              <li>Publish results to make ratings and payouts visible to employees</li>
              <li>Export payroll CSV from cycle detail page or <Code>/hrbp/payouts</Code></li>
              <li>View department-scoped reports at <Code>/hrbp/reports</Code></li>
              <li>Monitor MIS sync status at <Code>/hrbp/mis</Code></li>
              <li>Review audit trail at <Code>/hrbp/audit-log</Code></li>
            </ol>
          </RoleSection>

          <RoleSection title="Manager" color="green" badge="manager">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>During <Code>kpi_setting</Code>: go to each team member&apos;s page and follow the KRA → KPI workflow</li>
              <li>Step 1: Create KRAs (broad outcome areas) with category and weight — or apply KRA templates</li>
              <li>Step 2: Add KPIs under each KRA — weights within a KRA must total 100%</li>
              <li>Step 3: Click <strong>Finalize KRAs &amp; KPIs</strong> to lock for the employee</li>
              <li>Optionally link KPIs to MIS targets at <Code>/manager/mis</Code> for auto-scoring</li>
              <li>Approve or reject employee goals at <Code>/manager/[employeeId]/goals</Code></li>
              <li>During <Code>manager_review</Code>: view self-review, MIS auto-score (if available), rate competencies (1-5), and submit overall rating + comments</li>
              <li>Managers also submit their own self-review at <Code>/manager/my-review</Code></li>
              <li>View team payouts at <Code>/manager/payouts</Code> and team reports at <Code>/manager/reports</Code></li>
            </ol>
          </RoleSection>

          <RoleSection title="Employee" color="purple" badge="employee">
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>During <Code>kpi_setting</Code>: view assigned KRAs and KPIs (read-only) on <Code>/employee</Code></li>
              <li>Create and track goals at <Code>/employee/goals</Code> — submit for manager approval, update progress over time</li>
              <li>During <Code>self_review</Code>: select a self-rating, write comments, and submit</li>
              <li>Send feedback to colleagues at <Code>/employee/feedback</Code></li>
              <li>View personal MIS targets and progress at <Code>/employee/mis</Code></li>
              <li>After publication: view final rating and payout on the dashboard</li>
              <li>View past cycle history at <Code>/employee/history</Code></li>
            </ol>
          </RoleSection>
        </section>

        {/* ── CALCULATIONS ──────────────────────────────────────── */}
        <section>
          <SectionHeading id="calculations">Payout Calculations</SectionHeading>

          <SubHeading>How it works</SubHeading>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            Payout settings (multipliers, budget) are configured at <Code>/admin/payout-config</Code>.
            Each employee&apos;s <Code>variable_pay</Code> (annual performance payout amount, can be zero) is set on their user profile.
            The variable pay is snapshotted when the appraisal is created, so mid-cycle changes to variable_pay don&apos;t affect the current cycle.
          </p>

          <SubHeading>The formula</SubHeading>
          <CodeBlock>{`payout_amount = snapshotted_variable_pay × rating_multiplier

For mid-cycle exits:
payout_amount = snapshotted_variable_pay × rating_multiplier × proration_factor`}</CodeBlock>

          <Table
            headers={['Rating', 'Label', 'Default Multiplier', 'Notes']}
            rows={[
              [<Tag key="fee" color="green">FEE</Tag>,  'Far Exceeded Expectations',      '× 1.25', 'Highest fixed band'],
              [<Tag key="ee"  color="blue">EE</Tag>,   'Exceeded Expectations',           '× 1.10', ''],
              [<Tag key="me"  color="default">ME</Tag>, 'Met Expectations',               '× 1.00', 'Target band'],
              [<Tag key="sme" color="amber">SME</Tag>, 'Significantly Met Expectations',  '× 1.00', 'Configurable per cycle or globally'],
              [<Tag key="be"  color="red">BE</Tag>,    'Below Expectations',              '× 0.00', 'No variable payout'],
            ]}
          />

          <SubHeading>Where values are configured</SubHeading>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
            <li><strong>variable_pay</strong> — Set per user at <Code>/admin/users</Code>. Can be zero. Snapshotted at appraisal creation so mid-cycle changes don&apos;t affect payouts</li>
            <li><strong>rating_multiplier</strong> — Configured globally at <Code>/admin/payout-config</Code>. Can be overridden per cycle.</li>
            <li><strong>business_multiplier</strong> — Set per cycle (e.g., 0.9 in a tough year, 1.1 in a great year)</li>
          </ul>
        </section>

        {/* ── ADMIN CONFIGURATION ──────────────────────────────── */}
        <section>
          <SectionHeading id="admin-config">Admin Configuration</SectionHeading>

          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Admins have access to several configuration pages to manage the system:
          </p>

          <Table
            headers={['Page', 'Path', 'Purpose']}
            rows={[
              ['Dashboard',         <Code key="d">/admin</Code>,                    'Overview of cycles, user counts, and system health'],
              ['Cycles',            <Code key="c">/admin/cycles</Code>,              'Create, manage, and delete review cycles with department scoping'],
              ['Users',             <Code key="u">/admin/users</Code>,               'Manage users — create, edit, bulk import (CSV with downloadable template/Google Sheets), Zimyo sync, activate/deactivate'],
              ['Departments',       <Code key="dp">/admin/departments</Code>,        'Create, rename, and delete departments'],
              ['Roles',             <Code key="r">/admin/roles</Code>,               'Manage role slugs (UUID-based) used in KPI/KRA templates — create, edit, toggle active/inactive, delete'],
              ['KPI Templates',     <Code key="kpi">/admin/kpi-templates</Code>,     'Pre-built KPI templates by role and department — filterable by category (Performance/Behaviour/Learning)'],
              ['KRA Templates',     <Code key="kra">/admin/kra-templates</Code>,     'Pre-built KRA templates by role and department — filterable by category (Performance/Behaviour/Learning)'],
              ['Competencies',      <Code key="comp">/admin/competencies</Code>,     '3-tier competency library (Core/Functional/Leadership) with proficiency levels, department/role scoping, edit/delete'],
              ['Review Templates',  <Code key="rt">/admin/review-templates</Code>,   'Build competency assessment questionnaires to attach to cycles'],
              ['MIS Integration',   <Code key="mis">/admin/mis</Code>,               'AOP targets, monthly actuals, CSV import, sync logs'],
              ['MIS Settings',      <Code key="miss">/admin/mis/settings</Code>,     'Configure MIS API connection, department mapping, scoring thresholds'],
              ['Email Templates',   <Code key="et">/admin/email-templates</Code>,    'Customize notification email templates'],
              ['Notifications',     <Code key="n">/admin/notifications</Code>,       'Send manual notifications to individual users, roles, departments, or everyone'],
              ['Payout Config',     <Code key="pc">/admin/payout-config</Code>,      'Set rating multipliers (FEE, EE, ME, SME, BE)'],
              ['Payouts',           <Code key="p">/admin/payouts</Code>,             'View calculated payouts across cycles'],
              ['Reports',           <Code key="rp">/admin/reports</Code>,            'Aggregate performance reporting dashboard'],
              ['Audit Log',         <Code key="al">/admin/audit-log</Code>,          'Full immutable audit trail across all cycles'],
            ]}
          />
        </section>

        {/* ── QUICK REFERENCE ───────────────────────────────────── */}
        <section>
          <SectionHeading id="quick-ref">Quick Reference</SectionHeading>

          <SubHeading>What can each role do at each stage?</SubHeading>
          <Table
            headers={['Stage', 'Employee', 'Manager', 'HRBP', 'Admin']}
            rows={[
              ['draft',           '—',                              '—',                                '—',                                     'Create cycle, set scope & deadlines'],
              ['kpi_setting',     'View KRAs & KPIs, create goals', 'Create KRAs → KPIs → Finalize, link MIS', '—',                              'Advance dept, send reminders'],
              ['self_review',     'Submit self-review',             'View team status',                 'Schedule discussion meetings',           'Advance dept, send reminders'],
              ['manager_review',  'Attend discussion meeting, view MOM', 'Attend meeting, rate after MOM submitted', 'Schedule meeting, submit MOM',  'Advance dept, send reminders'],
              ['calibrating',     '—',                              '—',                                'Override ratings, view bell curve',      'Advance dept'],
              ['locked',          '—',                              '—',                                'Publish, export payroll',                '—'],
              ['published',       'See rating & payout',            'See team results',                 'Full access',                           'Full access'],
            ]}
          />

          <SubHeading>Always available (any stage)</SubHeading>
          <Table
            headers={['Feature', 'Employee', 'Manager', 'HRBP', 'Admin']}
            rows={[
              ['Goals',        'Create, submit, track progress',  'Approve/reject goals',       '—',                  '—'],
              ['Feedback',     'Send & receive feedback',         'View team feedback',          '—',                  '—'],
              ['MIS Targets',  'View personal targets',           'View team targets, link KPIs', 'View dept overview', 'Manage all targets'],
              ['History',      'View past cycles',                'View team history',           'View all history',    'View all history'],
              ['Reports',      '—',                               'Team reports',                'Dept reports',        'Org reports'],
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
              ['mis_sync',                    'Admin/system MIS sync',             'records synced/failed, sync type'],
              ['competency_rated',            'Manager rates competencies',        'review_id, question_id, rating_value'],
            ]}
          />
        </section>
      </div>
    </div>
  )
}
