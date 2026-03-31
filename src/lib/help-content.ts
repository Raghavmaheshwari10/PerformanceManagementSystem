export interface HelpArticle {
  id: string
  title: string
  body: string
  route: string
}

export interface PageHelp {
  summary: string[]
  articles: HelpArticle[]
}

export const HELP_CONTENT: Record<string, PageHelp> = {
  '/employee': {
    summary: [
      'This is your self-review page — complete it before the deadline shown above.',
      'Your KPIs are the goals you agreed on at the start of the cycle.',
      'Rate yourself honestly — your manager will see your rating alongside their own.',
      'Once submitted, your review is locked. Double-check before clicking Submit.',
      'After your manager reviews you, results appear in My History once published.',
    ],
    articles: [
      { id: 'emp-ratings', title: 'What do the rating labels mean?', body: 'FEE = Far Exceeds Expectations, EE = Exceeds Expectations, ME = Meets Expectations, SME = Sometimes Meets Expectations, BE = Below Expectations.', route: '/employee' },
      { id: 'emp-deadline', title: 'What happens if I miss the deadline?', body: 'Your manager may still be able to review you, but your self-review will be marked as missing. Contact your manager or HRBP if you have missed the deadline.', route: '/employee' },
    ],
  },
  '/employee/history': {
    summary: [
      'This page shows all your past published review cycles.',
      'Click any cycle to see your full appraisal including KPI scores and payout.',
      'Ratings are final once published — contact your HRBP if you have concerns.',
    ],
    articles: [],
  },
  '/manager': {
    summary: [
      "This is your team overview — each card shows an employee's current review status.",
      'Red badges mean a review is overdue — act on those first.',
      'Click "KPIs" to add or edit an employee\'s goals before the KPI Setting deadline.',
      'Click "Review" to submit your rating after the employee has completed their self-review.',
      'Your own review is under My Review in the sidebar.',
    ],
    articles: [
      { id: 'mgr-kpi-weights', title: 'How do KPI weights work?', body: 'Each KPI has a weight (percentage). All weights must sum to 100. A KPI with weight 40 contributes 40% of the total score.', route: '/manager' },
      { id: 'mgr-rating-scale', title: 'What rating should I give?', body: "Compare against the role's expected output: FEE for exceptional, ME for solid delivery, BE for below standard. Calibration may adjust final ratings.", route: '/manager' },
    ],
  },
  '/manager/my-review': {
    summary: [
      'This shows your own self-review and final appraisal once published.',
      'Your manager will submit a rating for you separately.',
      'You cannot edit this page — it is read-only.',
    ],
    articles: [],
  },
  '/admin': {
    summary: [
      'The dashboard shows the health of your active review cycle at a glance.',
      'Cycle Health shows how many employees have completed each stage.',
      'People shows team size, role breakdown, and last sync date.',
      'Click into Cycles to advance the current cycle or view per-employee status.',
    ],
    articles: [],
  },
  '/admin/cycles': {
    summary: [
      'Cycles move through 7 stages: Draft → KPI Setting → Self Review → Manager Review → Calibrating → Locked → Published.',
      'You advance stages manually using the Advance button on each cycle.',
      'Advancing notifies the right people automatically.',
      'Click a cycle name to see per-employee status and send targeted reminders.',
    ],
    articles: [
      { id: 'adm-advance', title: 'When should I advance the cycle?', body: 'Advance when the majority of users have completed the current stage, or when the deadline has passed. Check the per-employee table before advancing.', route: '/admin/cycles' },
    ],
  },
  '/admin/users': {
    summary: [
      'Search and filter users by name, role, department, or status.',
      'Click a role badge to change it inline.',
      'Click the active/inactive status to toggle a user.',
      'Use Upload CSV to bulk-import users from a spreadsheet.',
      'Sync from Zimyo pulls the latest employee list from your HR system.',
    ],
    articles: [],
  },
  '/admin/kpi-templates': {
    summary: [
      'Templates are reusable KPI definitions managers can add to employees.',
      'Set a template as Inactive to hide it from managers without deleting it.',
      'Category and role_slug help managers find relevant templates quickly.',
      'Weight on templates is a suggestion — managers can adjust per employee.',
    ],
    articles: [],
  },
  '/admin/notifications': {
    summary: [
      'Send a message to an individual, a role, a department, or everyone.',
      'Messages appear in the notification bell for recipients.',
      'You can optionally include a link to direct users to a specific page.',
      'Sent history shows the last 20 manual notifications.',
    ],
    articles: [],
  },
  '/admin/feature-flags': {
    summary: [
      'Feature flags toggle functionality on or off globally for all users.',
      'Changes take effect immediately — no redeploy needed.',
      'Use with care: disabling a module hides it from all users.',
    ],
    articles: [],
  },
  '/hrbp': {
    summary: [
      'This shows all active and published cycles.',
      'Click Calibrate on a cycle in the Calibrating stage to review and adjust ratings.',
      'You can only calibrate cycles that have reached the Calibrating stage.',
    ],
    articles: [],
  },
  '/hrbp/calibration': {
    summary: [
      'The bell curve shows the distribution of manager ratings across the team.',
      'Override a final rating by entering a new value in the Override column.',
      'Lock the cycle when calibration is complete — this freezes all ratings.',
      'Publish releases results to employees. This cannot be undone.',
    ],
    articles: [
      { id: 'hrbp-lock', title: 'What is the difference between Lock and Publish?', body: 'Locking freezes ratings so no more overrides are possible. Publishing makes results visible to employees. You must lock before you can publish.', route: '/hrbp/calibration' },
      { id: 'hrbp-override', title: 'When should I override a rating?', body: 'Override when calibration reveals outliers, bias, or inconsistency across managers. Document your reasoning in the manager review comments if possible.', route: '/hrbp/calibration' },
    ],
  },
  '/hrbp/audit-log': {
    summary: [
      'The audit log records every significant action taken in the system.',
      'Use it to investigate disputes or verify when actions were taken.',
    ],
    articles: [],
  },
}

export const ALL_ARTICLES: HelpArticle[] = Object.values(HELP_CONTENT).flatMap(p => p.articles)

export function getPageHelp(pathname: string): PageHelp | null {
  if (HELP_CONTENT[pathname]) return HELP_CONTENT[pathname]
  const parent = pathname.replace(/\/[^/]+$/, '')
  if (parent && parent !== pathname) return getPageHelp(parent)
  return null
}
