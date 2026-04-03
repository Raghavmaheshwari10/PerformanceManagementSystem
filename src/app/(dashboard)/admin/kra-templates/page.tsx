import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { toggleKraTemplateActive, deleteKraTemplate } from './actions'
import { KPI_CATEGORY_LABELS, KPI_CATEGORY_STYLES } from '@/lib/constants'
import { Pencil, Trash2 } from 'lucide-react'

export default async function KraTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  await requireRole(['admin'])
  const { category } = await searchParams

  const templates = await prisma.kraTemplate.findMany({
    where: category ? { category } : undefined,
    include: {
      role_slug: { select: { id: true, label: true } },
      department: { select: { id: true, name: true } },
    },
    orderBy: [{ role_slug_id: 'asc' }, { sort_order: 'asc' }],
  })

  // Group by role
  const grouped = templates.reduce<Record<string, { label: string; items: typeof templates }>>((acc, t) => {
    const key = t.role_slug_id ?? 'unassigned'
    if (!acc[key]) {
      acc[key] = { label: t.role_slug?.label ?? 'Unassigned', items: [] }
    }
    acc[key].items.push(t)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">KRA Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">Key Result Area blueprints by role</p>
        </div>
        <Link href="/admin/kra-templates/new">
          <Button>New Template</Button>
        </Link>
      </div>

      {/* Category filter */}
      <div className="flex gap-2">
        {[
          { value: '', label: 'All' },
          { value: 'performance', label: 'Performance' },
          { value: 'behaviour', label: 'Behaviour' },
          { value: 'learning', label: 'Learning' },
        ].map(opt => (
          <Link key={opt.value} href={opt.value ? `/admin/kra-templates?category=${opt.value}` : '/admin/kra-templates'}>
            <Button variant={category === opt.value || (!category && !opt.value) ? 'default' : 'outline'} size="sm">
              {opt.label}
            </Button>
          </Link>
        ))}
      </div>

      {Object.entries(grouped).map(([key, { label, items }]) => (
        <div key={key} className="glass rounded-lg border overflow-hidden">
          <div className="px-4 py-2 bg-muted/50 border-b">
            <h2 className="font-semibold text-sm">{label}</h2>
          </div>
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="p-3 text-left w-[22%]">Title</th>
                <th className="p-3 text-left w-[12%]">Category</th>
                <th className="p-3 text-left w-[22%]">Description</th>
                <th className="p-3 text-left w-[9%]">Weight</th>
                <th className="p-3 text-left w-[13%]">Department</th>
                <th className="p-3 text-left w-[10%]">Status</th>
                <th className="p-3 text-right w-[12%]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(t => (
                <tr key={t.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium truncate">{t.title}</td>
                  <td className="p-3">
                    <Badge className={KPI_CATEGORY_STYLES[t.category] ?? 'bg-muted text-muted-foreground'}>
                      {KPI_CATEGORY_LABELS[t.category] ?? t.category}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground truncate">{t.description ?? '—'}</td>
                  <td className="p-3 text-muted-foreground">{t.weight != null ? `${t.weight}%` : '—'}</td>
                  <td className="p-3 text-muted-foreground truncate">{t.department?.name ?? '—'}</td>
                  <td className="p-3">
                    <form action={toggleKraTemplateActive.bind(null, t.id, t.is_active) as unknown as (fd: FormData) => Promise<void>}>
                      <button type="submit"
                        className={`text-xs rounded-full px-2 py-0.5 font-medium transition-colors ${t.is_active
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                        {t.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </form>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/admin/kra-templates/${t.id}/edit`}
                        className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                      <form action={deleteKraTemplate.bind(null, t.id) as unknown as (fd: FormData) => Promise<void>}>
                        <button type="submit"
                          className="rounded p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {Object.keys(grouped).length === 0 && (
        <p className="text-muted-foreground text-sm">No templates found.</p>
      )}
    </div>
  )
}
