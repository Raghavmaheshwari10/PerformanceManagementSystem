import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { fetchRoleOptions } from '@/lib/db/role-slugs'
import { CompetencyForm } from './competency-form'
import { deleteCompetency, toggleCompetencyActive } from './actions'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const CATEGORY_STYLES: Record<string, string> = {
  core: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  functional: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  leadership: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
}

const CATEGORY_LABELS: Record<string, string> = {
  core: 'Core',
  functional: 'Functional',
  leadership: 'Leadership',
}

export default async function CompetenciesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  await requireRole(['admin', 'hrbp'])
  const { category } = await searchParams

  const [competencies, departments, roleOptions] = await Promise.all([
    prisma.competency.findMany({
      where: category ? { category } : undefined,
      include: {
        department: { select: { name: true } },
        role_slug: { select: { label: true } },
        _count: { select: { review_questions: true } },
      },
      orderBy: [{ category: 'asc' }, { sort_order: 'asc' }, { name: 'asc' }],
    }),
    prisma.department.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    fetchRoleOptions(),
  ])

  // Group by category
  const grouped = competencies.reduce<Record<string, typeof competencies>>((acc, c) => {
    const key = c.category
    acc[key] = [...(acc[key] ?? []), c]
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Competency Library</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Core (org-wide), Functional (department), and Leadership (role/band) competencies
          </p>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2">
        {[
          { value: '', label: 'All' },
          { value: 'core', label: 'Core' },
          { value: 'functional', label: 'Functional' },
          { value: 'leadership', label: 'Leadership' },
        ].map(opt => (
          <Link key={opt.value} href={opt.value ? `/admin/competencies?category=${opt.value}` : '/admin/competencies'}>
            <Button variant={category === opt.value || (!category && !opt.value) ? 'default' : 'outline'} size="sm">
              {opt.label}
            </Button>
          </Link>
        ))}
      </div>

      {/* Add new competency */}
      <section className="glass rounded-lg border p-5 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Add Competency</h2>
        <CompetencyForm departments={departments} roleOptions={roleOptions} />
      </section>

      {/* Competency list grouped by category */}
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="glass rounded-lg border">
          <div className="px-4 py-2 bg-muted/50 border-b flex items-center gap-2">
            <Badge className={CATEGORY_STYLES[cat] ?? 'bg-muted text-muted-foreground'}>
              {CATEGORY_LABELS[cat] ?? cat}
            </Badge>
            <span className="text-xs text-muted-foreground">{items.length} competenc{items.length === 1 ? 'y' : 'ies'}</span>
          </div>
          <div className="divide-y">
            {items.map(c => {
              const profLevels = c.proficiency_levels as Array<{ band: string; label: string; description: string }> | null
              return (
                <div key={c.id} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{c.name}</p>
                        {!c.is_active && (
                          <span className="text-[10px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">Inactive</span>
                        )}
                      </div>
                      {c.description && <p className="text-xs text-muted-foreground mt-0.5">{c.description}</p>}
                      <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground">
                        {c.department && <span>Dept: {c.department.name}</span>}
                        {c.role_slug && <span>Role: {c.role_slug.label}</span>}
                        {c._count.review_questions > 0 && (
                          <span>Used in {c._count.review_questions} question(s)</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <form action={toggleCompetencyActive.bind(null, c.id, c.is_active) as unknown as (fd: FormData) => Promise<void>}>
                        <button type="submit"
                          className={`text-xs rounded-full px-2 py-0.5 font-medium ${c.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                          {c.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </form>
                      {c._count.review_questions === 0 && (
                        <form action={deleteCompetency.bind(null, c.id)}>
                          <button type="submit" className="text-xs text-destructive hover:underline">Delete</button>
                        </form>
                      )}
                    </div>
                  </div>
                  {profLevels && profLevels.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-1">
                      {profLevels.map((pl, i) => (
                        <span key={i} className="text-[10px] bg-muted/50 rounded px-2 py-0.5" title={pl.description}>
                          <strong>{pl.band}</strong>: {pl.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {competencies.length === 0 && (
        <p className="text-sm text-muted-foreground">No competencies yet. Add one above.</p>
      )}
    </div>
  )
}
