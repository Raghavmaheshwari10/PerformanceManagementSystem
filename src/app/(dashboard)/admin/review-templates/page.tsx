import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { TemplateQuestionForm } from './template-question-form'
import { CreateTemplateForm } from './create-template-form'
import { deleteReviewTemplate } from './actions'
import type { Competency } from '@/lib/types'

export default async function ReviewTemplatesPage() {
  await requireRole(['admin', 'hrbp'])

  const [templates, competencies] = await Promise.all([
    prisma.reviewTemplate.findMany({
      include: { questions: { orderBy: { order_index: 'asc' } } },
      orderBy: { created_at: 'desc' },
    }),
    prisma.competency.findMany({ orderBy: { name: 'asc' } }),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Review Templates</h1>

      {/* Create new template form */}
      <section className="rounded border p-4 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">New Template</h2>
        <CreateTemplateForm />
      </section>

      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No templates yet.</p>
      ) : (
        <div className="space-y-4">
          {templates.map(t => (
            <section key={t.id} className="rounded border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">{t.name}</h2>
                  {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                </div>
                <form action={deleteReviewTemplate.bind(null, t.id)}>
                  <button type="submit" className="text-xs text-destructive hover:underline">Delete</button>
                </form>
              </div>

              {t.questions.length > 0 && (
                <ol className="space-y-1 text-sm">
                  {t.questions.map((q, i) => (
                    <li key={q.id} className="flex items-start gap-2 text-sm">
                      <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                      <span className="flex-1">{q.question_text}</span>
                      <span className="text-xs text-muted-foreground capitalize shrink-0">{q.answer_type}</span>
                    </li>
                  ))}
                </ol>
              )}

              <TemplateQuestionForm
                templateId={t.id}
                competencies={competencies as unknown as Competency[]}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
