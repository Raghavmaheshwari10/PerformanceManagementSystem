# PMS Comprehensive Improvement Plan

> Compiled: 2026-03-01 | Based on: 4 audit docs, 2 ADHD-friendly design PDFs, research across Lattice/15Five/Culture Amp/Leapsome/SAP SuccessFactors/Betterworks/Workday

---

## Table of Contents

1. [Gap Analysis: Current App vs Vision](#1-gap-analysis)
2. [Phase 0: Critical Bug Fixes](#2-phase-0-critical-bug-fixes)
3. [Phase 1: Foundation Layer](#3-phase-1-foundation-layer)
4. [Phase 2: Employee Experience Overhaul](#4-phase-2-employee-experience)
5. [Phase 3: Manager Experience](#5-phase-3-manager-experience)
6. [Phase 4: Admin & HRBP Dashboards](#6-phase-4-admin-hrbp-dashboards)
7. [Phase 5: Data Integration & CRM Layer](#7-phase-5-data-integration)
8. [Phase 6: Advanced Features](#8-phase-6-advanced-features)
9. [Database Schema Additions](#9-database-schema-additions)
10. [Implementation Sequence](#10-implementation-sequence)

---

## 1. Gap Analysis

### Current State (7 tables, 4 roles, 7-stage cycle)

| Area | What Exists | What's Missing |
|------|------------|----------------|
| **Employee UX** | Single page: KPI list + single textarea review + final result | Action inbox, wizard stepper, auto-save, KPI progress bars, sentence starters, history trends, cycle timeline |
| **Manager UX** | Separate KPI/review pages per employee | Side-by-side review layout, per-KPI ratings, AI suggestions, team dashboard with completion tracking |
| **Admin/HRBP** | Cycle list, bell curve chart, rating overrides, audit log | Progress rings, completion by department, data quality dashboard, feature flags, configurable rating scales |
| **Notifications** | Table exists, edge function sender built | No reminders, no escalation, no snooze, no in-app notification center, no user preferences |
| **Data Import** | Zimyo API sync + CSV upload with summary | No column mapping, no error preview, no template download, no CRM integration, no data quality checks |
| **Compensation** | Fixed multipliers (FEE=0 bug), variable_pay x multiplier | No configurable multipliers per cycle, no business multiplier, no budget tracking, no merit matrix |
| **Feedback** | None (formal reviews only) | No check-ins, no peer kudos, no continuous feedback, no 360 |
| **Accessibility** | None specific | No prefers-reduced-motion, no density toggle, no keyboard shortcuts |
| **Mobile** | Responsive via Tailwind (not optimized) | No PWA, no offline support, no bottom nav, no quick-capture |

### ADHD-Friendly Design Principles (from PDFs)

The two reference PDFs establish these core principles for the PMS:

1. **Progressive disclosure**: Show basics first, reveal advanced on demand
2. **Next Best Action**: Tell the user exactly what to do next
3. **Recognition over recall**: Pre-fill forms, show previous data, provide sentence starters
4. **Reduce cognitive load**: One primary action visible, wizard steppers, auto-save
5. **Escalating urgency**: Gentle reminders far from deadline, urgent only when needed
6. **Configurable density**: Compact mode for power users, comfortable for everyone else
7. **prefers-reduced-motion**: Respect OS-level animation preferences

---

## 2. Phase 0: Critical Bug Fixes

*Effort: ~2 hours | Do immediately*

### 0.1 Fix FEE Multiplier = 0

"Far Exceeds Expectations" currently pays $0, same as "Below Expectations."

**Files to change:**
- `supabase/migrations/00006_integrity_and_indexes.sql` -- `bulk_lock_appraisals()` PL/pgSQL: FEE case should return 1.25
- `src/lib/constants.ts` -- `RATING_TIERS` FEE `fixedMultiplier` should be 1.25

### 0.2 Add is_active Check to RLS

Soft-deleted users can currently still access data.

**Change:** Add `AND (SELECT is_active FROM users WHERE id = public.user_id()) = true` to all SELECT policies that reference `user_id()`.

### 0.3 Add Logout Button

Currently missing from the sidebar. Add a sign-out action to `src/components/sidebar.tsx`.

### 0.4 Add prefers-reduced-motion Global CSS

Add to `src/app/globals.css`:

```css
@layer base {
  @media (prefers-reduced-motion: reduce) {
    *, ::before, ::after {
      animation-duration: 1ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 1ms !important;
      scroll-behavior: auto !important;
    }
  }
}
```

---

## 3. Phase 1: Foundation Layer

*Effort: ~12 hours | Enables everything else*

### 1.1 Feature Flag System

A three-layer cascade: Organization Default -> Role Override -> User Preference. This enables progressive rollout of all subsequent features.

**New tables:** `feature_flags`, `feature_flag_org_overrides`, `feature_flag_role_overrides`, `feature_flag_user_prefs`

**Resolution function:** `resolve_feature_flag(flag_key, user_id, user_role)` walks up the chain until it finds a non-null value.

**Client-side:** `FeatureFlagProvider` context + `useFeatureFlag(key)` hook.

**Seed flags:**
- `module.gamification`, `module.360_feedback`, `module.continuous_feedback` (off by default)
- `ui.compact_mode`, `ui.reduce_motion`, `ui.keyboard_shortcuts` (user-configurable)
- `notify.email`, `notify.in_app` (on by default)

**Admin UI:** Feature Configuration page with category tabs (Modules / UI Controls / Notifications), toggle switches, role-level overrides as expandable sub-items.

### 1.2 Configurable Rating Scales

Replace hardcoded `RATING_TIERS` with database-driven scales.

**New tables:** `rating_scales`, `rating_scale_levels`

Each level has: `value` (numeric), `label`, `short_label`, `color`, `multiplier`, `is_enabled`, `sort_order`.

**Key benefit:** Admin can disable a tier (e.g., remove "SME") without code changes. Historical data remains valid. Multipliers become per-cycle configurable.

**Eliminates:** Duplication between PL/pgSQL function and TypeScript constants.

### 1.3 Auto-Save Infrastructure

**New table:** `drafts` (user_id, entity_type, entity_id, form_data jsonb, updated_at)

**Client hook:** `useAutoSave(formData, saveFn, delay=2000)` with debounced save and status indicator ("Saving..." / "Saved 3s ago" / "Save failed [Retry]").

**Applies to:** Self-review form, manager review form, KPI editing, check-ins.

### 1.4 Notification System Upgrade

**New tables:** `notification_types` (key, name, category, default_enabled, supports_channels, is_user_overridable), `notification_settings` (org-level per-type config with timing/repeat), `notification_preferences` (user-level overrides)

**Schema changes to existing `notifications`:** Add `snoozed_until`, `dismissed_at` columns.

**In-app notification center:** Bell icon in nav bar with unread count badge. Dropdown shows notification cards with: title, timestamp, action link, snooze/dismiss buttons.

**Escalation pattern:**
| Days Before | Tone | Channel |
|-------------|------|---------|
| 7+ | Gentle | In-app badge only |
| 3-5 | Firm | In-app + email digest |
| 1-2 | Urgent | In-app banner + direct email |
| 0 | Final | All channels |
| Overdue | Escalate | Notify manager + persistent banner |

---

## 4. Phase 2: Employee Experience Overhaul

*Effort: ~20 hours | Biggest UX impact*

### 2.1 Action Inbox / Next Best Action Dashboard

Replace the current flat employee page with a three-zone dashboard:

**Zone 1 -- Action Inbox (top, full width):**
- ONE primary action with prominent CTA (color-coded by urgency: blue/amber/red)
- 0-2 secondary actions below, visually quieter
- "All caught up" state with checkmark when nothing pending

**Zone 2 -- Two-column content:**
- Left: KPI progress bars (horizontal, color-coded: green >=70%, amber 40-69%, red <40%)
- Right: Cycle timeline stepper (vertical, past=gray checkmark, current=blue highlight, future=gray)

**Zone 3 -- Activity Feed:**
- Chronological feed of manager notes, kudos received, check-in submissions
- From the `feedback` and `check_ins` tables (Phase 5)

**NBA decision logic:**
```
Priority 1: Deadline-driven (self-review due soon)
Priority 2: Incomplete required actions (KPIs not acknowledged)
Priority 3: Relationship actions (peer feedback requested)
Priority 4: Informational (results published)
Priority 5: Nothing to do ("all caught up")
```

### 2.2 Wizard Stepper Self-Review

Replace single textarea with a 3-4 step wizard:

**Step 1: Key Achievements** -- One text field per KPI with the KPI title, weight, and sentence starters as clickable chips ("I achieved...", "I improved [metric] from [X] to [Y] by...", "I took initiative to...")

**Step 2: Challenges & Growth** -- Prompts: "One challenge I overcame was...", "I learned that...", "With more support in [area], I could..."

**Step 3: Overall Rating & Summary** -- Self-rating dropdown with tier descriptions shown inline, plus short summary field.

**Step 4: Review & Submit** -- Read-only summary of all answers with Edit links back to each section.

**Reference panel (collapsible):** "Last cycle you wrote: [previous self-review text]. Manager feedback: [previous manager comments]"

### 2.3 KPI Copy-Forward

When a new cycle opens for KPI setting:
- Show previous cycle's KPIs in a "Suggested from Q1 2026" panel
- Each has a checkbox to carry forward, with Edit/Remove buttons
- Carried-forward KPIs get a visual badge
- Weights are editable before saving

### 2.4 Employee History Enhancement

Upgrade `/employee/history` with:
- Rating trend chart across cycles (line or bar)
- Expandable rows: click to show self-rating, manager rating, comments, KPIs, payout
- Trend indicator arrows (up/down/same vs previous cycle)
- Compensation transparency card (after publication): final rating, multiplier, variable pay base, payout amount, "How this was calculated" explainer

### 2.5 Density Toggle

CSS custom properties for comfortable (default) vs compact mode:
- Comfortable: 48px row height, 16px gap, 15px body font
- Compact: 36px row height, 8px gap, 13px body font
- Toggle in sidebar footer, stored in localStorage, applied via `data-density` attribute on root

---

## 5. Phase 3: Manager Experience

*Effort: ~15 hours*

### 3.1 Side-by-Side Review Layout

Employee's self-review on the left (read-only, scrollable) + manager's assessment form on the right (editable). Eliminates tab-switching and context loss.

Per-KPI sections showing: employee's self-rating, evidence text, and peer feedback (collapsed) on the left. Manager's rating pill selector, comment textarea, and calibration note on the right.

### 3.2 Rating Pill Selectors

Replace dropdown selects with horizontal pill buttons for ratings. Faster interaction (1 click vs 2). Selected pill gets filled primary color. ARIA `role="radiogroup"` with roving tabindex for keyboard navigation.

### 3.3 Per-KPI Ratings

**New table:** `kpi_ratings` (kpi_id, cycle_id, employee_id, rater_id, rater_type, rating, comments)

Employee rates each KPI during self-review. Manager rates each KPI during manager review. Overall rating = weighted average (auto-calculated from `kpi_weight x kpi_rating_value`).

Score-to-rating mapping:
| Score Range | Rating |
|-------------|--------|
| 4.5 - 5.0 | FEE |
| 3.5 - 4.49 | EE |
| 2.5 - 3.49 | SME |
| 1.5 - 2.49 | ME |
| 1.0 - 1.49 | BE |

### 3.4 Manager Team Dashboard

Replace current team overview with completion tracking:
- Per-employee status cards with: name, review status badge, days until/past deadline
- Filterable by status (Not Started / In Progress / Submitted / Overdue)
- "Next Best Action" prompts after submitting a review ("Review Dave Martinez -- 2 of 6 remaining")

### 3.5 AI Comment Suggestions (Phase 6 dependency)

Behind `module.ai_assist` feature flag. Manager clicks "Suggest comment" next to a KPI. System generates draft from: KPI target vs achieved, self-review text, peer feedback, prior cycle data. Draft appears with AI styling that disappears on first keystroke.

---

## 6. Phase 4: Admin & HRBP Dashboards

*Effort: ~15 hours*

### 4.1 Progress Dashboard (Overview First)

Three-tier layout following Shneiderman's mantra:

**Tier 1 -- Overview:** Progress ring (% complete with count), rating distribution bell curve with target overlay, overdue alert count. Completion by department as horizontal bar charts.

**Tier 2 -- Filter:** Click department to drill down. Per-manager breakdown showing employee completion status. Filterable by Overdue/Not Started/Submitted.

**Tier 3 -- Detail:** Click employee row for slide-over panel with full review, ratings, comments, audit trail.

### 4.2 Rating Distribution with Targets

Soft distribution targets (configurable per cycle):
| Rating | Target % | Allowed Range |
|--------|----------|---------------|
| FEE | 5% | 0-10% |
| EE | 20% | 10-30% |
| SME | 50% | 35-65% |
| ME | 20% | 10-30% |
| BE | 5% | 0-10% |

Show actual vs target on calibration page. Warn (don't block) when distribution deviates beyond allowed range. Blue bars = within guideline, orange bars = outside.

### 4.3 Data Quality Dashboard

**New materialized view:** `data_quality_issues` -- surfaces: missing managers, orphaned managers (manager is inactive), missing departments, self-managed users, circular reporting chains.

**UI:** Issue count cards at top (Missing Managers: 3, Orphaned: 1, etc.). Critical issues list below with inline action buttons (Assign / Reassign / Set). "Resolve before next cycle" grouping.

### 4.4 Calibration Enhancement: Bin View

Since the current model has a single performance axis (no potential rating), use a **Bin View**: horizontal buckets for each rating level with employee cards that can be dragged between bins. Drag triggers justification prompt + audit log entry.

### 4.5 Overdue Alert Bar

Persistent red bar at top of admin/HRBP dashboard (not a toast):
```
3 reviews overdue | 2 in Sales, 1 in Ops | Deadline was Feb 28 | [View overdue]
```

---

## 7. Phase 5: Data Integration & CRM Layer

*Effort: ~20 hours*

### 5.1 Enhanced CSV Import Pipeline

Five-step import flow: Upload -> Map Columns -> Validate -> Preview -> Commit.

**Upload:** Drag-and-drop zone + file input. Accept .csv and .xlsx. Downloadable template with headers and example row.

**Map Columns:** Auto-detect common headers. Manual mapping UI: two-column table showing CSV headers on left, PMS fields on right (dropdown). Remember mappings for future uploads.

**Validate:** Parse all rows, collect errors. Show inline error table (row#, column, value, error message). Download failed rows as CSV with appended error column.

**Preview:** Reconciliation summary: "Will create: 5, Will update: 3, Will skip: 2". Expandable sections showing each category with row details.

**Commit:** Apply changes with audit logging. Show final summary.

**New tables:** `import_jobs`, `import_rows`

### 5.2 CRM Data Integration (Optional)

For organizations that want to plug in deal/activity data from CRMs:

**New tables:** `data_sources` (source_name, source_type, credentials, sync config), `user_identity_map` (PMS user -> external user ID mapping), `crm_deals` (deal_id, owner_user_id, account_name, amount, stage, close_date), `crm_activities` (activity_id, deal_id, user_id, type, notes, timestamp)

**Metric Snapshots:** `metric_snapshots` table freezes CRM data at cycle lock time so payout calculations use point-in-time data, not live data that might change after lock.

**Webhook Events:** `webhook_events` table for receiving real-time updates from external systems (Salesforce, HubSpot, etc.).

### 5.3 Self-Service Data Correction

When Zimyo is unavailable, employees/managers can request data corrections through an approval workflow.

**New tables:** `data_change_requests` (requester, subject_user, field_name, current_value, requested_value, reason, status, reviewed_by), `editable_fields` (field_name, self_service, requires_admin_approval, validation_regex)

Self-service fields (no approval needed): display_name. Admin approval required: email, department, designation, manager_id, employee_code.

---

## 8. Phase 6: Advanced Features

*Effort: ~40+ hours | Build behind feature flags*

### 6.1 Continuous Feedback & Check-Ins

**Weekly pulse check-in** (behind `module.continuous_feedback` flag):
- Pulse score (1-5, required)
- 1-2 rotating questions from a question bank (optional)
- Auto-save as draft

**Peer recognition / kudos:**
- Public or private, tied to company values
- Recognition feed on employee dashboard
- Surfaced during formal review as reference material

**New tables:** `check_ins` (employee_id, week_start, pulse_score, responses jsonb), `feedback` (from_user_id, to_user_id, type, category, message, is_public, cycle_id)

### 6.2 360-Degree Feedback

**New tables:** `feedback_requests` (cycle_id, subject_id, reviewer_id, requested_by, status), `feedback_responses` (request_id, rating, strengths, areas_for_growth, submitted_at)

- Employee/manager nominates 3-5 peers
- Anonymous aggregation (minimum 3 responses)
- Results shown to manager during review

### 6.3 Review Templates

Dynamic form builder allowing admins to configure review structure per cycle.

**New tables:** `review_templates` (name, version, is_draft, published_at), `template_sections` (section_type, respondent_role, rating_scale_id, weight, sort_order), `template_questions` (question_text, question_type, options jsonb, validation_rules jsonb, conditional_on)

**Template versioning:** Draft -> Published (v1) -> Clone to Draft -> Edit -> Published (v2). In-flight cycles use the version they were created with.

**Cycle binding:** `ALTER TABLE cycles ADD COLUMN template_id UUID REFERENCES review_templates(id)`

### 6.4 AI Review Assistant

Use Claude API to generate draft manager reviews. Input: KPI data, self-review text, peer feedback, check-in history. Output: structured draft with specific achievement references. Manager edits and approves (AI = assistant, not author).

Behind `module.ai_assist` feature flag. Employee data never used to train the model.

### 6.5 Impersonation / View-As

Two modes:
- **View-as (read-only):** Admin sees what the target user sees, cannot mutate. For debugging and QA.
- **Act-as (full impersonation):** Requires reason code, time-limited (30min), full audit trail. For blocked approvals when employee is on leave.

**New tables:** `impersonation_sessions` (actor, subject, mode, reason_code, expires_at, ended_at), `impersonation_reason_codes`

**Security:** Always-visible non-dismissible banner (amber for view-as, red for act-as). Dual audit logging (real actor + impersonated subject). No privilege escalation. Time-limited with mandatory expiry.

### 6.6 Budget Pool Management

`ALTER TABLE cycles ADD COLUMN total_budget numeric(14,2)`

Show: budget, sum of calculated payouts, variance. "What-if" simulator: change a rating, see budget impact in real-time.

### 6.7 Gamification (Behind Feature Flag)

- Streak counter for weekly check-ins (Duolingo-inspired habit loop)
- Team completion leaderboards (team-level only, never individual ratings)
- Recognition/praise wall
- Career/review timeline showing rating progression across cycles

### 6.8 PWA for Mobile

For field sales teams:
- `manifest.json` with standalone display
- Service worker: network-first for HTML, stale-while-revalidate for reads, background sync queue for writes
- Bottom navigation on mobile (< 640px)
- Quick-capture interface: 3 required fields max, pill selectors, autocomplete with recent items

---

## 9. Database Schema Additions

### Summary of All New Tables by Phase

**Phase 1 (Foundation):**
```
feature_flags              -- flag definitions (key, name, category, default_value)
feature_flag_org_overrides -- org-level toggle overrides
feature_flag_role_overrides-- role-level overrides
feature_flag_user_prefs    -- user-level preferences
rating_scales              -- configurable rating scale definitions
rating_scale_levels        -- individual levels within a scale
drafts                     -- auto-save form data (user_id, entity_type, form_data jsonb)
notification_types         -- notification type definitions with channels
notification_settings      -- org-level per-type timing/repeat config
notification_preferences   -- user-level notification overrides
config_versions            -- immutable version snapshots for auditability
```

**Phase 2-3 (Employee + Manager UX):**
```
kpi_ratings                -- per-KPI ratings (kpi_id, rater_id, rater_type, rating)
```

**Phase 4 (Admin/HRBP):**
```
data_quality_issues        -- materialized view (missing managers, orphans, etc.)
```

**Phase 5 (Data Integration):**
```
import_jobs                -- CSV/XLSX import tracking (filename, status, summary)
import_rows                -- per-row import results (row_number, status, error)
data_sources               -- external system connections
user_identity_map          -- PMS user <-> external user ID mapping
crm_deals                  -- imported deal data
crm_activities             -- imported activity data
metric_snapshots           -- point-in-time data frozen at cycle lock
webhook_events             -- inbound webhook event log
data_change_requests       -- employee data correction requests
editable_fields            -- which fields allow self-service vs need approval
```

**Phase 6 (Advanced):**
```
check_ins                  -- weekly pulse check-ins
feedback                   -- peer kudos, manager notes, feedback requests
feedback_requests          -- 360 feedback nomination tracking
feedback_responses         -- 360 feedback response data
review_templates           -- dynamic review form definitions
template_sections          -- sections within templates
template_questions         -- questions within sections
impersonation_sessions     -- admin impersonation audit trail
impersonation_reason_codes -- allowed reason codes for impersonation
```

### Schema Changes to Existing Tables

```sql
-- notifications (Phase 1)
ALTER TABLE notifications ADD COLUMN snoozed_until timestamptz;
ALTER TABLE notifications ADD COLUMN dismissed_at timestamptz;

-- cycles (Phase 4 + Phase 6)
ALTER TABLE cycles ADD COLUMN total_budget numeric(14,2);
ALTER TABLE cycles ADD COLUMN template_id uuid REFERENCES review_templates(id);
ALTER TABLE cycles ADD COLUMN template_version int;

-- kpis (Phase 2 - optional, for progress tracking)
ALTER TABLE kpis ADD COLUMN target_value numeric(12,2);
ALTER TABLE kpis ADD COLUMN actual_value numeric(12,2);
ALTER TABLE kpis ADD COLUMN progress smallint CHECK (progress BETWEEN 0 AND 100);

-- audit_logs (Phase 6 - impersonation support)
ALTER TABLE audit_logs ADD COLUMN impersonation_session_id uuid;
ALTER TABLE audit_logs ADD COLUMN real_actor_id uuid;
```

---

## 10. Implementation Sequence

### Week 1: Bug Fixes + Foundation Start (~8 hours)
| Task | Effort | Impact |
|------|--------|--------|
| Fix FEE multiplier = 0 | 15 min | Critical (wrong payouts) |
| Add is_active to RLS policies | 30 min | Security fix |
| Add logout button | 15 min | UX basic |
| Add prefers-reduced-motion CSS | 15 min | Accessibility |
| Build auto-save infrastructure (drafts table + useAutoSave hook) | 3 hr | Foundation |
| Start feature flag system (tables + resolution function) | 4 hr | Foundation |

### Week 2: Foundation Complete + Employee Dashboard (~12 hours)
| Task | Effort | Impact |
|------|--------|--------|
| Feature flag admin UI + client-side provider | 4 hr | Foundation |
| Configurable rating scales (tables + admin UI) | 3 hr | Foundation |
| Action Inbox / NBA component | 3 hr | High UX impact |
| Cycle timeline stepper component | 2 hr | Medium UX |

### Week 3: Employee Experience (~12 hours)
| Task | Effort | Impact |
|------|--------|--------|
| Wizard stepper self-review with auto-save | 5 hr | High (reduces abandonment) |
| KPI copy-forward from previous cycle | 2 hr | Medium (reduces setup time) |
| Employee history enhancement (trends, expandable rows) | 3 hr | Medium |
| Density toggle (compact/comfortable CSS + sidebar control) | 2 hr | Medium |

### Week 4: Manager + Notifications (~12 hours)
| Task | Effort | Impact |
|------|--------|--------|
| Side-by-side manager review layout | 4 hr | High (reduces context switching) |
| Rating pill selectors | 2 hr | High (reduces clicks) |
| Notification system upgrade (types, settings, preferences) | 4 hr | High |
| In-app notification center (bell icon + dropdown) | 2 hr | High |

### Month 2: Admin Dashboards + Data (~20 hours)
| Task | Effort | Impact |
|------|--------|--------|
| Progress dashboard with rings + department breakdown | 4 hr | High (executive visibility) |
| Rating distribution with target overlay | 3 hr | Medium |
| Data quality dashboard (materialized view + UI) | 3 hr | Medium |
| Enhanced CSV import pipeline (5-step flow) | 5 hr | High |
| Per-KPI ratings | 5 hr | High (workflow improvement) |

### Month 3: Feedback + Advanced (~25 hours)
| Task | Effort | Impact |
|------|--------|--------|
| Continuous feedback / check-ins | 6 hr | High (engagement) |
| Peer kudos system | 4 hr | Medium (culture) |
| 360 feedback | 8 hr | High (comprehensive reviews) |
| Budget tracking + what-if simulator | 6 hr | Medium |

### Future: Templates + AI + Impersonation (~30+ hours)
| Task | Effort | Impact |
|------|--------|--------|
| Review template builder | 15 hr | High (flexibility) |
| AI review assistant | 8 hr | High (manager productivity) |
| Impersonation / view-as | 6 hr | Medium (admin power tool) |
| PWA + offline for mobile | 8 hr | High for field teams |

---

## Key Design Decisions

### 1. Auto-Save Everywhere
Every form auto-saves with 2-second debounce. Visual indicator near form header. No more lost work. Undo toasts instead of confirmation dialogs for destructive actions.

### 2. Progressive Disclosure (3 Levels)
- **Level 1 -- Dashboard:** What do I need to do? (Action inbox, progress bars, timeline)
- **Level 2 -- Task Pages:** Let me do it. (Wizard review, check-in, kudos, KPI editing)
- **Level 3 -- Reference:** Let me understand. (History, compensation breakdown, notification settings)

Level 1 is visible by default. Levels 2-3 reached through explicit user action.

### 3. Feature Flags Gate Everything
Every new module ships behind a feature flag. Admin toggles it on when ready. Supports org-level, role-level, and user-level overrides. Enables phased rollout without deployment risk.

### 4. Configurable Scales Replace Hardcoded Tiers
Rating scales are first-class database entities. Admin can add/remove/disable tiers without code changes. Multipliers are per-cycle configurable. Eliminates duplication between PL/pgSQL and TypeScript.

### 5. CRM Integration is Optional
The data integration layer (Phase 5) is designed as an optional add-on. Core PMS works without it. CRM data is pulled into metric snapshots that are frozen at cycle lock for payout integrity.

### 6. Mobile is a PWA, Not a Separate App
Service worker handles offline. Bottom nav on small screens. Quick-capture interface for field reps. Same codebase, no separate mobile build.

---

## Competitive Positioning After Implementation

| Feature | Lattice | 15Five | Culture Amp | PMS (After) |
|---------|---------|--------|-------------|-------------|
| Goal framework | OKRs + KPIs | OKRs + Goals | Goals + Competencies | KPIs + Weighted Scores |
| Rating scale | Configurable | 5-point | 4-point default | Fully configurable |
| Per-goal ratings | Yes | Yes | Yes | **Yes** |
| Auto-save | Yes | Yes | Yes | **Yes** |
| AI review draft | Yes | Yes | No | **Yes** (Claude API) |
| 360 feedback | Yes | Yes | Yes | **Yes** |
| Continuous feedback | Weekly check-ins | Weekly pulse | Pulse surveys | **Weekly pulse + kudos** |
| Calibration | 9-box grid | Distribution view | Calibration sessions | **Bin view + target overlay** |
| Compensation | Merit matrix + budget | Basic | Basic | **Configurable multipliers + budget** |
| Data import | API + CSV | API | API + CSV | **5-step CSV + CRM webhooks** |
| Templates | Yes | Yes | Yes | **Yes** (dynamic builder) |
| Reminders | Smart + Slack | Smart + email | Smart | **Escalating + snooze** |
| ADHD-friendly | No | Partial | No | **Yes** (core design principle) |
| Mobile | App | App | App | **PWA** |
| Feature flags | Internal | Internal | Internal | **Admin-configurable** |
