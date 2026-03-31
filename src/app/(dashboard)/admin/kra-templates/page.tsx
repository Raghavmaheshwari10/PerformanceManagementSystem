import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { toggleKraTemplateActive, deleteKraTemplate } from './actions'
import type { KraTemplate } from '@/lib/types'

const CATEGORY_STYLES: Record<string, string> = {
  performance: 'bg-primary/15 text-primary',
  behaviour: 'bg-amber-500/15 text-amber-400',
  learning: 'bg-emerald-500/15 text-emerald-400',
}

const CATEGORY_LABELS: Record<string, string> = {
  performance: 'Performance',
  behaviour: 'Behaviour',
  learning: 'Learning',
}

export default async function KraTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  await requireRole(['admin'])
  const { category } = await searchParams

  const templates = await prisma.kraTemplate.findMany({
    where: category ? { category } : undefined,
    include: { department: true },
    orderBy: [{ role_slug: 'asc' }, { sort_order: 'asc' }],
  })

  const grouped = (templates as unknown as (KraTemplate & { department?: { name: string } | null })[]).reduce<
    Record<string, (KraTemplate & { department?: { name: string } | null })[]>
  >((acc, t) => {
    const key = t.role_slug ?? 'unassigned'
    acc[key] = [...(acc[key] ?? []), t]
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

      {Object.entries(grouped).map(([slug, items]) => (
        <div key={slug} className="glass rounded-lg border">
          <div className="px-4 py-2 bg-muted/50 border-b">
            <h2 className="font-semibold text-sm capitalize">{slug.replace(/_/g, ' ')}</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="p-3 text-left">Title</th>
                <th className="p-3 text-left">Category</th>
                <th className="p-3 text-left">Description</th>
                <th className="p-3 text-left">Weight</th>
                <th className="p-3 text-left">Department</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(t => (
                <tr key={t.id} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-medium">{t.title}</td>
                  <td className="p-3">
                    <Badge className={CATEGORY_STYLES[t.category] ?? 'bg-muted text-muted-foreground'}>
                      {CATEGORY_LABELS[t.category] ?? t.category}
                    </Badge>
                  </td>
                  <td className="p-3 text-muted-foreground max-w-[200px] truncate">{t.description ?? '—'}</td>
                  <td className="p-3 text-muted-foreground">{t.weight != null ? `${t.weight}%` : '—'}</td>
                  <td className="p-3 text-muted-foreground">{t.department?.name ?? '—'}</td>
                  <td className="p-3">
                    <form action={toggleKraTemplateActive.bind(null, t.id, t.is_active) as unknown as (fd: FormData) => Promise<void>}>
                      <button type="submit"
                        className={`text-xs rounded-full px-2 py-0.5 font-medium ${t.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}>
                        {t.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </form>
                  </td>
                  <td className="p-3 flex gap-2">
                    <Link href={`/admin/kra-templates/${t.id}/edit`} className="text-xs text-primary hover:underline">Edit</Link>
                    <form action={deleteKraTemplate.bind(null, t.id) as unknown as (fd: FormData) => Promise<void>}>
                      <button type="submit" className="text-xs text-destructive hover:underline">Delete</button>
                    </form>
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
