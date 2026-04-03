# PMS Deep End-to-End Testing Prompt v2

Copy everything below the `---` line into the Claude Chrome Extension.

---

You are a senior QA engineer performing deep end-to-end testing of a Performance Management System (PMS) at **https://pms.emb.global**. Your mission is to test EVERY feature, find EVERY bug, and stress-test edge cases. Be methodical, thorough, and adversarial — try to break things.

## TEST ACCOUNTS

| Role | Email | Password | Name | Notes |
|------|-------|----------|------|-------|
| Admin | raghav.maheshwari@emb.global | Simran@1010 | Raghav Maheshwari | Full admin access |
| HRBP + Manager | suhanee.kesharwani@emb.global | Welcome@123 | Suhanee Kesharwani | HRBP role. Also manager of Rishu. Use role switcher in sidebar. |
| Employee | rishu.dutta@emb.global | Rishu@2709 | Rishu Dutta | Employee in HR dept, manager is Suhanee |

**Important dual-role:** Suhanee has 3 views — HRBP (default), Manager (via role switcher), and Employee (via role switcher). Test all three.

## GENERAL TESTING RULES

For EVERY page you visit:
1. **Check page loads** — no white screen, no 500 error, no "Application error"
2. **Check layout** — sidebar visible, header with greeting and notification bell, no overflow/scrolling issues
3. **Check responsive** — resize browser to ~768px width, verify nothing breaks badly
4. **Check empty states** — if a section has no data, it should show a helpful message not a blank area
5. **Check loading states** — buttons should show "Submitting..." / spinner when clicked
6. **Try invalid inputs** — empty required fields, special characters, extremely long text, negative numbers
7. **Check notifications** — click the bell icon, verify notifications have readable messages (not just dates)

---

## PHASE 1: LOGIN & AUTHENTICATION

### 1.1 Standard Login
1. Go to https://pms.emb.global/login
2. Try login with **wrong password** — verify error message appears (not a crash)
3. Try login with **non-existent email** — verify error message
4. Try login with **empty fields** — verify validation
5. Login with raghav.maheshwari@emb.global / Simran@1010 — verify redirect to `/admin`
6. Check the greeting shows "Good morning/afternoon/evening, Raghav"

### 1.2 Google Sign-In
1. Logout, go to /login
2. Click "Sign in with Google" button
3. Verify it redirects to Google OAuth (no redirect_uri_mismatch error)
4. Complete or cancel Google sign-in — verify no crash

### 1.3 Password Reset Flow
1. Go to /login, click "Forgot password?" link
2. Enter a valid email — verify success message appears
3. Try empty email — verify validation
4. Go to /login/reset-password (without token) — verify it handles gracefully

### 1.4 Session Persistence
1. Login as Raghav, navigate to several pages
2. Refresh the browser — verify you stay logged in
3. Open a new tab to https://pms.emb.global — verify you're still authenticated

---

## PHASE 2: ADMIN — FULL FEATURE TEST (Login as Raghav)

### 2.1 Dashboard (`/admin`)
1. Verify stats cards load (total users, active cycles, departments, etc.)
2. Verify cycle health section shows data or empty state
3. Verify team composition / department breakdown is visible
4. Click on any stat card or link — verify navigation works

### 2.2 User Management (`/admin/users`)
1. Verify user list loads with names, emails, roles, departments
2. Use the **search** — type "Rishu", verify filtering works
3. Use **role filter** — filter by "employee", verify only employees show
4. Click **Edit** on Suhanee — verify edit page loads
5. **CRITICAL:** Check the HRBP department assignment checkboxes at the bottom of the edit page. The "HR" checkbox should be checked (if not, check it and save)
6. Try changing Suhanee's role dropdown — **don't save** — just verify the dropdown works
7. Click **Cancel/Back** — verify no accidental save happened
8. **Edge case:** Go to `/admin/users/new` — try creating a user with:
   - Empty fields — verify validation errors
   - Duplicate email (use raghav.maheshwari@emb.global) — verify duplicate error
   - Very long name (100+ chars) — verify it handles gracefully
9. **Toggle active:** Find any user, click deactivate toggle, verify badge changes. Re-activate.

### 2.3 Department Management (`/admin/departments`)
1. Verify departments list loads
2. Create a new department: "QA Testing Dept"
3. Verify it appears in the list
4. Rename it to "QA Testing Department" — verify rename works
5. Delete it — verify deletion works (it has no users assigned)
6. **Edge case:** Try deleting a department that HAS users (like "HR") — verify it shows an error, not a crash

### 2.4 Role Slugs (`/admin/roles`)
1. Verify role slugs list loads (these are designation labels for template grouping)
2. Create: "QA Tester" — verify it appears
3. Edit the label — verify save works
4. Toggle inactive — verify badge changes
5. Delete it — verify it works (no templates linked)
6. **Edge case:** Try creating a role slug with empty name — verify validation

### 2.5 Competencies (`/admin/competencies`)
1. Verify existing competencies load
2. If none exist, create 3:
   - "Communication" — "Ability to convey ideas clearly"
   - "Leadership" — "Ability to guide and motivate team members"
   - "Problem Solving" — "Analytical thinking and creative resolution"
3. **Edge case:** Try creating a competency with empty name — verify validation
4. Delete one, then re-create it — verify full lifecycle works

### 2.6 Review Templates (`/admin/review-templates`)
1. Verify templates list loads
2. Create a new template: "Deep Test Template"
3. Add 3 questions:
   - "Rate communication skills" — Competency: Communication, Type: Rating, Required: Yes
   - "Describe leadership examples" — Competency: Leadership, Type: Mixed, Required: Yes
   - "Rate problem-solving ability" — Competency: Problem Solving, Type: Rating, Required: No
4. Verify all questions appear with correct competency and type badges
5. **Edge case:** Try adding a question with no text — verify validation
6. Delete the template — verify it's removed

### 2.7 KRA Templates (`/admin/kra-templates`)
1. Verify list loads, grouped by role if any
2. Create KRA templates if needed:
   - "Revenue & Sales" — Category: performance, Weight: 40
   - "Operational Excellence" — Category: performance, Weight: 35
   - "Learning & Development" — Category: learning, Weight: 25
3. **Edge case:** Try weight = 0 — verify validation
4. **Edge case:** Try weight = 150 — verify validation (should reject >100)
5. Toggle one inactive, verify badge changes, toggle back

### 2.8 KPI Templates (`/admin/kpi-templates`)
1. Verify list loads, grouped under KRA templates
2. Create KPI templates if needed:

| Title | KRA Template | Unit | Target | Weight |
|-------|-------------|------|--------|--------|
| Quarterly Revenue | Revenue & Sales | number | 5000000 | 50 |
| New Client Acquisition | Revenue & Sales | number | 10 | 50 |
| Process Compliance Score | Operational Excellence | percent | 95 | 60 |
| SLA Achievement Rate | Operational Excellence | percent | 98 | 40 |
| Training Hours | Learning & Development | number | 40 | 100 |

3. **IMPORTANT:** Verify the Unit field is set correctly — "number" for revenue/clients/training, "percent" for compliance/SLA. This was a previous bug where all were set to "percent".
4. Edit one template — change the target, save, verify the update
5. **Edge case:** Try creating a KPI template with weight that makes the total per KRA exceed 100%

### 2.9 Email Templates (`/admin/email-templates`)
1. Verify the page loads with a list of notification types
2. Click on a notification type (e.g., "cycle_self_review_open")
3. Verify you can see/edit the subject and HTML body
4. Check that template variables are documented (e.g., {employee_name}, {cycle_name})
5. Make a small edit, save, verify success
6. **Edge case:** Try saving an empty subject — verify validation

### 2.10 Manual Notifications (`/admin/notifications`)
1. Verify the notification form loads
2. Send a test notification:
   - Recipient type: Individual
   - Select: Rishu Dutta
   - Type: admin_message
   - Message: "This is a test notification from admin"
3. Verify success message
4. **Edge case:** Try sending with no recipient — verify validation
5. **Edge case:** Try "Send to Everyone" — verify confirmation dialog appears

### 2.11 Payout Configuration (`/admin/payout-config`)
1. Verify the 5 rating tiers show with current multipliers:
   - FEE = 1.25, EE = 1.10, ME = 1.00, SME = 0.00, BE = 0.00
2. Change EE to 1.15, save, verify it updates
3. Change EE back to 1.10, save
4. **Edge case:** Try setting multiplier to -1 — verify validation
5. **Edge case:** Try setting multiplier to 999 — verify it rejects (max should be ~5)

### 2.12 MIS Integration (`/admin/mis`)
1. Verify MIS page loads (may show empty state if no targets)
2. Go to `/admin/mis/settings` — verify settings form loads
3. **Don't change real settings** — just verify the fields exist (API URL, key, fiscal year)
4. Try creating a manual AOP target if the option exists
5. Verify sync button exists (even if API not configured)

### 2.13 Audit Log (`/admin/audit-log`)
1. Verify the audit log loads with entries
2. Check that entries show: action, user, timestamp, entity
3. Scroll through — verify pagination or infinite scroll works
4. **Edge case:** Check if the notification you sent in 2.10 appears in the audit log

### 2.14 Reports (`/admin/reports`)
1. Verify the reports page loads
2. Check for charts, data tables, or empty states
3. Verify any filters/dropdowns work

### 2.15 Payouts (`/admin/payouts`)
1. Verify the payouts page loads
2. Should show payout data for published cycles or empty state

### 2.16 Documentation (`/docs`)
1. Verify the docs page loads
2. Check table of contents navigation — click section links
3. Verify the stage matrix mentions all roles and stages
4. Check that "Review Discussion Meeting" feature is documented

---

## PHASE 3: CYCLE LIFECYCLE — COMPLETE FLOW

### 3.1 Create a New Cycle (Admin)
1. Go to `/admin/cycles/new`
2. Create:
   - Name: **"Deep Test Cycle Q2 2026"**
   - Quarter: Q2
   - Year: 2026
   - Scope: Department-scoped — select **"HR"** department
   - Review Template: select any existing template (or "Deep Test Template" if you created one)
   - Competency Weight: **30**
   - Deadlines (all in the future):
     - KPI Setting: tomorrow
     - Self Review: 5 days from now
     - Manager Review: 10 days from now
     - Calibration: 15 days from now
3. Save — verify the cycle appears with status "draft"
4. **Edge case:** Try creating another cycle with the same name — verify behavior
5. **Edge case:** Try creating a cycle with past deadlines — verify warning or error

### 3.2 View Cycle Details
1. Click on "Deep Test Cycle Q2 2026"
2. Verify per-department status table shows HR with status "draft"
3. Verify employee list shows Rishu Dutta (and possibly others in HR)
4. Check for "Send Reminders" buttons (should appear in later stages)

### 3.3 Advance to KPI Setting (Admin)
1. Find the HR department row
2. Click advance button — move from `draft` → `kpi_setting`
3. Verify status badge changes
4. **Edge case:** Try advancing again — should move to next valid state
5. **Edge case:** Try using "Revert" (if available) — move back to draft, then forward again

### 3.4 Manager Sets KPIs (Login as Suhanee — Manager view)
1. Logout, login as Suhanee (suhanee.kesharwani@emb.global / Welcome@123)
2. Switch to **Manager view** using sidebar role switcher
3. Go to `/manager` — verify Rishu Dutta appears in team list
4. Click Rishu → go to KPIs tab (`/manager/{rishuId}/kpis`)
5. If KPIs already exist from a previous cycle, check for "Copy from previous cycle" option
6. Create KRAs:
   - "Revenue & Sales" — weight: 40
   - "Operational Excellence" — weight: 35
   - "Learning & Development" — weight: 25
7. Under each KRA, add KPIs:
   - Revenue & Sales: "Quarterly Revenue" (number, target: 5000000, weight: 50), "New Clients" (number, target: 10, weight: 50)
   - Operational Excellence: "Process Compliance" (percent, target: 95, weight: 60), "SLA Achievement" (percent, target: 98, weight: 40)
   - Learning & Development: "Training Hours" (number, target: 40, weight: 100)
8. **Validation checks:**
   - [ ] KRA weights sum to 100 (40+35+25)
   - [ ] KPI weights sum to 100 within each KRA
   - [ ] Try setting KPI weight to 0 — verify validation
   - [ ] Try adding a 3rd KPI under Revenue & Sales with weight 60 (would make total 160) — should show error
9. Click **"Finalize KPIs"**
10. Verify KPIs become read-only
11. **Edge case:** Try clicking "Finalize" again — should show already finalized message
12. **Edge case:** Try "Unlock KPIs" if available — verify it works and allows re-editing

### 3.5 Advance to Self Review (Admin)
1. Logout, login as Admin
2. Advance HR from `kpi_setting` → `self_review`

### 3.6 Employee Self Review (Login as Rishu)
1. Logout, login as Rishu (rishu.dutta@emb.global / Rishu@2709)
2. Verify employee dashboard shows "Deep Test Cycle Q2 2026" with self-review prompt
3. Check UI elements:
   - [ ] KRAs and KPIs displayed with correct targets
   - [ ] Targets formatted correctly — "50,00,000" for revenue (NOT "5000000%")
   - [ ] Percent KPIs show "95%" for compliance target
   - [ ] Hero action card says "Complete your self-review"
   - [ ] Deadline banner shows self-review deadline
   - [ ] Cycle timeline shows current phase highlighted
4. Fill achievements:
   - Quarterly Revenue: **4800000** (verify it accepts large numbers)
   - New Clients: **9**
   - Process Compliance: **93**
   - SLA Achievement: **97**
   - Training Hours: **38**
5. Self-rate each KPI (mix of ME and EE)
6. Fill competency questions if they appear (rate 3-5 stars, add text)
7. Overall self-rating: **EE**
8. Self-comments: "Strong performance across revenue and operations. Slightly below target on training but committed to improvement next quarter."
9. **Before submitting:** Navigate away from the page, come back — verify form data persists (auto-save) or shows a warning
10. Click **Submit**
11. Verify:
    - [ ] Success confirmation
    - [ ] Status badge: "Self-review submitted" (green)
    - [ ] Form becomes read-only
    - [ ] Submit button disappears or is disabled
12. **Edge case:** Try to resubmit — verify it's blocked
13. **Edge case:** Try editing the URL to access `/employee` — verify read-only state persists

### 3.7 Check Notification Bell (As Rishu)
1. Click notification bell in header
2. Verify notifications show **readable messages** like "Self-review is now open for Deep Test Cycle Q2 2026"
3. Test snooze — click "Snooze 1d" on a notification, verify it disappears from the list
4. Test dismiss — click "Dismiss" on another, verify it's removed
5. Click "Mark all read" if available — verify unread badge clears

---

## PHASE 4: REVIEW DISCUSSION MEETING — DEEP TEST

### 4.1 Advance to Manager Review (Admin)
1. Login as Admin, advance HR from `self_review` → `manager_review`

### 4.2 HRBP Schedules Meeting (Login as Suhanee — HRBP view)
1. Login as Suhanee, switch to HRBP view
2. Go to `/hrbp/meetings`
3. Verify:
   - [ ] Cycle section shows "Deep Test Cycle Q2 2026"
   - [ ] Rishu shows with "Needs Scheduling" badge
   - [ ] Summary counts: "1 pending"
4. Click **Schedule** on Rishu's row
5. **Modal tests:**
   - [ ] Modal opens, doesn't overflow screen
   - [ ] Date picker works
   - [ ] Duration dropdown has options (30/45/60/90 min)
   - [ ] Google Meet info box is visible
6. **Edge case:** Try submitting with empty date — verify validation
7. **Edge case:** Try submitting with a past date/time — verify error "must be in the future"
8. Set valid future date/time, duration 60 min
9. Click **Schedule Meeting**
10. Verify:
    - [ ] Success — modal closes
    - [ ] Status changes to "Scheduled" (blue badge)
    - [ ] Date and time shown correctly
    - [ ] Meet link appears (either Google Calendar or fallback format like meet.google.com/xxx-xxxx-xxx)
    - [ ] "Join" button (blue) visible
    - [ ] "Add MOM" button (green) visible
    - [ ] Summary: "1 scheduled"

### 4.3 Manager Review LOCKED Check (Suhanee — Manager view)
1. Switch to Manager view
2. Go to `/manager` → click Rishu → Review tab
3. **CRITICAL checks:**
   - [ ] Blue banner: "Discussion Meeting Scheduled" with date, time, Meet link
   - [ ] **Lock icon visible** with "Review Form Locked"
   - [ ] Message explains meeting must be completed first
   - [ ] **NO review form fields visible at all** — complete lock
   - [ ] Left panel shows Rishu's self-assessment (read-only)
4. **Security check:** Open browser dev tools (F12), check the Network tab. Try to manually call the submit action — it should fail with the meeting gate error

### 4.4 Employee Meeting Info (Login as Rishu)
1. Login as Rishu, go to `/employee`
2. Verify:
   - [ ] Blue meeting banner: "Review Discussion Meeting Scheduled"
   - [ ] Shows date, time, participants (manager + HRBP names)
   - [ ] "Join Google Meet" link is clickable
   - [ ] No "Concerns Raised" section visible at all (this is confidential)

### 4.5 Cancel and Reschedule Meeting (Suhanee — HRBP view)
1. Login as Suhanee, HRBP view, go to `/hrbp/meetings`
2. If there's a cancel option, cancel the meeting
3. Verify status changes to "Cancelled" (red badge)
4. Verify the Schedule button reappears
5. Schedule a new meeting with different time
6. Verify it schedules successfully — status back to "Scheduled"

### 4.6 Submit MOM (Suhanee — HRBP view)
1. Click **"Add MOM"** on Rishu's row
2. **Modal form tests:**
   - [ ] Modal scrolls properly (doesn't cut off content)
   - [ ] All 6 sections visible: Key Discussion, Strengths, Areas for Improvement, Action Items, Employee Agreement, Concerns
3. Fill the MOM:
   - **Key Discussion Points:** "Discussed Q2 performance. Rishu showed strong revenue numbers at Rs 48L vs 50L target. Client acquisition excellent at 9/10. Compliance and training slightly below — agreed on improvement plan. Overall positive trajectory with clear action items."
   - **Strengths:** "Strong revenue focus, excellent client relationships, proactive SLA management at 97%. Takes ownership and shows initiative consistently."
   - **Areas for Improvement:** "Process compliance at 93% vs 95% target. Training hours at 38/40 — close but needs consistent effort. Should establish weekly compliance tracking routine."
   - **Action Items:**
     - Item 1: "Complete remaining training hours by month end" / Owner: "Rishu Dutta" / Deadline: 2 weeks from now
     - Item 2: "Create weekly compliance checklist" / Owner: "Rishu Dutta" / Deadline: 1 week from now
     - Click **"+ Add action item"** — add: "Monthly learning review with manager" / Owner: "Suhanee Kesharwani" / Deadline: 1 month from now
   - **Check** "Employee agrees with the discussion points"
   - **Concerns (Confidential):** "Rishu appeared somewhat disengaged during L&D discussion. May need to explore whether external factors are affecting motivation. Recommend follow-up in next 1:1."
4. **Edge cases before submit:**
   - [ ] Try removing all action items (click X on each) — verify at least the form submits with 0 items
   - [ ] Try submitting with empty required fields — verify validation
5. Re-fill any cleared fields, then click **"Submit MOM & Complete Meeting"**
6. Verify:
   - [ ] Status → "Completed" (green)
   - [ ] Summary: "1 done"
   - [ ] "View MOM" button appears
7. Click **"View MOM"** — verify:
   - [ ] All 5 main sections display correctly
   - [ ] 3 action items with owners and deadlines
   - [ ] "Employee agrees" green badge
   - [ ] **Concerns section IS visible** (you're HRBP)
   - [ ] Modal scrolls properly, close button works

### 4.7 Employee MOM Visibility — CRITICAL SECURITY TEST (Login as Rishu)
1. Login as Rishu, go to `/employee`
2. Verify:
   - [ ] Green meeting banner: "Review Discussion Completed"
   - [ ] Click "View Discussion Summary" (expandable)
   - [ ] Key Discussion Points — **visible** ✓
   - [ ] Strengths — **visible** ✓
   - [ ] Areas for Improvement — **visible** ✓
   - [ ] Action Items — all 3 **visible** ✓
   - [ ] Employee Agreement — **visible** ✓
   - [ ] **CRITICAL: "Concerns Raised" section MUST NOT be visible.** If you see "Rishu appeared somewhat disengaged..." text, this is a **CRITICAL SECURITY BUG**. The concerns field is confidential HRBP+Manager only.

### 4.8 Manager MOM Visibility (Suhanee — Manager view)
1. Login as Suhanee, Manager view, go to Rishu's review page
2. Verify:
   - [ ] Green banner: "Discussion Meeting Completed — Review Unlocked"
   - [ ] Click "View Meeting Minutes" — expandable section
   - [ ] **Concerns section IS visible** to manager ✓
   - [ ] Full MOM content displayed
   - [ ] **Review form is NOW unlocked and active**

---

## PHASE 5: MANAGER REVIEW — DEEP TEST

### 5.1 Submit Manager Review (Suhanee — Manager view)
1. On Rishu's review page, verify the review form is active
2. Left panel: verify employee's self-assessment is visible (ratings, comments, achievements)
3. Rate each KPI:
   - Quarterly Revenue: **ME** (met expectations — 96% of target)
   - New Clients: **EE** (90% of target but quality was excellent)
   - Process Compliance: **SME** (below 95% target)
   - SLA Achievement: **ME** (97% vs 98% — close)
   - Training Hours: **SME** (38/40 — slightly below)
4. Fill competency questions:
   - Communication: 4/5 stars, "Clear communicator in team meetings and client calls"
   - Leadership: 3/5 stars, "Shows potential, needs more initiative in mentoring"
   - Problem Solving: 4/5 stars, "Good analytical approach, handles pressure well"
5. Overall manager rating: **ME**
6. Manager comments: "Rishu delivered solid revenue and SLA performance. Client acquisition was strong. However, compliance and training targets were missed. Discussion meeting highlighted improvement areas. Expecting focused effort on process discipline and upskilling in Q3."
7. **Before submit:** Verify the KPI target/achievement display:
   - [ ] Revenue shows "50,00,000" NOT "5000000%"
   - [ ] Clients shows "10" NOT "10%"
   - [ ] Compliance shows "95%"
   - [ ] Training shows "40" NOT "40%"
8. Click **Submit**
9. Verify:
   - [ ] Success message
   - [ ] Rating shows "ME" as submitted
   - [ ] Form becomes read-only
   - [ ] "Submitted" confirmation message
10. **Edge case:** Navigate away and come back — verify read-only state persists
11. **Edge case:** Try the URL for another employee who isn't your direct report — should redirect to /unauthorized

---

## PHASE 6: CALIBRATION — DEEP TEST

### 6.1 Advance to Calibrating (Admin)
1. Login as Admin, advance HR from `manager_review` → `calibrating`

### 6.2 HRBP Calibration (Login as Suhanee — HRBP view)
1. Login as Suhanee, HRBP view
2. Go to `/hrbp/calibration`
3. Verify:
   - [ ] Rishu appears in calibration table
   - [ ] Columns: Employee, Department, Manager Rating, MIS Score, Suggested, Final Rating, Override
   - [ ] Manager Rating shows: ME
   - [ ] Bell curve / distribution chart is visible at the top
4. **Override test:**
   - Change Rishu's override dropdown to **EE**
   - Enter justification: "Strong revenue performance at 96% of target with excellent client acquisition. Manager rating of ME is conservative. Adjusting to EE."
   - Click **Save**
5. Verify:
   - [ ] Success toast notification
   - [ ] Final Rating column updates to **EE**
   - [ ] **Override dropdown now shows EE** (not reset to ME — this was a previous bug)
   - [ ] Bell curve chart updates
6. **Edge case:** Try saving with empty justification — verify it requires justification
7. **Edge case:** Override to same value as manager rating — verify it still saves

### 6.3 Lock & Calculate Payouts
1. Click **Lock** for HR department
2. Verify:
   - [ ] Status changes to `locked`
   - [ ] Multiplier column appears with value (EE = x1.10)
   - [ ] Payout amount is calculated (variable_pay × 1.10)
   - [ ] Multiplier shows **x1.10** NOT **x1.100** (previously had 3 decimal places)

### 6.4 Publish Results
1. Click **Publish**
2. Verify:
   - [ ] Status changes to `published`
   - [ ] Confirmation message

### 6.5 Employee Results (Login as Rishu)
1. Login as Rishu, go to `/employee`
2. Verify:
   - [ ] Hero card shows published results with green badge
   - [ ] Final rating: **EE**
   - [ ] Payout breakdown visible with amount
   - [ ] Manager comments visible
   - [ ] Achievement vs target displayed for each KPI

### 6.6 Employee History
1. Go to `/employee/history`
2. Verify the cycle appears with EE rating and payout amount

---

## PHASE 7: PEER REVIEWS (Login as Rishu)

### 7.1 Peer Review System
1. Go to `/employee/peer-reviews` (if accessible via sidebar or URL)
2. If the page loads:
   - Request a peer review from Suhanee
   - Verify the request appears with "requested" status
   - Login as Suhanee (employee view) — check if peer review request is visible
   - Accept the request
   - Submit a peer review with rating + comments
   - Login as Rishu — verify the completed peer review appears
3. If the page returns 404 or is hidden — note that peer reviews feature is disabled/hidden

---

## PHASE 8: GOALS — DEEP TEST (Login as Rishu)

### 8.1 Create Goals
1. Go to `/employee/goals`
2. Create goal 1:
   - Title: "Complete PMP Certification"
   - Type: Development
   - Target Value: 1
   - Unit: certification
   - Weight: 30
   - Due date: 3 months from now
   - Description: "Obtain Project Management Professional certification"
3. Create goal 2:
   - Title: "Increase Monthly Revenue by 20%"
   - Type: Business
   - Target Value: 6000000
   - Unit: rupees
   - Weight: 50
   - Due date: 6 months from now
4. Create goal 3:
   - Title: "Mentor 2 Junior Team Members"
   - Type: Behavior
   - Target Value: 2
   - Unit: people
   - Weight: 20
   - Due date: 4 months from now
5. **Edge cases:**
   - [ ] Try creating a goal with empty title — verify validation
   - [ ] Try weight > 100 — verify validation
   - [ ] Try negative target value — verify handling

### 8.2 Goal Workflow
1. Select a goal, click **Submit** (submit for manager approval)
2. Verify status changes to "submitted"
3. **Update Progress:** If an option exists, update the current_value
4. Login as Suhanee (Manager view) → go to `/manager/{rishuId}/goals`
5. Verify submitted goals appear
6. **Approve** one goal — verify status changes to "approved"
7. **Reject** another with comment: "Please revise the timeline" — verify rejection
8. Login as Rishu — verify approval/rejection reflected

---

## PHASE 9: FEEDBACK — DEEP TEST (Login as Rishu)

### 9.1 Send Feedback
1. Go to `/employee/feedback`
2. Send feedback:
   - To: Suhanee Kesharwani
   - Category: Leadership
   - Message: "Excellent mentoring throughout Q2. The structured review discussion was very helpful."
   - Visibility: Recipient and Manager
3. Click Send — verify success
4. **Check "Sent" section** — verify the feedback you just sent appears with recipient name "Suhanee Kesharwani"
5. Send another feedback:
   - To: Raghav Maheshwari
   - Category: Communication
   - Message: "Great communication of company policies and PMS guidelines."
   - Visibility: Public Team
6. **Edge cases:**
   - [ ] Try sending feedback to yourself — should show error
   - [ ] Try sending with empty message — verify validation
   - [ ] Try sending with no recipient selected — verify validation

### 9.2 Receive Feedback (Login as Suhanee)
1. Login as Suhanee, switch to Employee view
2. Go to feedback page
3. Verify feedback from Rishu appears in "Received" section with:
   - Category badge (Leadership)
   - Message text
   - Sender name (Rishu Dutta)
   - Date

---

## PHASE 10: MIS FEATURES

### 10.1 MIS Overview (HRBP view)
1. Login as Suhanee, HRBP view
2. Go to `/hrbp/mis`
3. Verify the MIS page loads (may show empty state or data)
4. Check RAG status indicators if any targets exist

### 10.2 Employee MIS (Login as Rishu)
1. Go to `/employee/mis`
2. Verify the page loads — may show targets or empty state
3. Check that any targets display with proper formatting

### 10.3 Manager MIS (Suhanee — Manager view)
1. Switch to Manager view
2. Go to `/manager/mis`
3. Verify team MIS tracking page loads

---

## PHASE 11: REPORTS & PAYOUTS

### 11.1 Admin Reports
1. Login as Admin, go to `/admin/reports`
2. Verify charts/data display for published cycles
3. Check rating distribution visualization

### 11.2 HRBP Reports
1. Login as Suhanee (HRBP), go to `/hrbp/reports`
2. Verify reports load with calibration data

### 11.3 Manager Reports
1. Switch to Manager view, go to `/manager/reports`
2. Verify team-level reports

### 11.4 Payouts
1. Admin: `/admin/payouts` — verify payout data
2. HRBP: `/hrbp/payouts` — verify payout approvals/data
3. Manager: `/manager/payouts` — verify team payouts

### 11.5 Payroll Export (HRBP)
1. As Suhanee (HRBP), check if there's an export/download option on the payouts page
2. If available, download the CSV and verify it contains: name, department, rating, multiplier, payout

---

## PHASE 12: COMMAND PALETTE & HELP

### 12.1 Command Palette
1. Press **Ctrl+K** (or Cmd+K on Mac)
2. Verify the command palette opens
3. Type "calibration" — verify a navigation suggestion appears
4. Type "team" — verify manager navigation shows
5. Press Escape — verify it closes
6. Test with each role login to verify role-appropriate commands

### 12.2 Help System
1. Check for a help icon (?) on pages — hover or click
2. Verify contextual help content loads for the current page
3. Go to `/docs` — verify comprehensive documentation

---

## PHASE 13: PROFILE & SETTINGS

### 13.1 Employee Profile (Login as Rishu)
1. Go to `/employee/profile`
2. Verify:
   - [ ] Name, email, department displayed
   - [ ] Manager/reporting chain shown
   - [ ] Designation visible (if set)
   - [ ] No sensitive data exposed (variable pay shouldn't be visible to employee)

---

## PHASE 14: EDGE CASES & NEGATIVE TESTING

### 14.1 Unauthorized Access
1. Login as Rishu (employee)
2. Try navigating to `/admin` — should redirect to /unauthorized
3. Try `/hrbp/calibration` — should redirect to /unauthorized
4. Try `/manager` — should redirect to /unauthorized (Rishu has no direct reports)

### 14.2 Invalid URLs
1. Go to `/admin/cycles/nonexistent-uuid` — should show 404 or redirect
2. Go to `/manager/nonexistent-uuid/review` — should handle gracefully
3. Go to `/employee/goals/fake-id` — should show 404 or error

### 14.3 Concurrent Session
1. Open two browser tabs as different users (use incognito for second)
2. Verify each session maintains its own authentication

### 14.4 Form Double-Submit
1. On any form, click Submit rapidly multiple times
2. Verify the button disables after first click (shows "Submitting...")
3. Verify no duplicate records are created

### 14.5 Long Text Input
1. On any comment/description field, paste a very long text (1000+ characters)
2. Verify it saves without error
3. Verify it displays with proper text wrapping (no horizontal overflow)

### 14.6 Special Characters
1. In any text field, enter: `<script>alert('xss')</script>`
2. Verify it's rendered as plain text, NOT executed as HTML
3. Try: `'; DROP TABLE users; --` — verify SQL injection is handled

---

## PHASE 15: SMOKE TEST — EVERY PAGE LOADS

Visit EVERY page below and verify it loads without errors. Mark ✓ or ✗:

### Admin (Login as Raghav)
- [ ] `/admin`
- [ ] `/admin/cycles`
- [ ] `/admin/cycles/new`
- [ ] `/admin/users`
- [ ] `/admin/users/new`
- [ ] `/admin/users/upload`
- [ ] `/admin/departments`
- [ ] `/admin/roles`
- [ ] `/admin/competencies`
- [ ] `/admin/kpi-templates`
- [ ] `/admin/kpi-templates/new`
- [ ] `/admin/kra-templates`
- [ ] `/admin/kra-templates/new`
- [ ] `/admin/review-templates`
- [ ] `/admin/email-templates`
- [ ] `/admin/notifications`
- [ ] `/admin/payout-config`
- [ ] `/admin/payouts`
- [ ] `/admin/reports`
- [ ] `/admin/mis`
- [ ] `/admin/mis/settings`
- [ ] `/admin/audit-log`
- [ ] `/docs`

### HRBP (Login as Suhanee, HRBP view)
- [ ] `/hrbp`
- [ ] `/hrbp/meetings`
- [ ] `/hrbp/calibration`
- [ ] `/hrbp/employees`
- [ ] `/hrbp/payouts`
- [ ] `/hrbp/reports`
- [ ] `/hrbp/mis`
- [ ] `/hrbp/audit-log`
- [ ] `/hrbp/my-review`

### Manager (Login as Suhanee, Manager view)
- [ ] `/manager`
- [ ] `/manager/payouts`
- [ ] `/manager/reports`
- [ ] `/manager/mis`
- [ ] `/manager/my-review`

### Employee (Login as Rishu)
- [ ] `/employee`
- [ ] `/employee/history`
- [ ] `/employee/goals`
- [ ] `/employee/feedback`
- [ ] `/employee/peer-reviews`
- [ ] `/employee/profile`
- [ ] `/employee/mis`

---

## BUG REPORT FORMAT

For each issue found, use this exact format:

```
## BUG: [Short descriptive title]
- **Severity:** Critical / High / Medium / Low
- **Page:** /path/to/page
- **Logged in as:** [name] ([role])
- **Steps to reproduce:**
  1. Step one
  2. Step two
  3. ...
- **Expected:** What should happen
- **Actual:** What actually happened
- **Screenshot description:** [describe what you see on screen]
```

**Severity Guide:**
- **Critical:** Data leak (e.g., employee sees confidential data), security bypass, data loss, complete page crash
- **High:** Core feature broken (can't submit review, can't advance cycle), blocking workflow
- **Medium:** Feature works but has wrong data (wrong formatting, wrong calculations), confusing UX
- **Low:** Cosmetic issues, minor UX improvements, missing convenience features

---

## FINAL REPORT TEMPLATE

After completing ALL phases, provide:

### 1. Executive Summary
One paragraph overview of system health.

### 2. Test Results by Phase
| Phase | Status | Critical | High | Medium | Low |
|-------|--------|----------|------|--------|-----|
| Phase 1: Auth | Pass/Fail | 0 | 0 | 0 | 0 |
| Phase 2: Admin Features | Pass/Fail | 0 | 0 | 0 | 0 |
| Phase 3: Cycle Lifecycle | Pass/Fail | 0 | 0 | 0 | 0 |
| Phase 4: Discussion Meeting | Pass/Fail | 0 | 0 | 0 | 0 |
| Phase 5: Manager Review | Pass/Fail | 0 | 0 | 0 | 0 |
| Phase 6: Calibration | Pass/Fail | 0 | 0 | 0 | 0 |
| Phase 7: Peer Reviews | Pass/Fail | 0 | 0 | 0 | 0 |
| Phase 8: Goals | Pass/Fail | 0 | 0 | 0 | 0 |
| Phase 9: Feedback | Pass/Fail | 0 | 0 | 0 | 0 |
| Phase 10: MIS | Pass/Fail | 0 | 0 | 0 | 0 |
| Phase 11: Reports & Payouts | Pass/Fail | 0 | 0 | 0 | 0 |
| Phase 12: Command Palette | Pass/Fail | 0 | 0 | 0 | 0 |
| Phase 13: Profile | Pass/Fail | 0 | 0 | 0 | 0 |
| Phase 14: Edge Cases | Pass/Fail | 0 | 0 | 0 | 0 |
| Phase 15: Smoke Test | Pass/Fail | 0 | 0 | 0 | 0 |
| **TOTAL** | | 0 | 0 | 0 | 0 |

### 3. All Bugs (sorted by severity)
List every bug found with full details.

### 4. Security Assessment
- Unauthorized access attempts: all blocked? ✓/✗
- Confidential data (MOM concerns) hidden from employees? ✓/✗
- XSS/injection prevention: working? ✓/✗
- Form double-submit prevention: working? ✓/✗

### 5. Data Integrity Checks
- KPI weights sum correctly? ✓/✗
- Payout calculations correct? ✓/✗
- Notification messages readable? ✓/✗
- KPI unit formatting correct (no spurious %)? ✓/✗
- Calibration override persists in dropdown? ✓/✗
- Sent feedback visible in "Sent" section? ✓/✗

### 6. Features Working Perfectly
List all features that passed without issues.

### 7. UI/UX Observations
Layout, responsiveness, readability, navigation flow notes.

### 8. Performance Notes
Page load times, any laggy interactions.

### 9. Top 5 Recommendations (prioritized)
Most impactful fixes or improvements.
