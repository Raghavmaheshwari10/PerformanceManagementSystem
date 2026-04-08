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
          <h1 className="text-2xl font-semibold text-gray-900">AOP KPI Templates</h1>
          <p className="mt-1 text-sm text-slate-500">
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
        <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          All AOP templates are initialized and ready.
        </div>
      ) : (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          {isSuperadmin
            ? 'AOP templates are not yet initialized. Click "Initialize AOP Templates" to create them.'
            : 'AOP templates have not been initialized yet. Please ask a superadmin to initialize them.'}
        </div>
      )}

      {/* KRA Template Card */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-gray-900">KRA Template</h2>
            {kraTemplate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 border border-indigo-200 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                <Shield className="h-3 w-3" />
                Protected — Cannot be deleted
              </span>
            )}
          </div>
        </div>

        {kraTemplate ? (
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
            <p className="text-sm font-medium text-gray-900">{kraTemplate.title}</p>
            <p className="text-xs text-slate-500 mt-0.5">Category: {kraTemplate.category}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-400 italic">Not yet created</p>
        )}
      </div>

      {/* KPI Templates Card */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900">KPI Templates</h2>
          <span className="text-xs text-slate-400">(linked to AOP Targets KRA)</span>
        </div>

        <div className="space-y-2">
          {AOP_KPI_TITLES.map((title) => {
            const existing = kraTemplate?.kpi_templates.find((t) => t.title === title)
            return (
              <div
                key={title}
                className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Unit: number · Category: performance</p>
                </div>
                {existing ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 border border-indigo-200 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                    <Shield className="h-3 w-3" />
                    Protected — Cannot be deleted
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-xs text-slate-500">
                    Not created
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {!isSuperadmin && (
        <p className="text-xs text-slate-400">
          Only superadmins can initialize or delete protected AOP templates.
        </p>
      )}
    </div>
  )
}
