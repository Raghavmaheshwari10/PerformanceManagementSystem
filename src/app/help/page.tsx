import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { HELP_ARTICLES } from '@/lib/help-content'

const ROLE_COLORS: Record<string, string> = {
  employee: 'bg-blue-100 text-blue-800',
  manager:  'bg-orange-100 text-orange-800',
  hrbp:     'bg-purple-100 text-purple-800',
  admin:    'bg-red-100 text-red-800',
}

export default function HelpPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Help Centre</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Guides and explanations for using the Performance Management System.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {HELP_ARTICLES.map((article) => (
          <Link
            key={article.slug}
            href={`/help/${article.slug}`}
            className="block rounded-lg border bg-card p-5 shadow-sm hover:shadow-md hover:border-foreground/20 transition-all"
          >
            <h2 className="font-semibold text-base mb-1">{article.title}</h2>
            <p className="text-sm text-muted-foreground mb-3">{article.summary}</p>
            <div className="flex flex-wrap gap-1.5">
              {article.roles.map((role) => (
                <Badge
                  key={role}
                  className={`text-xs ${ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-700'}`}
                >
                  {role}
                </Badge>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
