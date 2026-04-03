import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { fetchRoleOptions } from '@/lib/db/role-slugs'
import { CompetencyForm } from './competency-form'
import { deleteCompetency, toggleCompetencyActive } from './actions'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { COMPETENCY_CATEGORY_LABELS } from '@/lib/constants'
import { Pencil, Trash2 } from 'lucide-react'

const CATEGORY_STYLES: Record<string, string> = {
  core: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  functional: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  leadership: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
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

      {/* Competency list grouped by category — table layout */}
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="glass rounded-lg border overflow-hidden">
          <div className="px-4 py-2 bg-muted/50 border-b flex items-center gap-2">
            <Badge className={CATEGORY_STYLES[cat] ?? 'bg-muted text-muted-foreground'}>
              {COMPETENCY_CATEGORY_LABELS[cat] ?? cat}
            </Badge>
            <span className="text-xs text-muted-foreground">{items.length} competenc{items.length === 1 ? 'y' : 'ies'}</span>
          </div>
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="p-3 text-left w-[18%]">Name</th>
                <th className="p-3 text-left w-[25%]">Description</th>
                <th className="p-3 text-left w-[12%]">Scope</th>
                <th className="p-3 text-left w-[22%]">Proficiency Levels</th>
                <th className="p-3 text-left w-[7%]">Usage</th>
                <th className="p-3 text-right w-[16%]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(c => {
                const profLevels = c.proficiency_levels as Array<{ band: string; label: string; description: string }> | null
                const scope = c.department?.name
                  ? c.department.name
                  : c.role_slug?.label
                    ? c.role_slug.label
                    : cat === 'core' ? 'Org-wide' : '—'

                return (
                  <tr key={c.id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate">{c.name}</span>
                        {!c.is_active && (
                          <span className="shrink-0 text-[10px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5">Inactive</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground truncate" title={c.description ?? undefined}>
                      {c.description ?? '—'}
                    </td>
                    <td className="p-3">
                      <span className="text-xs text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5 truncate inline-block max-w-full">
                        {scope}
                      </span>
                    </td>
                    <td className="p-3">
                      {profLevels && profLevels.length > 0 ? (
                        <div className="flex gap-1 flex-wrap">
                          {profLevels.map((pl, i) => (
                            <span key={i} className="text-[10px] bg-muted/60 rounded px-1.5 py-0.5 whitespace-nowrap" title={pl.description}>
                              <strong>{pl.band}</strong> {pl.label}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      {c._count.review_questions > 0 ? (
                        <span className="text-xs text-muted-foreground">{c._count.review_questions} Q</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-1">
                        <form action={toggleCompetencyActive.bind(null, c.id, c.is_active) as unknown as (fd: FormData) => Promise<void>}>
                          <button type="submit"
                            className={`text-xs rounded-full px-2 py-0.5 font-medium transition-colors ${c.is_active
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                            {c.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </form>
                        <Link href={`/admin/competencies/${c.id}/edit`}
                          className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                        <form action={deleteCompetency.bind(null, c.id)}>
                          <button type="submit"
                            className="rounded p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}

      {competencies.length === 0 && (
        <p className="text-sm text-muted-foreground">No competencies yet. Add one above.</p>
      )}
    </div>
  )
}
