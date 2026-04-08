import { neon } from '@neondatabase/serverless'
import ws from 'ws'
import { neonConfig } from '@neondatabase/serverless'

neonConfig.webSocketConstructor = ws

const sql = neon(process.env.DIRECT_URL)

await sql`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'kpi_comment'`

await sql`
  CREATE TABLE IF NOT EXISTS kpi_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kpi_id UUID NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
  )
`

await sql`CREATE INDEX IF NOT EXISTS idx_kpi_comments_kpi_created ON kpi_comments(kpi_id, created_at)`

console.log('kpi_comments table and enum value created successfully')
