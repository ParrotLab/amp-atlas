# Dashboard Redesign — Design Spec

**Date:** 2026-07-11
**Branch:** `feat/ui-improvements`
**Status:** Approved in brainstorming; ready for implementation plan

## Problem

The current dashboard (`app/src/renderer/pages/Dashboard.tsx`) is capped at
`max-width: 1020px`, centered, and typically shows a single loud gradient system
card in the top-left third of the screen. It reads as unfinished ("only using
part of the screen"), has no clear entry point back into work, and doesn't
invite a non-technical user to start. It also leans "engineered" rather than
"designed."

## Goals

- **Balanced home:** two clear, calm zones — resume work (momentum) *and*
  systems overview — neither overwhelming nor technical.
- **Fill the screen:** a wider, two-column layout that uses the horizontal space.
- **Feel designed, warm, friendly:** softer cards, brand tints, no git jargon.
- **Preserve personalization:** keep per-system icon + color editing (unchanged).
- **Excite the return:** make "jump back into what you were doing" prominent and
  obvious.

## Non-goals

- No change to how systems, drafts, or git state are fetched/stored (reuse the
  existing `systemStore`, `draftStore`, `pullStatus`, and `window.api.git`).
- No change to the Add-System / New-Draft flows or their modals.
- No redesign of other pages (Inbox, Settings, System Overview).
- No dark mode work in this pass.

## Locked design decisions

All validated visually in the brainstorming session (browser companion mockups).

### 1. System card = "Style A" (soft, designed)
Replace the bold full-gradient `SystemCard` with the design-system's soft card
(as in `preview.html`):
- White card, `1px` default border (`--color-border-default`), `--radius-lg`.
- Soft **tinted icon chip** (`44px`, `--radius-md`) using the system's color
  family at the `-100` tint (e.g. `--amp-violet-100`, `--amp-orange-100`,
  `--amp-plum-100`); the icon glyph itself renders dark (`--color-text-primary`).
- Hover: border → `--amp-violet-700`, add `--shadow-md`, subtle lift.
- **No emoji anywhere** — use the existing SVG line icons from `SystemIcons.tsx`.

**Personalization mapping:** the system's chosen color drives the chip tint (not
a full-card gradient); the chosen icon renders inside the chip. Icon + color
editing stays exactly as-is in the Add-System modal / Settings — only the card's
*rendering* changes.

### 2. Card meta = friendly status + playbook count
Meta line reads `Status · N playbooks` (e.g. "Up to date · 12 playbooks").
- **Playbook count** replaces any file count — a system is its playbooks.
  (See "Playbook count" under Data below.)
- **Status wording drops git jargon:** "Up to date" (synced), "N unpublished"
  (ahead), "Updates available" (behind), "Not connected" (no folder). A small
  colored status dot precedes the text (green / brand / orange / gray).

### 3. Layout = two-column, wider
- Widen the dashboard container beyond today's 1020px (target ~1240px, or fluid
  with generous padding — final value set during implementation against the real
  window; keep a readable measure).
- Greeting header unchanged in copy ("Good {time}, {first name}" + "Here's
  what's happening across your systems.").
- Below the header, a CSS grid: **main column ≈ 1.65fr** ("Your systems") and
  **right rail ≈ 1fr** ("Jump back in").
- **Your systems** (main): responsive grid of Style-A cards (2-up within the
  main column) with an inline dashed **"Add system"** tile as the last cell.
- **Jump back in** (rail): vertical stack of momentum cards (see #4).

### 4. Momentum ("Jump back in") cards
Each in-progress draft renders as a horizontal row:
`[ tinted system chip + icon ]  [ draft name / system · N edited ]  [ Badge ]`
- **Color inheritance:** the chip uses the *same opaque tint* as the draft's
  parent system card, with that system's icon — so a draft visibly belongs to
  its system. (No separate saturated color square.)
- **Badge pinned far right**, vertically centered in the row.
- Card: white, `1px` warm border, `--radius-md`, subtle shadow; hover lifts.

### 5. Version status = real `Badge` component
Use the shipped `Badge` (`components/Badge.tsx`) + its `reviewVariant` /
`reviewLabel` helpers — no ad-hoc pills. Mapping:
| State | Variant | Label |
| --- | --- | --- |
| Local draft, no PR | `neutral` | `Draft` |
| PR open, review pending | `brand` | `In Review` |
| PR changes requested | `warning` | `Changes Requested` |
| PR approved | `success` | `Approved` |

`reviewVariant`/`reviewLabel` already produce In Review / Approved / Changes
Requested. The only copy change: the no-PR case shows **"Draft"** (today it says
"Editing").

### 6. Dashboard nav icon = Globe
Swap the sidebar's Dashboard nav icon from `DiamondIcon` to **`GlobeIcon`**
(consistent with the "Atlas" identity). One-line change in
`components/Sidebar.tsx` (line ~51). `GlobeIcon` already exists in
`SystemIcons.tsx`.

### 7. Empty state = "Centered welcome" (E1)
When there are no systems, replace the dashed box with a centered welcome:
- Soft gradient globe badge (`64px`, rounded, `violet-100 → orange-100`
  gradient, globe icon in brand violet, soft shadow).
- Headline: "Welcome to Atlas, {first name}".
- One plain-language line: "Your systems live here — each one holds a set of
  playbooks you can write, refine, and publish. Add your first to get started."
- Single primary button: **"Add your first system"** (opens existing
  `NewSystemModal`).

## Data

### Playbook count
The card meta needs a per-system playbook count. Determine the counting rule
during planning by inspecting a connected system's folder structure (the
templates are modeled on the `aiops_system` format — playbooks live in a known
subdirectory). Add a small helper (main-process `fsops` + a preload bridge, or
reuse an existing listing API) that returns the playbook count for a system
folder. If the count is momentarily unavailable (not connected / loading), fall
back to hiding the count and showing status only. **This is the one piece that
needs a data path that doesn't fully exist yet** — scope it explicitly in the
plan; everything else is presentational.

### Status
Derive from existing pull/git state already used by the current dashboard
(`getLastPull` / `refreshMain` / `window.api.git.status`). Map to the friendly
labels in decision #2. No new git plumbing.

## Motion & accessibility (apple-design)

- Card/badge hovers respond on the compositor (`transform` + `box-shadow` /
  `border-color`), fast (~120–150ms), no layout thrash.
- Respect `prefers-reduced-motion`: drop lift/scale, keep color/opacity cues.
- Respect `prefers-contrast: more`: keep the card's defined border.
- Maintain WCAG AA contrast for status text and badges (dark glyph on `-100`
  tints already passes; verify status dot + meta text).

## Files touched (and WIP isolation)

Parallel structural work is in progress on this branch. The dashboard redesign
must **not** touch those files. Current WIP (do not edit): `SystemOverview.tsx`,
`FileTree.tsx`, `NewItemModal.tsx`, `SystemIcons.tsx`, `modal.css`, and new
`FolderPicker.*`.

**Edit (all currently clean):**
- `app/src/renderer/pages/Dashboard.tsx` — layout, zones, empty state.
- `app/src/renderer/pages/Dashboard.css` — two-column grid, wider container,
  momentum-card + empty-state styles.
- `app/src/renderer/components/SystemCard.tsx` + `SystemCard.css` — Style-A
  rendering (tinted chip + dark icon; drop full-card gradient).
- `app/src/renderer/components/Sidebar.tsx` — Dashboard nav icon → `GlobeIcon`.
- **New:** a `JumpBackInCard` (momentum row) component + styles, so the file
  stays focused.

**Read-only dependency (do not modify):** `SystemIcons.tsx` — import `GlobeIcon`
and the system glyphs from it. It is under active WIP edit; coordinate before
merge in case an icon export is renamed/removed.

**Possible new data path:** main-process playbook-count helper + preload bridge
(see Data). Adds to `fsops`/preload — confirm these aren't mid-edit before
touching; if they are, coordinate or gate behind the fallback.

## Testing

- Unit: status→label mapping and playbook-count helper (pure functions).
- Visual/manual (per the app's testing approach): populated dashboard (multiple
  systems + drafts across all four badge states), single-system, and empty
  state; verify wide-window fill, hover states, reduced-motion.

## Open questions

- Exact playbook-count source (folder rule) — resolve by inspecting a real
  connected system during planning.
- Final container max-width — tune against the real window.
