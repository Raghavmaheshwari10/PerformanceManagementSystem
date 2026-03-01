# PMS Additions — Implementation Progress

**Started:** 2026-03-01
**Status:** In-progress — migrations + UI being written by parallel agents

---

## Overall Progress

| Feature | Migration | UI / Server Action | Tests | Status |
|---------|-----------|-------------------|-------|--------|
| FEE/EE bug fix | 00008 | n/a | constants.test.ts (existing) | ⏳ Migration writing |
| KPI Templates | 00009 | kpi-template-picker.tsx + template-actions.ts | help-content.test.ts | ⏳ Both writing |
| Google OAuth domain hook | 00010 | login page + callback + not-provisioned | — | ✅ Auth done |
| Zimyo independence | 00011 | admin users form | — | ⏳ Migration writing |
| Budget + payout | 00012 | cycle-form.tsx + payout-breakdown.tsx | — | ⏳ Both writing |
| Help system | none | help-content.ts + /help/* + help components | help-content.test.ts | ⏳ UI writing |
| Command palette | none (cmdk installed) | command-palette/* + frecency hook | frecency.test.ts | ✅ Done |
| Sidebar + layout | none | sidebar.tsx + (dashboard)/layout.tsx | — | ⏳ Writing |
| Config (Google OAuth) | none | supabase/config.toml | — | ✅ Done |

---

## Agent IDs (for context recovery)

| Agent | Task | Status |
|-------|------|--------|
| a57e03f18e1b1b340 | Migrations 00008–00012 | ⏳ Running |
| a3b84fecf2d97a892 | Help UI + /help route | ⏳ Running |
| af88d4794b2fa4648 | Command palette (cmdk) | ✅ Completed |
| aeabe181fda499758 | Auth (login + callback + config.toml) | ✅ Completed |
| a40be467154e51f29 | Types + actions + forms + sidebar + layout | ⏳ Running |

---

## Files Created / Modified

### New Files
- `supabase/migrations/00008_fix_multipliers.sql` — ⏳
- `supabase/migrations/00009_kpi_templates.sql` — ⏳
- `supabase/migrations/00010_google_domain_hook.sql` — ⏳
- `supabase/migrations/00011_zimyo_independence.sql` — ⏳
- `supabase/migrations/00012_budget_fields.sql` — ⏳
- `src/components/help-tooltip.tsx` — ⏳
- `src/components/help-drawer.tsx` — ⏳
- `src/components/cycle-stage-banner.tsx` — ⏳
- `src/components/cycle-action-card.tsx` — ⏳
- `src/components/payout-breakdown.tsx` — ⏳
- `src/components/kpi-template-picker.tsx` — ⏳
- `src/components/command-palette/index.tsx` — ✅
- `src/components/command-palette/command-palette.tsx` — ✅
- `src/components/command-palette/commands.ts` — ✅
- `src/components/command-palette-trigger.tsx` — ✅
- `src/hooks/use-frecency.ts` — ✅
- `src/lib/help-content.ts` — ⏳
- `src/app/help/page.tsx` — ⏳
- `src/app/help/layout.tsx` — ⏳
- `src/app/help/[slug]/page.tsx` — ⏳
- `src/app/auth/not-provisioned/page.tsx` — ✅
- `src/app/(dashboard)/manager/template-actions.ts` — ⏳
- `src/lib/__tests__/help-content.test.ts` — ✅
- `src/lib/__tests__/frecency.test.ts` — ✅

### Modified Files
- `src/lib/types.ts` — add KpiTemplate, snapshotted_variable_pay, budget fields, data_source — ⏳
- `src/app/(dashboard)/admin/actions.ts` — budget fields in createCycle — ⏳
- `src/app/(dashboard)/admin/cycles/new/cycle-form.tsx` — budget fields — ⏳
- `src/app/(dashboard)/manager/[employeeId]/kpis/page.tsx` — KpiTemplatePicker — ⏳
- `src/app/(dashboard)/employee/page.tsx` — PayoutBreakdown — ⏳
- `src/components/sidebar.tsx` — Help link + CommandPaletteTrigger — ⏳
- `src/app/(dashboard)/layout.tsx` — CommandPaletteProvider — ⏳
- `src/app/login/page.tsx` — Google OAuth button — ✅
- `src/app/auth/callback/route.ts` — not-provisioned redirect — ✅
- `supabase/config.toml` — Google OAuth + before_user_created hook — ✅

---

## Pending Steps (after agents finish)

1. **Verify all files written correctly** — TypeScript check
   ```
   cd "C:\Users\tejas\OneDrive\Development Projects\PMS"
   npx tsc --noEmit
   ```

2. **Run DB reset** (applies all migrations 00008–00012)
   ```
   npx supabase db reset
   ```

3. **Run all tests**
   ```
   npx vitest run
   ```
   Expected: 41 existing + ~10 new = ~51 tests pass

4. **Start dev server + visual check**
   ```
   npm run dev
   ```
   Check:
   - `/login` — Google button visible
   - `/employee` — KPI template, action card, payout breakdown
   - `/help` — help centre grid, article pages
   - `Ctrl+K` — command palette opens
   - `/admin/cycles/new` — business_multiplier + budget fields

5. **Fix any TypeScript or runtime errors found**

---

## Known Constraints / Notes

- `cmdk` and `fuse.js` — installed by agent af88d4794b2fa4648
- Google OAuth requires `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` in `.env.local` to work at runtime. The config.toml already has the `env()` references. For local dev testing, use the password login test accounts — Google button will just error gracefully.
- `before_user_created_hook` in config.toml points to `public.before_user_created_hook` which is created by migration 00010.
- Migration 00012 re-creates `bulk_lock_appraisals` again (third time: 00006 original, 00008 FEE/EE fix, 00012 adds snapshotted_variable_pay + business_multiplier). This is fine — `CREATE OR REPLACE FUNCTION` is idempotent.
- `CycleActionCard` and `PayoutBreakdown` components are created but not yet wired into every dashboard page — that can be a follow-up enhancement. The core data fetching in employee/page.tsx already has the appraisal data needed.
- KPI template admin CRUD page (`/admin/kpi-templates`) is noted in the command palette commands but the page itself is a future addition — admins can manage templates via Supabase Studio for now.

---

## SQL Bug Confirmed (both sides verified)

| Side | FEE | EE |
|------|-----|----|
| `constants.ts` (TypeScript) | 1.25 ✅ | 1.10 ✅ |
| `00006` SQL (original) | **0** ❌ | **1.5** ❌ |
| `00008` SQL (fix) | 1.25 ✅ | 1.10 ✅ |
