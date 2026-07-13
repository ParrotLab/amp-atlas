# AMP Atlas — Design Guide

This is the finalized visual direction for all AMP Atlas screens. Any new page or experience should follow these patterns.

## Final Mockups

- `design/mockups/final-dashboard.html` — Dashboard (home screen)
- `design/mockups/final-editor.html` — Editor (file editing view)

These are the source of truth for the visual language. Open them in a browser to reference.

---

## Visual Foundation

### Color Palette (as used in the app)

| Surface | Value | Usage |
|---------|-------|-------|
| Sidebar background | `#FEFCF9` | Light warm off-white |
| Main area background | `#F5F0EB` | Warm beige |
| Card background | `#FFFFFF` | White, floating on warm bg |
| Editor content | `#FFFFFF` | White card with rounded top corners |
| Borders | `#EDE8E2` | Warm gray, subtle |
| Hover states | `#F0EBE5` | Slightly darker warm |
| Text primary | `#1a1a2e` | Near-black, warm |
| Text secondary | `#6B6966` | Warm gray |
| Text tertiary | `#8E8B87` | Light warm gray |
| Text muted | `#B5B1AC` | Very light |

### Brand Accents

| Color | Value | Usage |
|-------|-------|-------|
| Violet | `#8B2BFF` | Primary interactive, active states, brand |
| Orange | `#FF7B00` | Accent, editing status, highlights |
| Plum | `#3D0052` | Dark accent, AI Operations |
| Green | `#16A34A` / `#22C55E` | Success, synced, published |
| Red | `#FF5C5C` / `#DC2626` | Badges, errors, conflicts |

### System Card Colors (saturated gradients)

- Learning System: `#8B2BFF → #A855FF` (violet)
- Marketing System: `#FF7B00 → #FFB875` (orange)
- AI Operations: `#3D0052 → #7A3D8F` (plum)

### File Change Indicators

| State | Color | Usage |
|-------|-------|-------|
| Unsaved edits | `#C47A0A` (amber) | Filename color + dot |
| Saved, not published | `#8B2BFF` (violet) | Filename color + dot |
| New file | `#16A34A` (green) | Filename color + dot |
| Deleted | `#DC2626` (red) | Strikethrough + dot |
| Folder change count | `#C47A0A` on `rgba(196,122,10,0.12)` | Badge with border |

---

## Layout Patterns

### Window Chrome
- macOS-style: 12px traffic light dots, centered app title, 12px rounded window corners
- App title: "AI Momentum Protocols"
- Window size in mockups: 1320x860px

### Sidebar (Light)
- Width: ~220px
- Background: `#FEFCF9`
- Border-right: `1px solid #EDE8E2`
- **Top:** AMP wordmark logo (~26px height)
- **Middle:** Nav items (Dashboard, Inbox w/ badge, divider, system list, divider, Settings)
- **Bottom:** User avatar (34px) + name + org, separated by border-top
- Nav items: 10px padding, 10px border-radius, violet highlight when active (`rgba(139,43,255,0.08)`)

### Dashboard Layout
- Greeting + date + search + "New Draft" button
- 3 system cards (saturated gradient backgrounds, white text)
- Two-column grid: "Jump Back In" (drafts) + "Quick Stats" + "Recently Edited"
- Activity timeline panel on the right (~280px)

### Editor Layout
- Sidebar: system name + meta at top, search, file tree (Instructions / Playbooks / Files sections), drafts at bottom
- Tab bar: open file tabs + draft selector + status badge + properties toggle
- Editor area: white card floating on warm background, max-width ~720px, generous padding
- Properties drawer: right side, slides open, 280px wide
- Status bar: file change counts + Save/Publish/Discard

---

## Component Patterns

### Cards
- Background: white
- Border-radius: 16px
- Shadow: `0 1px 3px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.03)`
- Hover: lift (`translateY(-1px)`) + deeper shadow
- Padding: 24px

### Status Pills
- Border-radius: 6-8px
- Editing: `background: #FFF7ED; color: #B45309` (or `rgba(255,123,0,0.1)`)
- In Review: `background: rgba(139,43,255,0.08); color: #8B2BFF`
- Synced: `background: #f0fdf4; color: #16a34a`
- Updates: `background: #fff7ed; color: #b45309`

### Nav Items
- Font size: 13px, weight 500
- Default: `color: #6B6966`
- Hover: `background: #F0EBE5; color: #3D3832`
- Active: `background: rgba(139,43,255,0.08); color: #8B2BFF; font-weight: 600`

### Buttons
- Primary: `background: #8B2BFF; color: white; border-radius: 8px`
- Secondary: `background: #F0EBE5; color: #6B6966`
- Subtle: `background: transparent; border: 1px solid #EDE8E2`

---

## Typography in Context

- Page title: 24-28px, weight 700, `#1a1a2e`
- Section title: 15px, weight 700, `#1a1a2e`
- Section label: 11px, weight 600-700, uppercase, letter-spacing 0.06em, `#B0ADA8`
- Body text: 13-15px, weight 400-500, `#5C5955`
- Meta/timestamp: 11-12px, `#8E8B87` or `#B5B1AC`
- Editor title: 34px, weight 700
- Editor body: 15px, line-height 1.75

---

## Pages Still to Mock Up

1. **Inbox** — Full notification/activity stream, filtered by type
2. **Review flow** — Viewing a teammate's draft, seeing diffs, approving/requesting changes
3. **New Draft flow** — Modal/dialog for creating a new draft
4. **System overview** — What you see when you click a system card (before opening a specific file)
5. **Onboarding** — First launch: connect GitHub, select folder, land on dashboard
6. **Settings** — Account, add/manage systems, preferences
