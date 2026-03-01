export interface TourStep {
  id: string
  title: string
  body: string
}

export interface Tour {
  id: string
  routePattern: RegExp
  steps: TourStep[]
}

export const TOURS: Tour[] = [
  {
    id: 'employee-review',
    routePattern: /^\/employee$/,
    steps: [
      { id: 'action-inbox',    title: 'Your action items',     body: 'This card tells you exactly what to do right now. It updates as the cycle progresses.' },
      { id: 'kpi-list',        title: 'Your KPIs',             body: "These are the goals you'll be rated against. They were set by your manager at the start of the cycle." },
      { id: 'self-review-form',title: 'Rate yourself',         body: "Rate yourself honestly — your manager will see your rating alongside their own assessment." },
      { id: 'submit-review',   title: 'Submit when ready',     body: "Once submitted, your self-review is locked. Make sure you're happy with your answers first." },
    ],
  },
  {
    id: 'manager-team',
    routePattern: /^\/manager$/,
    steps: [
      { id: 'team-table',     title: 'Your team at a glance', body: "Each row shows an employee's review status. Red means overdue — act on those first." },
      { id: 'kpi-button',     title: 'Set KPIs first',        body: 'During KPI Setting stage, click here to add or edit goals for each employee.' },
      { id: 'review-button',  title: 'Submit your rating',    body: 'Once an employee has submitted their self-review, click here to add your own rating and comments.' },
    ],
  },
  {
    id: 'manager-kpis',
    routePattern: /^\/manager\/[^/]+\/kpis/,
    steps: [
      { id: 'template-picker', title: 'Start from a template', body: 'Templates are pre-approved KPIs for this role. Pick one to save time.' },
      { id: 'weight-field',    title: 'Set the weight',        body: 'Weights must sum to 100 across all KPIs. A weight of 40 means this KPI contributes 40% of the final score.' },
      { id: 'add-kpi-btn',     title: 'Add the KPI',           body: 'Click to save this KPI. Add as many as needed, then check the weights sum to 100.' },
    ],
  },
  {
    id: 'admin-cycles',
    routePattern: /^\/admin\/cycles$/,
    steps: [
      { id: 'create-cycle',   title: 'Create a cycle',       body: 'A cycle covers one review period (usually a quarter). Set the deadlines for each stage here.' },
      { id: 'cycle-status',   title: 'Cycle stages',         body: 'Cycles move through 7 stages. Each stage unlocks different actions for employees, managers, and HRBP.' },
      { id: 'advance-btn',    title: 'Advance when ready',   body: 'Click Advance to move to the next stage. This notifies the right people automatically.' },
    ],
  },
  {
    id: 'hrbp-calibrate',
    routePattern: /^\/hrbp\/calibration/,
    steps: [
      { id: 'bell-curve',     title: 'Rating distribution',  body: 'This shows how manager ratings are spread. Look for unexpected clustering or outliers.' },
      { id: 'override-form',  title: 'Override a rating',    body: "Enter a final rating here if calibration suggests an adjustment. The employee won't see this until you publish." },
      { id: 'lock-btn',       title: 'Lock when done',       body: 'Locking freezes all ratings — no more overrides after this point.' },
      { id: 'publish-btn',    title: 'Publish to employees', body: 'Publishing makes results visible to all employees. This cannot be undone.' },
    ],
  },
]

export function getTourForPath(pathname: string): Tour | null {
  return TOURS.find(t => t.routePattern.test(pathname)) ?? null
}
