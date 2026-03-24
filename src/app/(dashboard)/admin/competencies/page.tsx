import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { CompetencyForm } from './competency-form'
import { deleteCompetency } from './actions'

export default async function CompetenciesPage() {
  await requireRole(['admin', 'hrbp'])

  const competencies = await prisma.competency.findMany({ orderBy: { name: 'asc' } })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Competency Library</h1>

      <section className="rounded border p-4 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Add Competency</h2>
        <CompetencyForm />
      </section>

      {competencies.length === 0 ? (
        <p className="text-sm text-muted-foreground">No competencies yet.</p>
      ) : (
        <div className="space-y-2">
          {competencies.map(c => (
            <div key={c.id} className="flex items-start justify-between rounded border p-3">
              <div>
                <p className="font-medium text-sm">{c.name}</p>
                {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
              </div>
              <form action={deleteCompetency.bind(null, c.id)}>
                <button type="submit" className="text-xs text-destructive hover:underline">Delete</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
