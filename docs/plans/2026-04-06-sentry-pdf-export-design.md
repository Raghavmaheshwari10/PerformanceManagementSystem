# Design: Sentry Error Monitoring + PDF Appraisal Export

**Date:** 2026-04-06
**Status:** Approved
**Stack:** Next.js 16, React 19, TypeScript, Prisma 7, NeonDB, Vercel

---

## Feature 1: Sentry Error Monitoring

### Goal
Capture all unhandled errors (client + server), server action failures, and performance issues in production. Attach user context to every event so bugs are traceable to specific users and roles.

### Approach
`@sentry/nextjs` official SDK with automatic instrumentation.

### Files to create/modify
- `sentry.client.config.ts` — browser error capture, user context
- `sentry.server.config.ts` — Node.js error capture, performance tracing
- `sentry.edge.config.ts` — middleware/edge error capture
- `next.config.ts` — wrap with `withSentryConfig()` for source maps
- `.env.local` — add `SENTRY_DSN` (user pastes from sentry.io)
- `src/app/global-error.tsx` — Sentry-aware root error boundary
- `src/lib/sentry.ts` — helper `captureServerActionError()` for manual instrumentation

### Automatic capture (zero config)
- All unhandled client JS errors
- All unhandled server/API errors
- Performance: slow pages, slow server actions

### Manual instrumentation (critical paths)
- CSV / Google Sheets import failures
- Zimyo sync errors
- MIS sync errors
- Payout calculation errors
- Email send failures (invite, reset, notifications)

### User context
Every Sentry event tagged with `user.id`, `user.email`, `user.role` via `Sentry.setUser()` in the dashboard layout.

### Environment
- `SENTRY_DSN` — from sentry.io project settings
- `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` — for source map upload on build

---

## Feature 2: PDF Appraisal Export

### Goal
Allow employees to download their own appraisal PDF after results are published. Allow HRBP and Admin to export any employee's appraisal PDF from the payouts page.

### Approach
`@react-pdf/renderer` — server-side PDF generation, serverless-safe, no headless browser needed.

### Access control
| Role | Can download |
|------|-------------|
| Employee | Own appraisal only (cycle must be `published`) |
| HRBP | Any employee in their departments |
| Admin | Any employee, any cycle |

### API route
`GET /api/pdf/appraisal?cycleId=X&employeeId=Y`
- Authenticates via `getCurrentUser()`
- Enforces role-based access
- Fetches full appraisal data (KRAs, KPIs, reviews, competencies, payout)
- Renders with `@react-pdf/renderer`
- Returns `application/pdf` with filename `appraisal-{name}-{cycle}.pdf`

### PDF layout (portrait A4)
```
Header:    Logo | "Performance Appraisal" | Cycle name | Department
Employee:  Full name | Designation | Manager name | Date generated
─────────────────────────────────────────────────────────────────
KRA/KPI:   Per KRA: name + weight
           Per KPI: title | target | self-rating | manager-rating | score
─────────────────────────────────────────────────────────────────
Competencies: Category | Name | Proficiency level | Manager rating
─────────────────────────────────────────────────────────────────
Final:     Composite score | Rating tier | Variable pay | Multiplier | Payout
Footer:    "Confidential" | Generated timestamp
```

### UI entry points
- **Employee dashboard** — "Download Appraisal" button, visible only when cycle is `published`
- **HRBP Payouts page** — download icon per employee row
- **Admin Payouts page** — download icon per employee row

### Reusable component
`src/components/download-appraisal-button.tsx` — client component, opens PDF in new tab via `/api/pdf/appraisal?...`

### New files
- `src/app/api/pdf/appraisal/route.ts` — API route (auth + data fetch + render)
- `src/components/pdf/appraisal-document.tsx` — `@react-pdf/renderer` document component
- `src/components/download-appraisal-button.tsx` — reusable download button
