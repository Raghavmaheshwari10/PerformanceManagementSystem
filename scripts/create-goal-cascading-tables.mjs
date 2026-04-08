import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL)

async function main() {
  console.log('Creating goal cascading tables...')

  await sql`
    CREATE TABLE IF NOT EXISTS org_goals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      cycle_id UUID REFERENCES cycles(id),
      created_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
    )
  `
  console.log('✓ org_goals table created')

  await sql`
    CREATE TABLE IF NOT EXISTS dept_goals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      org_goal_id UUID NOT NULL REFERENCES org_goals(id) ON DELETE CASCADE,
      department_id UUID NOT NULL REFERENCES departments(id),
      created_by UUID NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
    )
  `
  console.log('✓ dept_goals table created')

  await sql`
    ALTER TABLE kpis
    ADD COLUMN IF NOT EXISTS dept_goal_id UUID REFERENCES dept_goals(id) ON DELETE SET NULL
  `
  console.log('✓ dept_goal_id column added to kpis')

  console.log('Done!')
}

main().catch(console.error)
