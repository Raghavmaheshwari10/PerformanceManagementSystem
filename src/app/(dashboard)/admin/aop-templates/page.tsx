import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { initAopTemplates } from './actions'
import { Shield, CheckCircle2 } from 'lucide-react'
import { SubmitButton } from '@/components/submit-button'

const AOP_KRA_TITLE = 'AOP Targets'
const AOP_KPI_TITLES = ['Delivered Revenue', 'Gross Margin', 'New Sales (GMV)']

export default async function AopTemplatesPage() {
  const user = await requireRole(['admin'])
  const isSuperadmin = user.role === 'superadmin'

  // Fetch existing protected AOP templates
  const kraTemplate = await prisma.kraTemplate.findFirst({
    where: { title: AOP_KRA_TITLE, is_protected: true },
    include: {
      kpi_templates: {
        where: { is_protected: true },
        orderBy: { created_at: 'asc' },
      },
    },
  })

  const allTemplatesExist =
    kraTemplate !== null &&
    AOP_KPI_TITLES.every((title) =>
      kraTemplate.kpi_templates.some((t) => t.title === title)
    )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">AOP KPI Templates</h1>
          <p className="mt-1 text-sm text-white/50">
            Protected templates used to auto-assign AOP KPIs when a department cascade is locked.
          </p>
        </div>
        {isSuperadmin && !allTemplatesExist && (
          <form action={initAopTemplates}>
            <SubmitButton
              pendingLabel="Initializing..."
              className="rounded-lg bg-indigo-500 hover:bg-indigo-400 px-5 py-2 text-sm font-medium text-white transition-colors"
            >
              Initialize AOP Templates
            </SubmitButton>
          </form>
        )}
      </div>

      {/* Status banner */}
      {allTemplatesExist ? (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          All AOP templates are initialized and ready.
        </div>
      ) : (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400">
          {isSuperadmin
            ? 'AOP templates are not yet initialized. Click "Initialize AOP Templates" to create them.'
            : 'AOP templates have not been initialized yet. Please ask a superadmin to initialize them.'}
        </div>
      )}

      {/* KRA Template Card */}
      <div className="bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-white/90">KRA Template</h2>
            {kraTemplate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 px-2.5 py-0.5 text-xs font-medium text-indigo-300">
                <Shield className="h-3 w-3" />
                Protected — Cannot be deleted
              </span>
            )}
          </div>
        </div>

        {kraTemplate ? (
          <div className="rounded-lg bg-white/[0.04] border border-white/10 px-4 py-3">
            <p className="text-sm font-medium text-white/90">{kraTemplate.title}</p>
            <p className="text-xs text-white/50 mt-0.5">Category: {kraTemplate.category}</p>
          </div>
        ) : (
          <p className="text-sm text-white/40 italic">Not yet created</p>
        )}
      </div>

      {/* KPI Templates Card */}
      <div className="bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-white/90">KPI Templates</h2>
          <span className="text-xs text-white/40">(linked to AOP Targets KRA)</span>
        </div>

        <div className="space-y-2">
          {AOP_KPI_TITLES.map((title) => {
            const existing = kraTemplate?.kpi_templates.find((t) => t.title === title)
            return (
              <div
                key={title}
                className="flex items-center justify-between rounded-lg bg-white/[0.04] border border-white/10 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-white/90">{title}</p>
                  <p className="text-xs text-white/50 mt-0.5">Unit: number · Category: performance</p>
                </div>
                {existing ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 px-2.5 py-0.5 text-xs font-medium text-indigo-300">
                    <Shield className="h-3 w-3" />
                    Protected — Cannot be deleted
                  </span>
                ) : (
                  <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-xs text-white/40">
                    Not created
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {!isSuperadmin && (
        <p className="text-xs text-white/30">
          Only superadmins can initialize or delete protected AOP templates.
        </p>
      )}
    </div>
  )
}
