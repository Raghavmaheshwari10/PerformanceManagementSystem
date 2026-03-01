# PMS Improvement Roadmap

> Prioritized by effort vs impact. Based on audit of current app + research into Lattice, 15Five, Culture Amp, Workday, Leapsome, Betterworks.

---

## Priority 1: Bug Fixes & Data Integrity (Do First)

### 1.1 Fix FEE Multiplier = 0 (bug)
"Far Exceeds Expectations" currently pays $0, same as "Below Expectations."
- Fix in `bulk_lock_appraisals()` PL/pgSQL: FEE → 1.25
- Fix in `src/lib/constants.ts`: RATING_TIERS FEE fixedMultiplier → 1.25
- **Effort**: 10 min | **Risk if unfixed**: Wrong payouts

### 1.2 Configurable Rating Multipliers
Move hardcoded multipliers to a DB table so admins can adjust per cycle.
```sql
CREATE TABLE rating_multipliers (
  id uuid PRIMARY KEY,
  cycle_id uuid REFERENCES cycles(id) NOT NULL,
  rating rating_tier NOT NULL,
  multiplier numeric(5,4) NOT NULL,
  UNIQUE (cycle_id, rating)
);
```
- Eliminates duplication between PL/pgSQL and TypeScript
- Admin sets multipliers when creating a cycle
- **Effort**: 2-3 hours

### 1.3 Add is_active Check to RLS
Soft-deleted users (is_active=false) can currently still access data.
- Add `AND is_active = true` to all SELECT policies referencing user_id()
- **Effort**: 30 min

### 1.4 Add Logout Button
Currently missing from the sidebar.
- **Effort**: 15 min

---

## Priority 2: User Experience ("Make It Lazy")

### 2.1 Auto-Save Drafts
Biggest UX pain point: losing work.
```sql
CREATE TABLE drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) NOT NULL,
  entity_type text NOT NULL,  -- 'self_review', 'manager_review'
  entity_id uuid,
  form_data jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_id)
);
```
- Debounced save (2s after last keystroke)
- Visual indicator: "Draft saved at 2:34 PM"
- Load draft on page open, delete on successful submit
- **Effort**: 3-4 hours

### 2.2 Copy KPIs from Previous Cycle
When manager sets up KPIs, offer "Copy from last cycle" button.
- Query previous cycle's KPIs for same employee
- Pre-fill form with copied KPIs (editable)
- **Effort**: 2 hours

### 2.3 KPI Templates
Allow saving and reusing KPI sets by role/department.
```sql
CREATE TABLE kpi_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  department text,          -- null = org-wide
  designation text,         -- null = any
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE kpi_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES kpi_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  weight numeric(5,2),
  sort_order integer DEFAULT 0
);
```
- Manager picks template → KPIs auto-populated
- **Effort**: 4-5 hours

### 2.4 Smart Deadline Reminders
Replace passive deadline banners with proactive notifications.
- -7 days: Friendly reminder
- -3 days: Warning
- -1 day: Urgent
- Overdue: Daily nudge to employee + escalate to manager
- Implement as a cron job or Supabase Edge Function
- **Effort**: 4-5 hours

### 2.5 Progress Dashboard
Admin/HRBP dashboard showing cycle completion stats:
- % employees who submitted self-reviews
- % managers who submitted ratings
- Overdue counts by department
- Rating distribution preview
- **Effort**: 3-4 hours

---

## Priority 3: Workflow Improvements

### 3.1 Per-KPI Ratings
Current: Single overall self_rating and manager_rating.
Proposed: Rate each KPI individually, auto-calculate weighted overall.
```sql
CREATE TABLE kpi_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id uuid REFERENCES kpis(id) ON DELETE CASCADE NOT NULL,
  cycle_id uuid REFERENCES cycles(id) NOT NULL,
  employee_id uuid REFERENCES users(id) NOT NULL,
  rater_id uuid REFERENCES users(id) NOT NULL,
  rater_type text NOT NULL CHECK (rater_type IN ('self', 'manager')),
  rating rating_tier NOT NULL,
  comments text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE (kpi_id, rater_type)
);
```
- Employee rates each KPI during self-review
- Manager rates each KPI during manager review
- Overall rating = weighted average (auto-calculated)
- **Effort**: 8-10 hours (schema + UI for both employee and manager)

### 3.2 Zimyo Workaround: Enhanced CSV Upload
Since Zimyo API may not always be available:
- **Downloadable CSV template** with headers and example row
- **Inline error preview** before committing (table showing row# + error)
- **Error export**: Download CSV of failed rows with appended error column
- **Reconciliation preview**: Show "will create: 5, will update: 3, will skip: 2" before committing
- **Manager linking by email**: Already works, but add validation warnings for unresolvable managers
- **Bulk role assignment**: Column in CSV for role, or separate bulk-role UI
- **Effort**: 4-5 hours (incremental on existing upload)

### 3.3 Review Templates
Allow admins to configure what a review form looks like per cycle.
```sql
CREATE TABLE review_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE template_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES review_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  section_type text NOT NULL,  -- 'rating', 'text', 'kpi_review', 'competency'
  sort_order integer DEFAULT 0
);

CREATE TABLE template_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid REFERENCES template_sections(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL,  -- 'rating_scale', 'text', 'yes_no'
  is_required boolean DEFAULT true,
  sort_order integer DEFAULT 0
);
```
- Link cycle to a template
- Form dynamically renders from template definition
- **Effort**: 12-15 hours (significant)

### 3.4 Continuous Feedback / Check-ins
Lightweight ongoing feedback between cycles:
```sql
CREATE TABLE check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES users(id) NOT NULL,
  subject_id uuid REFERENCES users(id) NOT NULL, -- about whom
  content text NOT NULL,
  visibility text DEFAULT 'private', -- 'private', 'shared', 'manager_only'
  created_at timestamptz DEFAULT now()
);
```
- Manager or peer can leave feedback anytime
- Surfaced during formal review as reference
- **Effort**: 6-8 hours

---

## Priority 4: Advanced Features

### 4.1 360-Degree Feedback
New tables + full workflow:
```sql
CREATE TABLE feedback_requests (
  id uuid PRIMARY KEY,
  cycle_id uuid REFERENCES cycles(id),
  subject_id uuid REFERENCES users(id),      -- person being reviewed
  reviewer_id uuid REFERENCES users(id),      -- peer reviewer
  requested_by uuid REFERENCES users(id),     -- who nominated
  status text DEFAULT 'pending',              -- pending/completed/declined
  created_at timestamptz DEFAULT now()
);

CREATE TABLE feedback_responses (
  id uuid PRIMARY KEY,
  request_id uuid REFERENCES feedback_requests(id),
  rating rating_tier,
  strengths text,
  areas_for_growth text,
  submitted_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```
- Employee/manager nominates 3-5 peers
- Anonymous aggregation (min 3 responses)
- Results shown to manager during review
- **Effort**: 15-20 hours

### 4.2 9-Box Grid Calibration
Interactive Performance (x) vs Potential (y) grid:
- Requires new column: `appraisals.potential_rating` (low/medium/high)
- Drag-and-drop UI to move employees between boxes
- Mandatory justification for moves
- **Effort**: 10-12 hours

### 4.3 AI Review Assistant
Use Claude API to generate draft manager reviews:
- Input: KPI data, self-review text, past feedback, check-in notes
- Output: Draft review with specific achievement references
- Manager edits and approves (AI = assistant, not author)
- **Effort**: 8-10 hours (API integration + UI)

### 4.4 Budget Pool Management
Track variable pay budget vs calculated payouts:
```sql
ALTER TABLE cycles ADD COLUMN total_budget numeric(14,2);
```
- Show: budget, sum of calculated payouts, variance
- "What-if" simulator: change a rating, see budget impact
- **Effort**: 6-8 hours

### 4.5 Goal Hierarchy
Company → Team → Individual alignment:
```sql
CREATE TABLE goals (
  id uuid PRIMARY KEY,
  parent_id uuid REFERENCES goals(id),
  level text NOT NULL,  -- 'company', 'team', 'individual'
  owner_id uuid REFERENCES users(id),
  title text NOT NULL,
  description text,
  fiscal_year integer,
  created_at timestamptz DEFAULT now()
);
```
- Visual tree view showing alignment
- Individual KPIs link to team/company goals
- **Effort**: 12-15 hours

---

## Implementation Order (Suggested)

| Phase | Items | Total Effort |
|-------|-------|-------------|
| **Week 1** | 1.1 (FEE fix), 1.3 (is_active RLS), 1.4 (logout), 2.2 (copy KPIs) | ~4 hours |
| **Week 2** | 2.1 (auto-save), 2.4 (reminders), 2.5 (progress dashboard) | ~12 hours |
| **Week 3** | 1.2 (config multipliers), 3.2 (enhanced CSV upload) | ~8 hours |
| **Week 4** | 3.1 (per-KPI ratings) | ~10 hours |
| **Month 2** | 2.3 (KPI templates), 3.4 (check-ins), 4.4 (budget) | ~18 hours |
| **Month 3** | 4.1 (360 feedback), 4.2 (9-box grid) | ~30 hours |
| **Future** | 3.3 (review templates), 4.3 (AI assistant), 4.5 (goal hierarchy) | ~35 hours |

---

## Reference: How Competitors Handle Key Features

| Feature | Lattice | 15Five | Culture Amp | Our PMS |
|---------|---------|--------|-------------|---------|
| Goal framework | OKRs + KPIs | OKRs + Goals | Goals + Competencies | KPIs only |
| Rating scale | Configurable | 5-point | 4-point default | 5-tier (FEE-BE) |
| Per-goal ratings | Yes | Yes | Yes | **No** (overall only) |
| Auto-save | Yes | Yes | Yes | **No** |
| AI review draft | Yes | Yes | No | **No** |
| 360 feedback | Yes | Yes | Yes | **No** |
| Continuous feedback | Weekly check-ins | Weekly pulse | Pulse surveys | **No** |
| Calibration | 9-box grid | Distribution view | Calibration sessions | Bell curve + overrides |
| Compensation | Merit matrix + budget | Basic | Basic | Flat multiplier |
| Data import | API + CSV | API | API + CSV | Zimyo API + CSV |
| Templates | Yes | Yes | Yes | **No** (hardcoded forms) |
| Reminders | Smart + Slack | Smart + email | Smart | Deadline banners only |
