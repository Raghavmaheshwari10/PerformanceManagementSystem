# PMS Comprehensive Execution Plan

> Created: 2026-03-01 | Merges: 05-comprehensive-improvement-plan.md + 06-additions-plan.md
> Status: 06-additions-plan.md ✅ COMPLETE | Executing 05 phases below

---

## What Was Completed (06-additions-plan.md)

All 6 additions fully implemented and tested (51/51 tests pass):

| # | Feature | Migration | Status |
|---|---------|-----------|--------|
| 1 | FEE/EE multiplier fix | 00006 (updated) | ✅ Done |
| 2 | KPI Templates (10 roles, 54 seeds) | 00009 | ✅ Done |
| 3 | Help Centre (5 articles, /help route) | — | ✅ Done |
| 4 | Command Palette (cmdk, frecency, role-filtered) | — | ✅ Done |
| 5 | Google OAuth (button, not-provisioned page, auth hook, config) | 00010 | ✅ Done |
| 6 | Budget/payout fields (business_multiplier, snapshotted_variable_pay, Zimyo independence) | 00011, 00012 | ✅ Done |

**Pending DB action:** Paste `docs/audit/all_migrations_00008_to_00012.sql` into Supabase SQL Editor at https://supabase.com/dashboard/project/cekmehtfghzhnzmxjbcx/sql

---

## Phase 0: Critical Quick Wins

*Effort: ~1.5 hours | Do immediately*

| # | Task | File(s) | Status |
|---|------|---------|--------|
| 0.1 | Fix FEE multiplier = 0 | `constants.ts` (fixed: 1.25), migration 00006 | ✅ Already done |
| 0.2 | Add `is_active` to RLS SELECT policies | `00013_is_active_rls.sql` | 🔲 TODO |
| 0.3 | Add logout button to sidebar | `sidebar.tsx` | 🔲 TODO |
| 0.4 | Add prefers-reduced-motion CSS | `globals.css` | 🔲 TODO |

---

## Phase 1: Foundation Layer

*Effort: ~12 hours | Enables everything else*

### 1.1 Feature Flag System
- **Migration:** `00014_feature_flags.sql` — tables: `feature_flags`, `feature_flag_overrides` (org/role/user), resolve function
- **Server util:** `src/lib/feature-flags.ts` — `getFeatureFlags(userId, role)` for server components
- **Client hook:** `src/hooks/use-feature-flag.ts` — `useFeatureFlag(key)` consuming context
- **Admin UI:** `/admin/feature-flags` — category tabs (Modules / UI / Notifications), toggle switches
- **Seed flags:** `module.gamification`, `module.360_feedback`, `module.continuous_feedback`, `ui.compact_mode`, `ui.density`, `notify.email`, `notify.in_app`

### 1.2 Auto-Save Infrastructure
- **Migration:** `00015_drafts.sql` — `drafts` table (user_id, entity_type, entity_id, form_data jsonb, updated_at)
- **Hook:** `src/hooks/use-auto-save.ts` — debounced save (2s), status: "Saving..." / "Saved Xs ago" / "Save failed [Retry]"
- **Server action:** `src/app/(dashboard)/actions/drafts.ts` — `saveDraft`, `loadDraft`, `clearDraft`
- **Apply to:** self-review form, manager review form

### 1.3 Notification System Upgrade
- **Migration:** `00016_notification_upgrade.sql` — add `snoozed_until`, `dismissed_at` to notifications; add `notification_preferences` table
- **Component:** `src/components/notification-bell.tsx` — bell icon with unread count badge, dropdown
- **Actions:** snoozeNotification, dismissNotification, markAllRead
- **Add to layout:** notification bell in dashboard header/sidebar

### 1.4 Configurable Rating Scales
- **Migration:** `00017_rating_scales.sql` — `rating_scales`, `rating_scale_levels` tables
- **Admin UI:** `/admin/rating-scales` — manage scales, levels, enable/disable tiers
- **Server util:** `src/lib/rating-scales.ts` — replace `RATING_TIERS` constant with DB-driven lookup

---

## Phase 2: Employee Experience Overhaul

*Effort: ~20 hours*

### 2.1 Action Inbox / NBA Dashboard
- Replace flat employee page with 3-zone layout
- Zone 1: ONE primary action (color-coded urgency), 0-2 secondary
- Zone 2: KPI progress bars (L) + cycle timeline stepper (R)
- Zone 3: Activity feed (check-ins, kudos)
- NBA logic: deadline-driven > incomplete actions > relationship actions > informational > all-clear

### 2.2 Wizard Stepper Self-Review
- 4 steps: Key Achievements → Challenges & Growth → Overall Rating → Review & Submit
- Sentence starters as clickable chips
- Reference panel: previous cycle's review (collapsible)
- Auto-save on each step via drafts infrastructure

### 2.3 KPI Copy-Forward
- "Suggested from Q1 2026" panel on KPI setting page
- Checkboxes to carry forward, Edit/Remove per KPI
- Visual "carried forward" badge on copied KPIs

### 2.4 Employee History Enhancement
- Rating trend chart across cycles
- Expandable rows with full KPI/comment detail
- Compensation transparency card (after publication)

### 2.5 Density Toggle
- CSS custom properties for comfortable (default) vs compact mode
- Toggle in sidebar footer → localStorage → `data-density` on `<html>`
- Comfortable: 48px rows, 16px gap | Compact: 36px rows, 8px gap

---

## Phase 3: Manager Experience

*Effort: ~15 hours*

### 3.1 Side-by-Side Review Layout
- Employee self-review (read-only, scrollable left pane)
- Manager form (editable right pane)
- Eliminates tab-switching and context loss

### 3.2 Rating Pill Selectors
- Replace `<select>` dropdowns with horizontal pill buttons
- 1-click selection vs 2-click dropdown
- ARIA `role="radiogroup"`, roving tabindex for keyboard nav
- Selected pill: filled primary color

### 3.3 Per-KPI Ratings
- **Migration:** `00018_kpi_ratings.sql` — `kpi_ratings` table (kpi_id, rater_id, rater_type, rating, comments)
- Employee rates each KPI during self-review
- Manager rates each KPI during manager review
- Overall = weighted average, auto-mapped to rating tier

### 3.4 Manager Team Dashboard
- Per-employee status cards (name, status badge, days to/past deadline)
- Filter by: Not Started / In Progress / Submitted / Overdue
- NBA prompt after each review completion

---

## Phase 4: Admin & HRBP Dashboards

*Effort: ~15 hours*

### 4.1 Progress Dashboard
- Tier 1: Progress ring, rating distribution bell curve, overdue count
- Tier 2: Department breakdown, per-manager completion
- Tier 3: Employee slide-over panel

### 4.2 Rating Distribution with Target Overlay
- Soft targets per rating (FEE 5%, EE 20%, SME 50%, ME 20%, BE 5%)
- Blue bars = within guideline, orange = outside
- Configurable per cycle

### 4.3 Data Quality Dashboard
- **Migration:** `00019_data_quality.sql` — materialized view `data_quality_issues`
- Issue cards: Missing Managers, Orphaned, Self-Managed, Missing Departments
- Inline action buttons per issue

### 4.4 Calibration Bin View
- Horizontal buckets per rating level
- Drag employee cards between bins
- Drag = justification prompt + audit log entry

### 4.5 Overdue Alert Bar
- Persistent red bar at top of admin/HRBP dashboard
- "N reviews overdue | X in Dept A, Y in Dept B | Deadline was [date] | [View overdue]"

---

## Phase 5: Data Integration

*Effort: ~20 hours*

### 5.1 Enhanced CSV Import Pipeline
- 5-step flow: Upload → Map Columns → Validate → Preview → Commit
- Drag-and-drop zone, .csv/.xlsx support
- Inline error table for validation failures
- Download failed rows as CSV with error column appended
- **Migration:** `00020_import_jobs.sql` — `import_jobs`, `import_rows` tables

### 5.2 CRM Data Integration (Optional add-on)
- `data_sources`, `user_identity_map`, `crm_deals`, `crm_activities`, `metric_snapshots`, `webhook_events`
- Metric snapshots frozen at cycle lock

### 5.3 Self-Service Data Correction
- Employee/manager submits correction request
- Admin approves/rejects
- `data_change_requests`, `editable_fields` tables

---

## Phase 6: Advanced Features

*Effort: ~40+ hours | All behind feature flags*

| Feature | Flag | Migration |
|---------|------|-----------|
| Continuous feedback / check-ins | `module.continuous_feedback` | `check_ins`, `feedback` |
| Peer kudos | `module.kudos` | `feedback` (type=kudos) |
| 360-degree feedback | `module.360_feedback` | `feedback_requests`, `feedback_responses` |
| Review templates | `module.templates` | `review_templates`, `template_sections`, `template_questions` |
| AI review assistant (Claude API) | `module.ai_assist` | — |
| Impersonation / view-as | admin only | `impersonation_sessions` |
| Budget pool + what-if simulator | — | Already added in 00012 |
| Gamification | `module.gamification` | — |
| PWA + offline | — | `manifest.json`, service worker |

---

## Migration Index

| Migration | Description | Status |
|-----------|-------------|--------|
| 00001–00007 | Core schema, auth, RLS, notifications, integrity | ✅ Applied |
| 00008 | Audit log improvements | ⬜ Needs SQL Editor paste |
| 00009 | KPI templates (10 roles, 54 seeds) | ⬜ Needs SQL Editor paste |
| 00010 | Google domain hook | ⬜ Needs SQL Editor paste |
| 00011 | Zimyo independence (optional zimyo_id, data_source) | ⬜ Needs SQL Editor paste |
| 00012 | Budget/payout fields (business_multiplier, snapshotted_variable_pay) | ⬜ Needs SQL Editor paste |
| **00013** | **is_active RLS security fix** | 🔲 TODO |
| **00014** | **Feature flags** | 🔲 TODO |
| **00015** | **Drafts (auto-save)** | 🔲 TODO |
| **00016** | **Notification upgrade (snooze, dismiss, preferences)** | 🔲 TODO |
| **00017** | **Configurable rating scales** | 🔲 TODO |
| **00018** | **Per-KPI ratings** | 🔲 TODO |
| **00019** | **Data quality materialized view** | 🔲 TODO |
| **00020** | **Enhanced import jobs** | 🔲 TODO |

---

## DB Connection Note

Supabase is cloud-hosted (project: cekmehtfghzhnzmxjbcx). Direct DB is IPv6-only (unreachable from Windows). Use Supabase SQL Editor to apply migrations manually.

All pending migrations will be written to `supabase/migrations/` and also collected into a combined file at `docs/audit/` for easy paste.
