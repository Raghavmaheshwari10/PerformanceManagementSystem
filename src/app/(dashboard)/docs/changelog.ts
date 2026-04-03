export type ChangeType = 'new' | 'improved' | 'fixed'
export type RoleTag = 'all' | 'admin' | 'manager' | 'employee' | 'hrbp'

export interface ChangeEntry {
  date: string
  changes: {
    type: ChangeType
    roles: RoleTag[]
    text: string
  }[]
}

export const CHANGELOG: ChangeEntry[] = [
  {
    date: '2026-04-03',
    changes: [
      { type: 'improved', roles: ['admin'], text: 'CSV/Sheets import now auto-creates departments that don\'t exist' },
      { type: 'improved', roles: ['admin'], text: 'Role validation on import — invalid roles show warnings instead of silently defaulting' },
      { type: 'new',      roles: ['admin'], text: 'Generate Invite Link and Send Password Reset fully functional in user edit page' },
      { type: 'improved', roles: ['admin'], text: 'Downloadable CSV template with sample data for bulk user import' },
    ],
  },
  {
    date: '2026-03-15',
    changes: [
      { type: 'new', roles: ['all'],     text: 'KRA (Key Result Area) system — KPIs now grouped under KRAs for better organisation' },
      { type: 'new', roles: ['admin'],   text: 'KRA Templates — define reusable KRA templates per role and department' },
      { type: 'new', roles: ['manager'], text: 'KRA Template Picker — apply pre-built KRAs when setting up an employee\'s review' },
      { type: 'new', roles: ['all'],     text: '3-tier Competency Library — Core, Functional, and Leadership with proficiency levels' },
    ],
  },
  {
    date: '2026-02-20',
    changes: [
      { type: 'new',      roles: ['admin'], text: 'Google Sheets import — paste a sheet URL to import users directly' },
      { type: 'new',      roles: ['admin'], text: 'Zimyo sync — automated user sync from Zimyo HR system' },
      { type: 'improved', roles: ['all'],   text: 'Redesigned sidebar with collapsible sections and improved navigation' },
    ],
  },
]
