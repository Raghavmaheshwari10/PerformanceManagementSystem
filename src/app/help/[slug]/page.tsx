import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { HELP_ARTICLES } from '@/lib/help-content'
import { ArrowLeft } from 'lucide-react'

const ROLE_COLORS: Record<string, string> = {
  employee: 'bg-blue-100 text-blue-800',
  manager:  'bg-orange-100 text-orange-800',
  hrbp:     'bg-purple-100 text-purple-800',
  admin:    'bg-red-100 text-red-800',
}

interface Props {
  params: Promise<{ slug: string }>
}

export default async function HelpArticlePage({ params }: Props) {
  const { slug } = await params
  const article = HELP_ARTICLES.find((a) => a.slug === slug)

  if (!article) {
    notFound()
  }

  return (
    <div>
      <Link
        href="/help"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft size={14} />
        Back to Help Centre
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-2">{article.title}</h1>
        <p className="text-muted-foreground text-sm mb-3">{article.summary}</p>
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
      </div>

      <div className="rounded-md border bg-muted/20 p-5">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
          {article.body}
        </pre>
      </div>
    </div>
  )
}

export function generateStaticParams() {
  return HELP_ARTICLES.map((a) => ({ slug: a.slug }))
}
