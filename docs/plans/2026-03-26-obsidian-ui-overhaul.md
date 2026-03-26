# Obsidian UI/UX Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the hRMS Performance System from a light utilitarian UI into a cinematic dark-first design with glassmorphism, bento grids, animated data viz, and rich micro-interactions.

**Architecture:** CSS-first approach — all visual changes via globals.css tokens + Tailwind classes + inline styles. No new npm dependencies. Font swap via next/font/google. Dark mode as default via `<html class="dark">`. Glass effects via `backdrop-filter` + rgba backgrounds. Animations via CSS keyframes + a small `useCountUp` hook for animated numbers.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, CSS custom properties, Google Fonts (Sora + Satoshi), SVG for charts

---

## Task 1: Foundation — Dark Theme + Fonts + Glass Tokens

**Files:**
- Modify: `src/app/globals.css` (full rewrite of theme tokens + add glass/animation utilities)
- Modify: `src/app/layout.tsx` (swap fonts to Sora + Satoshi, add `dark` class to html)

**Step 1: Rewrite globals.css**

Replace the entire `:root` and `.dark` blocks. Make `.dark` the visual default (applied on `<html>`). Add glass utility classes, enhanced animations, gradient mesh, noise texture, glow utilities.

Key new tokens:
```css
/* Glass system */
--glass-bg: rgba(255, 255, 255, 0.03);
--glass-border: rgba(255, 255, 255, 0.08);
--glass-hover: rgba(255, 255, 255, 0.06);
--glass-glow: 0 0 20px oklch(0.5 0.2 265 / 0.15);

/* Gradient mesh orbs */
--mesh-1: oklch(0.45 0.18 265 / 0.15);
--mesh-2: oklch(0.5 0.2 310 / 0.1);
--mesh-3: oklch(0.45 0.15 200 / 0.08);
```

Key new utility classes:
- `.glass` — backdrop-blur + glass-bg + glass-border
- `.glass-hover` — enhanced glass on hover with glow
- `.glass-glow` — border glow effect
- `.gradient-mesh` — positioned gradient orbs background
- `.noise-overlay` — grain texture via SVG data URI
- `.glow-button` — primary button with glow shadow
- `.animate-scale-in` — scale + opacity entrance
- `.animate-counter` — for number tick-up
- `.gradient-divider` — horizontal gradient line
- `.bento-grid` — CSS grid with auto-sizing cells

**Step 2: Swap fonts in layout.tsx**

Replace `Geist` + `Geist_Mono` with:
- `Sora` (variable weight, for headings — geometric, modern)
- `Satoshi` is not on Google Fonts, use `DM_Sans` as the body font (clean, readable, already used on login)
- Add `className="dark"` to `<html>` element

**Step 3: Verify**

Run dev server, check that dark mode applies globally, fonts load, no build errors.

**Step 4: Commit**
```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat: obsidian foundation — dark theme, Sora font, glass tokens, animation utilities"
```

---

## Task 2: Glass Sidebar with Gradient Mesh

**Files:**
- Modify: `src/components/sidebar.tsx`

**Step 1: Redesign sidebar**

Transform the current dark sidebar into a glass sidebar:
- Background: glass effect over a gradient mesh (subtle colored orbs behind the blur)
- Active nav item: animated gradient pill (indigo shimmer) instead of static bg
- Nav items: subtle glow on hover
- Logo mark: glow ring around it
- User avatar at bottom: role-colored ring (indigo=admin, emerald=employee, amber=manager, purple=hrbp)
- Dividers: gradient fade lines instead of solid borders
- Search trigger: glass input style

Key CSS classes to use: `.glass`, role-color mapping for avatar ring.

**Step 2: Verify**

Desktop: sidebar renders with glass effect, gradient mesh visible behind blur.
Mobile: hamburger opens glass sidebar with backdrop.

**Step 3: Commit**
```bash
git add src/components/sidebar.tsx
git commit -m "feat: glass sidebar with gradient mesh, animated active states, role-colored avatars"
```

---

## Task 3: Dashboard Layout — Glass Header + Mesh Background

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

**Step 1: Add gradient mesh to main content area**

- Wrap the `<main>` content in a container that has the gradient mesh background (subtle, low-opacity colored orbs positioned with CSS)
- Make the header a glass bar (backdrop-blur, semi-transparent)
- Add noise texture overlay on the background
- Keep the greeting and notification bell

The mesh background should have 2-3 radial gradients positioned at different corners, very low opacity, creating a subtle atmospheric effect behind all dashboard content.

**Step 2: Verify**

Check that the gradient mesh is subtle (not distracting), header has glass effect, content is readable.

**Step 3: Commit**
```bash
git add src/app/(dashboard)/layout.tsx
git commit -m "feat: glass header + gradient mesh background on dashboard"
```

---

## Task 4: Animated Counter Hook

**Files:**
- Create: `src/hooks/use-count-up.ts`

**Step 1: Create the hook**

A simple React hook that animates a number from 0 to target value over a duration:
```typescript
export function useCountUp(target: number, duration = 1200): number
```
- Uses `requestAnimationFrame`
- Easing: ease-out cubic
- Returns current animated value
- Triggers on mount or when target changes

**Step 2: Verify**

Import in a test page, confirm numbers animate from 0 to target smoothly.

**Step 3: Commit**
```bash
git add src/hooks/use-count-up.ts
git commit -m "feat: useCountUp hook for animated number counters"
```

---

## Task 5: Admin Dashboard — Bento Grid with Animated Metrics

**Files:**
- Modify: `src/app/(dashboard)/admin/page.tsx`

**Step 1: Rebuild as bento grid**

Transform the current 2-column layout into a 6-cell bento grid:

```
┌──────────────────┬──────────┬──────────┐
│                  │  Active  │  Depts   │
│  Cycle Health    │  Users   │  Count   │
│  (large, 2x2)   │ (counter)│ (counter)│
├─────────┬────────┼──────────┴──────────┤
│  Self   │ Mgr    │                     │
│ Reviews │Reviews │   Role Breakdown    │
│ (donut) │(donut) │   (bar chart)       │
└─────────┴────────┴─────────────────────┘
```

Each cell is a glass card (`.glass` class) with:
- Animated counter for numbers (useCountUp hook, client component wrapper)
- SVG donut charts for review completion (animated stroke on mount)
- Gradient dividers between sections
- Glow border on the cycle health card if overdue

**Step 2: Create `AdminMetricCard` client component**

A small client component that uses `useCountUp` to animate the number display. Accepts `value`, `label`, `suffix` props.

**Step 3: Create `AnimatedDonut` client component**

SVG donut chart with animated stroke-dasharray. Accepts `percent`, `color`, `label` props. Animates from 0 to target on mount using CSS animation.

**Step 4: Verify**

Check bento grid renders, numbers animate, donuts animate, glass effect visible.

**Step 5: Commit**
```bash
git add src/app/(dashboard)/admin/page.tsx src/hooks/use-count-up.ts
git commit -m "feat: admin bento grid dashboard with animated metrics and glass cards"
```

---

## Task 6: Employee Dashboard — Hero Action + Glass KPIs

**Files:**
- Modify: `src/app/(dashboard)/employee/page.tsx`

**Step 1: Redesign layout**

- **Hero action card** (full-width): glass card with gradient border glow matching urgency. Large text, prominent CTA. Uses the ActionInbox logic but displayed as a single dramatic hero.
- **KPI section**: horizontal glass cards in a row, each with a progress bar that animates on mount
- **Cycle timeline**: vertical timeline with glowing current-step indicator (pulsing dot)
- **Final results** (when published): glass card with large animated rating display

**Step 2: Verify**

Check hero card renders with glow, KPIs have animated progress bars, timeline has glow states.

**Step 3: Commit**
```bash
git add src/app/(dashboard)/employee/page.tsx
git commit -m "feat: employee dashboard — hero action card, glass KPIs, glowing timeline"
```

---

## Task 7: Manager Dashboard — Team Bento with Avatars

**Files:**
- Modify: `src/app/(dashboard)/manager/page.tsx`

**Step 1: Redesign team cards as bento grid**

- Summary bar at top: glass card with animated counter (submitted/total), progress ring
- Team member cards: glass cards in a responsive grid (2-3 cols on desktop)
  - Each card has: avatar with role ring, name, department, inline status pills
  - Mini progress bar showing self-review + manager-review completion
  - Action buttons with glow on hover
  - Cards that need review have a pulsing border glow (amber)
  - Completed cards have a subtle green glow

**Step 2: Verify**

Check team grid renders, avatar rings show, progress bars animate, glow states work.

**Step 3: Commit**
```bash
git add src/app/(dashboard)/manager/page.tsx
git commit -m "feat: manager team bento grid with glass cards, avatars, animated progress"
```

---

## Task 8: Glass Tables + Glow Rows

**Files:**
- Modify: `src/app/(dashboard)/admin/cycles/page.tsx`
- Modify: `src/app/(dashboard)/admin/users/page.tsx` (the users-table component)
- Modify: `src/app/(dashboard)/hrbp/calibration/page.tsx`

**Step 1: Update table styling**

Replace standard bordered tables with glass tables:
- Table container: glass card
- Header row: slightly brighter glass bg
- Body rows: transparent with glass hover (subtle glow border on hover)
- Active/selected rows: glass-glow border
- Alternating rows: very subtle opacity difference

Apply to all three table pages.

**Step 2: Verify**

Check tables render with glass effect, hover glow works, header is distinct.

**Step 3: Commit**
```bash
git add src/app/(dashboard)/admin/cycles/page.tsx src/app/(dashboard)/admin/users/page.tsx src/app/(dashboard)/hrbp/calibration/page.tsx
git commit -m "feat: glass tables with glow hover rows across admin and HRBP pages"
```

---

## Task 9: HRBP Reports — Animated Data Viz

**Files:**
- Modify: `src/app/(dashboard)/hrbp/reports/page.tsx`

**Step 1: Redesign with animated charts**

- Completion rate cards: large animated counters in glass cards
- Rating distribution: horizontal bar chart with animated width transitions (bars grow from left on mount)
- Department breakdown: glass list with subtle sparkline-style employee count bars
- Each cycle section: glass card with gradient header

**Step 2: Verify**

Check animated bars grow on page load, counters tick up, glass cards render.

**Step 3: Commit**
```bash
git add src/app/(dashboard)/hrbp/reports/page.tsx
git commit -m "feat: HRBP reports with animated bar charts, counters, glass cards"
```

---

## Task 10: Component Polish — Notifications, Timeline, Action Inbox

**Files:**
- Modify: `src/components/notification-bell.tsx`
- Modify: `src/components/cycle-timeline.tsx`
- Modify: `src/components/action-inbox.tsx`
- Modify: `src/components/cycle-status-badge.tsx`

**Step 1: Glass notification panel**

Notification dropdown: glass card with blur, items have subtle glow on unread.

**Step 2: Glowing timeline**

Cycle timeline: current step has a pulsing glow dot (CSS animation), completed steps have a check with muted glow, future steps are dim.

**Step 3: Glass action inbox**

Action cards: glass with urgency-colored border glow (red pulse for critical, amber for warning, blue for info, green for success).

**Step 4: Status badge glow**

Cycle status badges: add subtle text-shadow glow matching badge color.

**Step 5: Verify**

Check all components render with glass/glow effects.

**Step 6: Commit**
```bash
git add src/components/notification-bell.tsx src/components/cycle-timeline.tsx src/components/action-inbox.tsx src/components/cycle-status-badge.tsx
git commit -m "feat: glass notifications, glowing timeline, urgency glow action inbox"
```

---

## Task 11: Remaining Pages Polish

**Files:**
- Modify: `src/app/(dashboard)/employee/goals/page.tsx`
- Modify: `src/app/(dashboard)/employee/feedback/page.tsx`
- Modify: `src/app/(dashboard)/employee/profile/page.tsx`
- Modify: `src/app/(dashboard)/employee/history/page.tsx`
- Modify: `src/app/(dashboard)/hrbp/page.tsx`

**Step 1: Apply glass cards to all remaining pages**

Every card/section should use the `.glass` utility class. Replace `rounded-lg border` patterns with glass styling. Add gradient dividers between major sections.

**Step 2: Profile page**

Add avatar with role-colored ring at top of profile. Glass card for info grid.

**Step 3: Goals page**

Goal cards: glass with progress bar glow matching status color. Add goal form: glass card.

**Step 4: Verify**

Navigate through all pages, confirm glass effect is consistent.

**Step 5: Commit**
```bash
git add src/app/(dashboard)/employee/ src/app/(dashboard)/hrbp/page.tsx
git commit -m "feat: glass polish across employee pages, goals, feedback, profile, HRBP overview"
```

---

## Task 12: Login Page Dark Polish

**Files:**
- Modify: `src/app/login/page.tsx`

**Step 1: Unify with dark theme**

The login page currently has its own inline CSS. Update the right panel to match the dark theme:
- Right panel: dark background matching the left panel, glass card for the form
- Form inputs: glass-styled (transparent bg, glass border)
- Quick-fill pills: glass style with glow on hover
- Sign In button: glow button style
- Keep the left panel blob effects (they already look great)

**Step 2: Verify**

Check login renders as cohesive dark design, form is readable, blobs still animate.

**Step 3: Commit**
```bash
git add src/app/login/page.tsx
git commit -m "feat: login page dark unification — glass form, glow buttons, cohesive dark aesthetic"
```

---

## Task 13: Final Verification + Screenshot Proof

**Files:** None (verification only)

**Step 1: Run TypeScript check**
```bash
npx tsc --noEmit
```

**Step 2: Start dev server and verify all pages**

Navigate through every page in the following order:
1. Login page (dark + glass form)
2. Admin dashboard (bento grid + animated metrics)
3. Admin users (glass table)
4. Admin cycles (glass table + progress)
5. Employee dashboard (hero action + glass KPIs)
6. Employee goals (glass goal cards)
7. Employee profile (avatar + glass info)
8. Employee feedback (glass form)
9. Manager team (bento grid + avatars)
10. HRBP overview (glass cycle cards)
11. HRBP reports (animated charts)
12. HRBP calibration (glass table)

**Step 3: Check mobile view**

Resize to mobile, verify hamburger menu works, content is readable.

**Step 4: Take screenshots as proof**

**Step 5: Final commit**
```bash
git add -A
git commit -m "feat: obsidian UI overhaul complete — dark glassmorphism, bento grids, animated data viz"
```
