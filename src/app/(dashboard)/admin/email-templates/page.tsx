import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { TemplateEditor } from './template-editor'

/** Default subjects used as fallback when no DB override exists */
const DEFAULT_SUBJECTS: Record<string, string> = {
  cycle_kpi_setting_open: 'KPI Setting Phase is Open',
  cycle_self_review_open: 'Self Review Phase is Open',
  cycle_manager_review_open: 'Manager Review Phase is Open',
  cycle_published: 'Your Performance Results are Available',
  review_submitted: 'Employee Submitted Their Self-Review',
  manager_review_submitted: 'Your Manager Review Has Been Submitted',
  review_reminder: 'Reminder: Complete Your Pending Review',
  admin_message: 'Message from Admin',
  peer_review_requested: 'Peer Review Requested',
  peer_review_submitted: 'A Peer Has Submitted Their Review',
}

const ALL_TYPES = Object.keys(DEFAULT_SUBJECTS)

export default async function AdminEmailTemplatesPage() {
  await requireRole(['admin'])

  const customTemplates = await prisma.emailTemplate.findMany()

  // Build a merged map: for each notification type, show custom if it exists, else default
  const templates: Record<string, { subject: string; html_body: string; isCustom: boolean }> = {}

  for (const type of ALL_TYPES) {
    const custom = customTemplates.find(t => t.notification_type === type)
    if (custom) {
      templates[type] = {
        subject: custom.subject,
        html_body: custom.html_body,
        isCustom: true,
      }
    }
    // Non-custom types will use defaults from the client component
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Email Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customize the email content sent for each notification type. Use {'{{placeholder}}'} syntax for dynamic values.
        </p>
      </div>

      <TemplateEditor templates={templates} />
    </div>
  )
}
