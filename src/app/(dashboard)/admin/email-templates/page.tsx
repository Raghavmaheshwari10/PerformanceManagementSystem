import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { TemplateEditor } from './template-editor'

export default async function AdminEmailTemplatesPage() {
  await requireRole(['admin'])

  const customTemplates = await prisma.emailTemplate.findMany()

  // Build a merged map: for each notification type, show custom if it exists
  const templates: Record<string, { subject: string; html_body: string; isCustom: boolean }> = {}

  for (const custom of customTemplates) {
    templates[custom.notification_type] = {
      subject: custom.subject,
      html_body: custom.html_body,
      isCustom: true,
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Email Templates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customize the emails sent for each notification type. All emails include a branded header and footer automatically.
          Use <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">{'{{placeholder}}'}</code> syntax for dynamic content.
        </p>
      </div>

      <TemplateEditor templates={templates} />
    </div>
  )
}
