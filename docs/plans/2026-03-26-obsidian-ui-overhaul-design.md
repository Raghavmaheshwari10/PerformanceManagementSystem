# Obsidian UI/UX Overhaul — Design Document

## Overview

Complete visual transformation of the hRMS Performance Management System from a light, utilitarian interface to a cinematic dark-first design with glassmorphism, bento grid layouts, rich data visualizations, and extensive motion design.

## Design Pillars

### 1. Dark-First Editorial Foundation
- Default to dark mode (deep navy-black with blue undertone)
- Typography: Sora (headings) + Satoshi (body) via Google Fonts
- Dramatic spacing with generous padding
- Gradient dividers between sections

### 2. Glassmorphism System
- Cards: `backdrop-blur-xl` + semi-transparent backgrounds + subtle border glow
- Sidebar: glass panel over gradient mesh background
- Notification panel: frosted dropdown
- Modals/popovers: glass with edge glow

### 3. Bento Grid Dashboards
- Admin: 6-cell bento — cycle health (large), sparkline metrics, animated donuts, team pulse
- Employee: asymmetric bento — hero action card, KPI progress with animated fill, timeline with glow
- Manager: team bento grid — progress rings, sparklines, avatar stack
- HRBP Reports: data-viz heavy — animated bars, distribution curves, department heatmap

### 4. Motion & Micro-interactions
- Page transitions: staggered scale + opacity entrance
- Animated counters: numbers tick up from 0
- Progress rings: SVG stroke animation on mount
- Card hover: glow intensification + scale
- Sidebar: animated gradient pill on active item
- Scroll-triggered reveals

### 5. Visual Details
- Gradient mesh backgrounds (low-opacity colored orbs behind content)
- Noise texture overlay on dark surfaces
- Glow effects on primary buttons/active states
- Role-colored avatar rings (indigo=admin, emerald=employee, amber=manager, purple=hrbp)

## Pages Affected (priority order)

1. `globals.css` — Complete theme overhaul (dark-first, glass tokens, animations)
2. `layout.tsx` (root) — Font swap to Sora + Satoshi, dark default
3. `sidebar.tsx` — Glass sidebar with gradient mesh, animated active states
4. `(dashboard)/layout.tsx` — Gradient mesh background, glass header
5. `admin/page.tsx` — Bento grid dashboard with animated metrics
6. `employee/page.tsx` — Hero action card + glassmorphic KPI section
7. `manager/page.tsx` — Team bento grid with avatars and sparklines
8. `hrbp/reports/page.tsx` — Animated chart visualizations
9. `hrbp/calibration/page.tsx` — Glass table with glow rows
10. `admin/cycles/page.tsx` — Glass table + animated progress
11. `admin/users/page.tsx` — Glass table rows
12. `notification-bell.tsx` — Glass dropdown
13. `cycle-timeline.tsx` — Glow states on timeline
14. `action-inbox.tsx` — Glass urgency cards with glow borders
15. `login/page.tsx` — Minor dark polish

## Technical Approach

- CSS-only animations (no external animation libraries needed)
- CSS custom properties for glass tokens
- Tailwind utility classes + custom CSS in globals.css
- Google Fonts for Sora + Satoshi
- No new npm dependencies required

## Color Tokens (Dark Mode Primary)

```
--background:    oklch(0.13, 0.03, 265)     /* deep navy-black */
--card:          oklch(0.16, 0.025, 265)    /* slightly lighter */
--glass-bg:      rgba(255, 255, 255, 0.05)  /* glass surface */
--glass-border:  rgba(255, 255, 255, 0.08)  /* glass edge */
--glass-glow:    oklch(0.55, 0.2, 265)      /* indigo glow */
--accent-glow:   0 0 20px oklch(0.5, 0.2, 265 / 0.3)
```
