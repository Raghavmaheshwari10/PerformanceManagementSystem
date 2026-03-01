export interface HelpArticle {
  slug: string
  title: string
  summary: string
  roles: ('employee' | 'manager' | 'hrbp' | 'admin')[]
  body: string
}

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: 'what-is-pms',
    title: 'What is the Performance Management System?',
    summary: 'An overview of PMS and how it works at EMB Global.',
    roles: ["employee", "manager", "hrbp", "admin"],
    body: `What is the Performance Management System?
==========================================

The Performance Management System (PMS) is EMB Global tool for setting goals,
tracking performance, and calculating variable pay (bonuses) every appraisal cycle.

The 7-Stage Cycle
-----------------

1. Draft   - Created by admin/HRBP; not visible to employees yet.
2. KPI Setting - Employees set goals with weights summing to 100%.
3. Self Review - Employees rate themselves on each KPI.
4. Manager Review - Managers rate each direct report and submit.
5. Calibrating - HRBP reviews for fairness; may override with is_final=true.
6. Locked - No further changes. Payouts calculated automatically.
7. Published - Final ratings and payouts visible to employees.

The Payout Formula
------------------

  Payout = Variable Pay x Individual Multiplier x Business Multiplier

Variable pay is snapshotted at cycle creation.

Individual Multipliers
----------------------

  FEE (Far Exceeds Expectations)      1.25x
  EE  (Exceeds Expectations)          1.10x
  ME  (Meets Expectations)            1.00x
  SME (Sometimes Meets Expectations)  Variable (set per cycle by HRBP)
  BE  (Below Expectations)            0x (no payout)

The Business Multiplier reflects overall company performance.
`,
  },
  {
    slug: 'setting-kpis',
    title: 'How to set your KPIs',
    summary: 'Step-by-step guide to setting meaningful goals.',
    roles: ["employee"],
    body: `How to set your KPIs
====================

KPIs are the goals you will be rated against at the end of the appraisal cycle.

When Can I Set KPIs?
--------------------

The KPI Setting stage opens after the cycle moves from Draft.
There is a deadline shown on the cycle banner.

Using Templates
---------------

Click Use Template when adding a KPI. Templates are pre-populated for your role.

The SMART Framework
-------------------

Every KPI should be SMART:

  S - Specific     Clear and precise; avoid vague language.
  M - Measurable   Include a number, percentage, or milestone.
  A - Achievable   Ambitious but realistic.
  R - Relevant     Contributes to team or business objectives.
  T - Time-bound   Structured around the cycle end date.

Weights Must Sum to 100%
------------------------

Each KPI has a weight (e.g., 30%). Total must equal 100%.

Tips
----
- Assign the highest weight to your most important goal.
- Aim for 3-6 KPIs.
- Review with your manager before the deadline.
`,
  },
  {
    slug: 'self-review',
    title: 'Completing your self-review',
    summary: 'How to rate yourself and write meaningful comments.',
    roles: ["employee"],
    body: `Completing your self-review
===========================

The self-review lets you share your perspective before your manager submits.

When Do I Do It?
----------------

When the cycle enters the Self Review stage. Check the banner for the deadline.

The Rating Scale
----------------

  FEE  Far Exceeds Expectations     Exceptional; significantly above the bar
  EE   Exceeds Expectations         Consistently delivered more than expected
  ME   Meets Expectations           Solid performance; met all goals
  SME  Sometimes Meets Expectations Partially met goals; improvement needed
  BE   Below Expectations           Did not meet the majority of goals

Rate yourself honestly. You are not penalised for a lower rating.

Writing Meaningful Comments
---------------------------

Be Specific: reference deliverables, numbers, or outcomes.
Cite Evidence: mention specific projects, metrics, or feedback.
Be Professional: write formally; explain obstacles neutrally.
Acknowledge Gaps: for SME or BE, explain what happened and what you would do differently.

Click Submit Self-Review once all KPIs have a rating and comment.
`,
  },
  {
    slug: 'manager-review',
    title: 'How to review your team',
    summary: 'Guide for managers on rating employees and submitting reviews.',
    roles: ["manager"],
    body: `How to review your team
=======================

In the Manager Review stage, assess each direct report fairly.

Before You Start
----------------

1. Review KPIs - Re-read the goals set at cycle start.
2. Read the Self-Review - Employees may include context you were unaware of.
3. Be Consistent - Similar results should receive similar ratings.

Submitting Reviews
------------------

For each employee, for each KPI:
- Select your rating (FEE / EE / ME / SME / BE)
- Write a comment explaining the rating

Click Submit Review when done. You can save drafts before the deadline.
Once submitted, the review cannot be edited unless an HRBP resets it.

What Happens After
------------------

HRBP calibrates all ratings for fairness. They may override using is_final.
Final ratings are visible after lock. Employees see results after publication.
`,
  },
  {
    slug: 'calibration',
    title: 'Calibration and HRBP overrides',
    summary: 'How HRBP reviews, adjusts, and finalises ratings.',
    roles: ["hrbp", "admin"],
    body: `Calibration and HRBP Overrides
================================

Calibration is the stage where HRBP reviews all manager-submitted ratings.

Goals of calibration:
- Identify outliers (e.g., entire team rated FEE when results were average)
- Ensure consistency across departments
- Apply business-level adjustments before payouts are locked

How to Override a Rating
------------------------

1. Navigate to Calibration in the HRBP dashboard.
2. Find the employee.
3. Select the new rating.
4. Toggle Mark as Final (sets is_final = true).
5. Save.

The is_final Flag
-----------------

When is_final is true, the HRBP rating overrides the manager rating for payout.

Locking the Cycle
-----------------

Move the cycle to Locked when calibration is complete. This action:

- Is irreversible.
- Triggers automatic payout: Payout = Snapshotted VP x Individual Multiplier x Business Multiplier
- Stores payout amounts on each appraisal record.

Important Notes
---------------

- Set the SME multiplier before locking.
- BE rating = 0x multiplier (zero payout).
- Payout uses variable pay snapshotted at cycle creation.
`,
  }
]
