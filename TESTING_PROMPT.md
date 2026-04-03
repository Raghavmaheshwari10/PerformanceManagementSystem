# PMS End-to-End Testing Prompt

Copy-paste the section below (from "You are testing..." onwards) into the Claude Chrome Extension to run a full end-to-end test of the PMS app.

---

You are testing a Performance Management System (PMS) at https://pms.emb.global. Your goal is to run a complete end-to-end test of every major feature, create real test data, and report any bugs or issues found.

## TEST ACCOUNTS

| Role | Email | Password | Name | Notes |
|------|-------|----------|------|-------|
| Admin | raghav.maheshwari@emb.global | Simran@1010 | Raghav Maheshwari | Full admin access |
| HRBP + Manager | suhanee.kesharwani@emb.global | Welcome@123 | Suhanee Kesharwani | HRBP role, also acts as manager of Rishu |
| Employee | rishu.dutta@emb.global | Rishu@2709 | Rishu Dutta | Employee in HR dept, manager is Suhanee |

**Important:** Suhanee Kesharwani serves dual roles — she is both the HRBP and the direct manager of Rishu Dutta. When testing manager features, login as Suhanee and switch to the Manager view using the role switcher in the sidebar.

---

## PHASE 1: ADMIN SETUP (Login as Raghav — Admin)

### 1.1 Login
1. Navigate to https://pms.emb.global/login
2. Login with: raghav.maheshwari@emb.global / Simran@1010
3. Verify you land on the admin dashboard at `/admin`

### 1.2 Assign HRBP to HR Department
1. Go to `/admin/users`
2. Find **Suhanee Kesharwani** in the list and click **Edit**
3. Her role should already be "hrbp" — scroll down to the **department assignment checkboxes**
4. Check the **"HR"** department checkbox (this links Suhanee as HRBP for the HR dept)
5. Click **Save**
6. Verify the assignment saved successfully

### 1.3 Create Competencies
1. Go to `/admin/competencies`
2. Create these competencies (if they don't already exist):
   - **Communication** — "Ability to convey ideas clearly and listen effectively"
   - **Leadership** — "Ability to guide, motivate, and develop team members"
   - **Problem Solving** — "Analytical thinking and creative problem resolution"
3. Verify all 3 appear in the list

### 1.4 Create a Review Template
1. Go to `/admin/review-templates`
2. Click "New Template"
3. Name: **"E2E Test Review Template"**
4. Description: "End-to-end test competency assessment template"
5. Add 3 questions (link each to a competency created above):
   - "How effectively does this person communicate with team members?" — Competency: Communication, Type: Rating, Required: Yes
   - "Does this person demonstrate leadership qualities?" — Competency: Leadership, Type: Mixed, Required: Yes
   - "Rate problem-solving ability in complex situations" — Competency: Problem Solving, Type: Rating, Required: Yes
6. Save the template and verify it appears in the list

### 1.5 Create KRA Templates
1. Go to `/admin/kra-templates/new` and create:
   - **"Revenue & Sales"** — Category: performance, Weight: 40
   - **"Operational Excellence"** — Category: performance, Weight: 35
   - **"Learning & Development"** — Category: learning, Weight: 25
2. Verify all 3 appear in the list

### 1.6 Create KPI Templates
1. Go to `/admin/kpi-templates/new` and create these:

| Title | KRA Template | Unit | Target | Weight |
|-------|-------------|------|--------|--------|
| Quarterly Revenue | Revenue & Sales | number | 5000000 | 50 |
| New Client Acquisition | Revenue & Sales | number | 10 | 50 |
| Process Compliance Score | Operational Excellence | percent | 95 | 60 |
| SLA Achievement | Operational Excellence | percent | 98 | 40 |
| Training Hours Completed | Learning & Development | number | 40 | 100 |

2. Verify all 5 appear in the templates list

### 1.7 Create a Review Cycle
1. Go to `/admin/cycles/new`
2. Fill in:
   - Name: **"E2E Test Cycle Q1 2026"**
   - Quarter: Q1
   - Year: 2026
   - Scope: Department-scoped — select **"HR"** department
   - Review Template: **"E2E Test Review Template"**
   - Competency Weight: **30**
   - Deadlines (all in the future):
     - KPI Setting: tomorrow's date
     - Self Review: 5 days from now
     - Manager Review: 10 days from now
     - Calibration: 15 days from now
3. Save and verify the cycle appears in the list with status "draft"

---

## PHASE 2: KPI SETTING

### 2.1 Advance Cycle to KPI Setting (Admin)
1. Go to `/admin/cycles` — click on **"E2E Test Cycle Q1 2026"**
2. Find the "HR" department row
3. Click the advance button to move from `draft` to `kpi_setting`
4. Verify the status badge updates to "kpi_setting"

### 2.2 Manager Sets KRAs & KPIs (Login as Suhanee — Manager view)
1. **Logout** from admin
2. **Login as Suhanee**: suhanee.kesharwani@emb.global / Welcome@123
3. Use the **role switcher** in the sidebar to switch to **Manager** view
4. Go to `/manager` — verify **Rishu Dutta** appears in your team list
5. Click on Rishu Dutta — go to the KPIs tab
6. Create KRAs:
   - **"Revenue & Sales"** — category: performance, weight: 40
   - **"Operational Excellence"** — category: performance, weight: 35
   - **"Learning & Development"** — category: learning, weight: 25
7. Create KPIs under each KRA:
   - Under Revenue & Sales: "Quarterly Revenue" (unit: number, target: 5000000, weight: 50), "New Clients" (unit: number, target: 10, weight: 50)
   - Under Operational Excellence: "Process Compliance" (unit: percent, target: 95, weight: 60), "SLA Achievement" (unit: percent, target: 98, weight: 40)
   - Under Learning & Development: "Training Hours" (unit: number, target: 40, weight: 100)
8. Click **"Finalize KPIs"**
9. Verify:
   - [ ] All 5 KPIs show correctly grouped under their KRAs
   - [ ] Weights add up correctly per KRA (50+50=100, 60+40=100, 100)
   - [ ] KRA weights: 40+35+25=100

---

## PHASE 3: SELF REVIEW

### 3.1 Advance to Self Review (Admin)
1. **Logout** — **Login as Raghav** (admin)
2. Go to the cycle — advance HR department from `kpi_setting` to `self_review`

### 3.2 Employee Submits Self Review (Login as Rishu)
1. **Logout** — **Login as Rishu**: rishu.dutta@emb.global / Rishu@2709
2. You should land on the employee dashboard showing **"My Review — E2E Test Cycle Q1 2026"**
3. Verify:
   - [ ] KRAs and KPIs are displayed correctly with targets and weights
   - [ ] Hero action card says "Complete your self-review"
   - [ ] Deadline banner shows the self-review deadline
   - [ ] Cycle timeline component shows current phase
4. Fill in the self-review:
   - Fill achievement for each KPI: Revenue: 4500000, New Clients: 8, Compliance: 92, SLA: 97, Training: 35
   - Rate each KPI: mix of ME and EE ratings
   - If competency questions appear (Communication, Leadership, Problem Solving), rate each 3-5 stars and add a short text response for each
   - Overall self-rating: **EE**
   - Self-comments: "I delivered strong results across revenue and operational metrics this quarter. Exceeded client acquisition expectations and maintained high SLA compliance. Plan to focus more on training hours next quarter."
5. Click **Submit**
6. Verify:
   - [ ] Success confirmation appears
   - [ ] Status shows "Self-review submitted" with green badge
   - [ ] Form becomes read-only
   - [ ] Hero card updates to "Self-review submitted"

---

## PHASE 4: REVIEW DISCUSSION MEETING

### 4.1 Advance to Manager Review (Admin)
1. **Logout** — **Login as Raghav** (admin)
2. Go to the cycle — advance HR department from `self_review` to `manager_review`
3. Verify status changes

### 4.2 HRBP Schedules Discussion Meeting (Login as Suhanee — HRBP view)
1. **Logout** — **Login as Suhanee**: suhanee.kesharwani@emb.global / Welcome@123
2. Make sure you're in **HRBP view** (use role switcher)
3. Go to `/hrbp/meetings` (should appear as "Meetings" in sidebar)
4. Verify:
   - [ ] "E2E Test Cycle Q1 2026" cycle section appears
   - [ ] Rishu Dutta shows with status badge "Needs Scheduling"
   - [ ] Summary counts show "1 pending"
5. Click **"Schedule"** button on Rishu's row
6. In the modal:
   - Set date/time: tomorrow at 11:00 AM
   - Duration: 60 minutes
   - Note the info box about Google Meet link generation
7. Click **"Schedule Meeting"**
8. Verify:
   - [ ] Status badge changes to "Scheduled" (blue)
   - [ ] Date and time display correctly
   - [ ] A Meet link appears (either Google Calendar generated or fallback)
   - [ ] "Join" button (blue) appears next to the time
   - [ ] "Add MOM" button (green) appears as the action
   - [ ] Summary counts update to "1 scheduled"

### 4.3 Verify Manager Review is LOCKED (Login as Suhanee — Manager view)
1. Switch to **Manager view** using the role switcher
2. Go to `/manager` — click on **Rishu Dutta** — go to the Review tab
3. Verify:
   - [ ] A **blue banner** shows "Discussion Meeting Scheduled" with the date, time, and "Join Google Meet" button
   - [ ] The right panel shows a **lock icon** with "Review Form Locked"
   - [ ] The message says meeting must be completed before submitting
   - [ ] There is **NO review form visible** — manager cannot submit anything
4. **This is critical** — try to see if there's any way to bypass the lock. There should be none.

### 4.4 Verify Employee Sees Meeting Info (Login as Rishu)
1. **Logout** — **Login as Rishu**: rishu.dutta@emb.global / Rishu@2709
2. Go to `/employee`
3. Verify:
   - [ ] A **blue meeting banner** appears showing "Review Discussion Meeting Scheduled"
   - [ ] Shows date, time, manager name (Suhanee Kesharwani), HRBP name (Suhanee Kesharwani)
   - [ ] "Join Google Meet" button is visible and clickable

### 4.5 HRBP Submits Minutes of Meeting (Login as Suhanee — HRBP view)
1. **Logout** — **Login as Suhanee**: suhanee.kesharwani@emb.global / Welcome@123
2. Switch to **HRBP view**
3. Go to `/hrbp/meetings`
4. Click **"Add MOM"** button on Rishu's row
5. Fill in the structured MOM form:
   - **Key Discussion Points:** "Discussed Q1 performance across all KRAs. Rishu demonstrated strong revenue results with Rs 45L against 50L target. Client acquisition was good at 8 vs 10 target. Training hours fell short at 35 vs 40 target — needs improvement."
   - **Employee's Strengths Highlighted:** "Strong revenue focus and excellent client relationship management. Proactive approach to SLA management with 97% achievement. Takes full ownership of deliverables and shows initiative."
   - **Areas for Improvement Discussed:** "Needs to prioritize learning and development — training hours at 35/40. Process compliance score at 92% vs 95% target needs attention. Should create a weekly compliance tracking routine."
   - **Action Items:**
     - Item 1: Description: "Complete 10 additional training hours", Owner: "Rishu Dutta", Deadline: 2 weeks from now
     - Item 2: Description: "Create weekly compliance checklist and follow it", Owner: "Rishu Dutta", Deadline: 1 week from now
     - Click "+ Add action item" to add a third: Description: "Schedule monthly learning review with manager", Owner: "Suhanee Kesharwani", Deadline: 1 month from now
   - **Check** the "Employee agrees with the discussion points" checkbox
   - **Concerns Raised (Confidential):** "Rishu seemed slightly disengaged during the learning & development discussion. May indicate lack of motivation in upskilling areas. Manager should follow up in next 1:1 to understand if there are external factors."
6. Click **"Submit MOM & Complete Meeting"**
7. Verify:
   - [ ] Status changes to **"Completed"** (green badge)
   - [ ] Summary shows "1 done"
   - [ ] **"View MOM"** button appears
8. Click **"View MOM"** and verify:
   - [ ] All 5 sections display correctly with the text you entered
   - [ ] 3 action items show with owners and deadlines
   - [ ] "Employee agrees" badge shows in green
   - [ ] **Concerns section IS visible** (you're the HRBP)

### 4.6 Verify Employee Sees FILTERED MOM (Login as Rishu)
1. **Logout** — **Login as Rishu**: rishu.dutta@emb.global / Rishu@2709
2. Go to `/employee`
3. Verify:
   - [ ] Meeting banner is now **green** — "Review Discussion Completed"
   - [ ] Shows completion date
   - [ ] Click **"View Discussion Summary"** (expandable)
   - [ ] **Key Discussion Points** — visible and correct
   - [ ] **Strengths Highlighted** — visible and correct
   - [ ] **Areas for Improvement** — visible and correct
   - [ ] **Action Items** — all 3 visible with owners and deadlines
   - [ ] **Employee Agreement** — shows "You agreed with the discussion points"
   - [ ] **CRITICAL: "Concerns Raised" section must NOT be visible** — this is confidential HRBP+Manager only content. If you can see the concerns about disengagement, that is a **critical bug**.

### 4.7 Verify Manager Review is NOW UNLOCKED (Login as Suhanee — Manager view)
1. **Logout** — **Login as Suhanee**: suhanee.kesharwani@emb.global / Welcome@123
2. Switch to **Manager view**
3. Go to `/manager` — click Rishu Dutta — Review tab
4. Verify:
   - [ ] **Green banner** shows "Discussion Meeting Completed — Review Unlocked"
   - [ ] Click "View Meeting Minutes" — expandable section shows full MOM
   - [ ] **Concerns section IS visible** here (manager can see it)
   - [ ] The **review form is NOW visible and active** — no more lock icon
   - [ ] Employee's self-assessment shows on the left panel

---

## PHASE 5: MANAGER REVIEW

### 5.1 Manager Submits Review (Suhanee — Manager view, continued)
1. You should still be on the review page for Rishu
2. Fill in the manager review:
   - Rate each KPI individually:
     - Quarterly Revenue: ME
     - New Clients: EE
     - Process Compliance: SME
     - SLA Achievement: ME
     - Training Hours: SME
   - If competency questions appear (Communication, Leadership, Problem Solving):
     - Communication: 4 stars, text: "Communicates clearly in team meetings"
     - Leadership: 3 stars, text: "Shows potential but needs more initiative"
     - Problem Solving: 4 stars, text: "Good analytical approach to challenges"
   - Overall Manager Rating: **ME**
   - Manager Comments: "Rishu delivered solid revenue and SLA performance. Client acquisition was strong at 8 new clients. However, compliance and training fell below targets. Need to see focused improvement in process discipline and upskilling. The discussion meeting highlighted key growth areas that Rishu has committed to addressing."
3. Click **Submit**
4. Verify:
   - [ ] Success message appears
   - [ ] Rating shows "ME" as submitted
   - [ ] Form becomes read-only
   - [ ] Message says "Submitted. Contact your HRBP to request changes."

---

## PHASE 6: CALIBRATION & PUBLISHING

### 6.1 Advance to Calibration (Admin)
1. **Logout** — **Login as Raghav** (admin): raghav.maheshwari@emb.global / Simran@1010
2. Go to the cycle page — advance HR department from `manager_review` to `calibrating`

### 6.2 HRBP Calibrates (Login as Suhanee — HRBP view)
1. **Logout** — **Login as Suhanee**: suhanee.kesharwani@emb.global / Welcome@123
2. Switch to **HRBP view**
3. Go to `/hrbp/calibration`
4. Verify:
   - [ ] Rishu Dutta appears in the calibration table
   - [ ] Manager Rating shows: ME
   - [ ] Bell curve / distribution chart displays
5. Override Rishu's final rating:
   - New rating: **EE**
   - Justification: "Employee showed strong revenue performance at 90% of target with excellent client acquisition. Manager rating of ME is conservative given the quantitative achievement. Adjusting to EE to reflect overall contribution."
6. Verify the override is saved and reflected in the table

### 6.3 Lock Cycle
1. Click **"Lock"** for the HR department
2. Verify:
   - [ ] Status changes to `locked`
   - [ ] Payout multiplier is calculated based on EE rating
   - [ ] Payout amount is calculated (EE multiplier x Rishu's variable pay)

### 6.4 Publish Results
1. Click **"Publish"**
2. Verify status changes to `published`

### 6.5 Employee Sees Final Results (Login as Rishu)
1. **Logout** — **Login as Rishu**: rishu.dutta@emb.global / Rishu@2709
2. Go to `/employee`
3. Verify:
   - [ ] Hero card shows "Results published" with green success badge
   - [ ] Final rating displayed: **EE**
   - [ ] Payout breakdown is visible with amount
   - [ ] Manager comments are visible (if applicable)

---

## PHASE 7: ADDITIONAL FEATURES

### 7.1 Feedback (Login as Rishu)
1. Go to `/employee/feedback`
2. Send feedback:
   - To: Suhanee Kesharwani
   - Category: Leadership
   - Message: "Great mentoring during Q1. The weekly check-ins were very helpful for my growth. The review discussion meeting was constructive and I appreciated the clear action items."
   - Visibility: Recipient and Manager
3. Click Send
4. Verify feedback appears in the list

### 7.2 Goals (Login as Rishu)
1. Go to `/employee/goals`
2. Create a new goal:
   - Title: "Complete Advanced Project Management Certification"
   - Type: Development
   - Target Value: 1
   - Unit: certification
   - Due date: 3 months from now
   - Description: "Obtain PMP or equivalent certification to improve project delivery skills"
3. Submit the goal
4. Verify it appears in the goals list

### 7.3 Notifications Check
Check the **notification bell** (top-right header) for each user:

**As Rishu (Employee):**
- [ ] Should have received "Meeting Scheduled" notification
- [ ] Should have received "MOM Submitted" / meeting completed notification
- [ ] Should have received "Results Published" notification

**As Suhanee (Manager/HRBP):**
- [ ] Should have received "Self-Review Submitted" notification from Rishu

### 7.4 Employee History (Login as Rishu)
1. Go to `/employee/history`
2. Verify the completed cycle "E2E Test Cycle Q1 2026" shows with EE rating

### 7.5 Audit Log (Login as Suhanee — HRBP view)
1. Go to `/hrbp/audit-log`
2. Verify audit entries exist for:
   - [ ] Meeting scheduled
   - [ ] MOM submitted
   - [ ] Manager review submitted
   - [ ] Rating override during calibration

### 7.6 Docs Page
1. Go to `/docs` (any user)
2. Verify:
   - [ ] Page loads without errors
   - [ ] Table of contents navigation works
   - [ ] Review discussion meeting feature is mentioned in the stage matrix

---

## PHASE 8: SMOKE TEST — ALL PAGES

Login as each user and verify these pages load without errors (no white screen, no 500 error, no "Application error"):

### Admin Pages (Login as Raghav)
- [ ] `/admin` — Dashboard
- [ ] `/admin/cycles` — Cycles list
- [ ] `/admin/users` — Users list
- [ ] `/admin/departments` — Departments
- [ ] `/admin/roles` — Roles
- [ ] `/admin/kpi-templates` — KPI Templates
- [ ] `/admin/kra-templates` — KRA Templates
- [ ] `/admin/mis` — MIS Integration
- [ ] `/admin/competencies` — Competencies
- [ ] `/admin/review-templates` — Review Templates
- [ ] `/admin/email-templates` — Email Templates
- [ ] `/admin/notifications` — Notifications
- [ ] `/admin/payout-config` — Payout Config
- [ ] `/admin/payouts` — Payouts
- [ ] `/admin/reports` — Reports
- [ ] `/admin/audit-log` — Audit Log
- [ ] `/docs` — Documentation

### HRBP Pages (Login as Suhanee, HRBP view)
- [ ] `/hrbp` — Cycles overview
- [ ] `/hrbp/meetings` — Meetings
- [ ] `/hrbp/calibration` — Calibration
- [ ] `/hrbp/employees` — Employees list
- [ ] `/hrbp/payouts` — Payouts
- [ ] `/hrbp/reports` — Reports
- [ ] `/hrbp/mis` — MIS Overview
- [ ] `/hrbp/audit-log` — Audit Log

### Manager Pages (Login as Suhanee, Manager view)
- [ ] `/manager` — Team list
- [ ] `/manager/payouts` — Team Payouts
- [ ] `/manager/reports` — Team Reports
- [ ] `/manager/mis` — MIS Tracking
- [ ] `/manager/my-review` — Manager's own review

### Employee Pages (Login as Rishu)
- [ ] `/employee` — My Review
- [ ] `/employee/history` — My History
- [ ] `/employee/goals` — Goals
- [ ] `/employee/mis` — MIS Targets
- [ ] `/employee/feedback` — Feedback
- [ ] `/employee/profile` — Profile

---

## BUG REPORT FORMAT

For each issue found, report in this format:

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
- **Screenshot:** [describe what you see]
```

---

## FINAL REPORT

After completing ALL phases, provide a structured summary:

### 1. Test Results Summary
| Phase | Status | Issues Found |
|-------|--------|-------------|
| Phase 1: Admin Setup | Pass/Fail | count |
| Phase 2: KPI Setting | Pass/Fail | count |
| Phase 3: Self Review | Pass/Fail | count |
| Phase 4: Discussion Meeting | Pass/Fail | count |
| Phase 5: Manager Review | Pass/Fail | count |
| Phase 6: Calibration & Publish | Pass/Fail | count |
| Phase 7: Additional Features | Pass/Fail | count |
| Phase 8: Smoke Test | Pass/Fail | count |

### 2. Bugs by Severity
- **Critical:** (list)
- **High:** (list)
- **Medium:** (list)
- **Low:** (list)

### 3. Features Working Perfectly
(list all features that passed without any issues)

### 4. UI/UX Observations
(anything that looks off, confusing, or could be improved)

### 5. Performance Notes
(any slow-loading pages, laggy interactions)

### 6. Top 3 Recommendations
(most important fixes or improvements needed)
