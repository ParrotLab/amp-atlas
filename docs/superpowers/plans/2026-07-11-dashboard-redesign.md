# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the AMP UP dashboard as a warm, two-column home — a soft "Your systems" overview beside a "Jump back in" momentum rail — that fills the screen and invites a non-technical user to start working.

**Architecture:** Pure, unit-tested helpers (playbook count, status descriptor, color tint) feed presentational React components (`SystemCard` restyled to "Style A", a new `JumpBackInCard`). `Dashboard.tsx` composes them into a two-column CSS grid and wires the existing stores/IPC. No new IPC channels — playbook count reads `.claude/skills` via the existing `fs.readDirectory` bridge; status uses the existing `git.hasUnpublishedWork` bridge.

**Tech Stack:** React + TypeScript (Electron renderer), plain CSS with design tokens from `styles/tokens.css`, Vitest + jsdom for unit tests.

## Global Constraints

- **WIP isolation — do NOT modify these files** (active parallel work on this branch): `app/src/renderer/pages/SystemOverview.tsx`, `app/src/renderer/components/FileTree.tsx`, `app/src/renderer/components/NewItemModal.tsx`, `app/src/renderer/components/SystemIcons.tsx`, `app/src/renderer/styles/components/modal.css`, and any new `FolderPicker.*`. `SystemIcons.tsx` is **import-only** (read-only dependency).
- **No emoji anywhere.** Use the SVG line icons exported from `components/SystemIcons.tsx`.
- **Use design tokens, not raw hex,** wherever a token exists (`styles/tokens.css`): colors, spacing (`--space-*`), radius (`--radius-*`), fonts. Raw hex is allowed only for values computed at runtime (the derived soft tint).
- **Use the real `Badge` component** (`components/Badge.tsx`) with its `reviewVariant`/`reviewLabel` helpers for version status. No ad-hoc pills.
- **Code style:** no semicolons, single quotes, 2-space indent, functional React components — match surrounding files.
- **Playbook = a folder directly inside `<systemFolder>/.claude/skills`.** Count = number of immediate sub-directories there.
- **Design guidance to apply throughout (enforced in Task 8):**
  - *Apple design* (`/Users/kristidowns/Documents/Projects/amp-up-app/.agents/skills/apple-design/SKILL.md`): respond instantly on interaction; hover/press feedback on the compositor (`transform`, `opacity`, `box-shadow`) only; keep motion ~120–150ms; honor `prefers-reduced-motion` (cross-fade, no lift), `prefers-reduced-transparency`, `prefers-contrast: more` (keep a defined border); size-specific tracking (tighten large headings ~`-0.02em`, body near `0`); craft — every spacing/timing value deliberate and token-based.
  - *Design system:* reuse existing components/tokens before inventing; match the `preview.html` "Style A" card exactly; badges/typography/spacing come from the system.
  - *Visual hierarchy / Von Restorff:* the momentum rail is the "start working" entry point — make it obviously actionable; one clear focal path per zone.
  - *Wayfinding & plain language (no git jargon):* "Up to date", "Unpublished changes", "Not connected", "Draft", "In Review", "Changes Requested", "Approved".

---

## File Structure

**Create:**
- `app/src/renderer/utils/playbookCount.ts` — async count of playbooks for a system folder.
- `app/src/renderer/utils/__tests__/playbookCount.test.ts`
- `app/src/renderer/utils/systemStatus.ts` — pure status descriptor (label + tone).
- `app/src/renderer/utils/__tests__/systemStatus.test.ts`
- `app/src/renderer/components/JumpBackInCard.tsx` — momentum row card.
- `app/src/renderer/components/JumpBackInCard.css`

**Modify:**
- `app/src/renderer/utils/appearance.ts` — add `primaryColor()` + `softTint()` helpers.
- `app/src/renderer/utils/__tests__/appearance.test.ts` — create (no existing test file).
- `app/src/renderer/components/SystemCard.tsx` + `SystemCard.css` — "Style A".
- `app/src/renderer/pages/Dashboard.tsx` + `Dashboard.css` — two-column layout, wiring, empty state.
- `app/src/renderer/components/Sidebar.tsx` — Dashboard nav icon → `GlobeIcon`.

**Test command (run from `app/`):** `npx vitest run <path>`

---

## Task 1: Color helpers (`primaryColor`, `softTint`)

Derives a pale chip tint from a system's stored gradient string, so any of the 14 preset colors (or a custom one) yields the soft "Style A" chip automatically.

**Files:**
- Modify: `app/src/renderer/utils/appearance.ts`
- Test: `app/src/renderer/utils/__tests__/appearance.test.ts` (create)

**Interfaces:**
- Produces:
  - `primaryColor(gradient: string): string` — the first `#rrggbb` hex in the gradient (lowercased, with `#`); falls back to `'#8b2bff'` if none found.
  - `softTint(hex: string, colorRatio?: number): string` — mixes `hex` with white; returns `rgb(r, g, b)`. Default `colorRatio = 0.14`.

- [ ] **Step 1: Write the failing test**

Create `app/src/renderer/utils/__tests__/appearance.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { primaryColor, softTint } from '../appearance'

describe('primaryColor', () => {
  it('extracts the first hex from a gradient string', () => {
    expect(primaryColor('linear-gradient(135deg, #8B2BFF, #A855FF)')).toBe('#8b2bff')
  })

  it('falls back to brand violet when no hex is present', () => {
    expect(primaryColor('none')).toBe('#8b2bff')
  })
})

describe('softTint', () => {
  it('mixes the color toward white at the given ratio', () => {
    // 0.14 * 139 + 0.86 * 255 = 238.76 -> 239 ; 0.14*43+0.86*255=225.32 -> 225 ; 0.14*255+0.86*255=255
    expect(softTint('#8b2bff', 0.14)).toBe('rgb(239, 225, 255)')
  })

  it('defaults to a 0.14 ratio', () => {
    expect(softTint('#8b2bff')).toBe('rgb(239, 225, 255)')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/renderer/utils/__tests__/appearance.test.ts`
Expected: FAIL — `primaryColor`/`softTint` are not exported.

- [ ] **Step 3: Add the helpers**

Append to `app/src/renderer/utils/appearance.ts`:

```ts
/** First #rrggbb hex found in a gradient string, lowercased. Falls back to brand violet. */
export function primaryColor(gradient: string): string {
  const m = gradient.match(/#([0-9a-fA-F]{6})/)
  return m ? `#${m[1].toLowerCase()}` : '#8b2bff'
}

/** Mix a hex color toward white. colorRatio is how much of the color remains (0..1). */
export function softTint(hex: string, colorRatio = 0.14): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const mix = (c: number) => Math.round(c * colorRatio + 255 * (1 - colorRatio))
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/renderer/utils/__tests__/appearance.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/renderer/utils/appearance.ts app/src/renderer/utils/__tests__/appearance.test.ts
git commit -m "feat(dashboard): add primaryColor + softTint color helpers"
```

---

## Task 2: Playbook count helper

**Files:**
- Create: `app/src/renderer/utils/playbookCount.ts`
- Test: `app/src/renderer/utils/__tests__/playbookCount.test.ts`

**Interfaces:**
- Consumes: `window.api.fs.readDirectory(path) => Promise<{ ok: boolean; entries?: { name: string; isDirectory: boolean; path: string }[] }>` (existing preload bridge).
- Produces: `getPlaybookCount(folderPath: string): Promise<number | null>` — count of immediate sub-directories in `<folderPath>/.claude/skills`; `null` when not connected, missing, or on error.

- [ ] **Step 1: Write the failing test**

Create `app/src/renderer/utils/__tests__/playbookCount.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getPlaybookCount } from '../playbookCount'

const readDirectory = vi.fn()
beforeEach(() => {
  readDirectory.mockReset()
  ;(window as unknown as { api: unknown }).api = { fs: { readDirectory } }
})

describe('getPlaybookCount', () => {
  it('returns null for an empty folder path', async () => {
    expect(await getPlaybookCount('')).toBeNull()
    expect(readDirectory).not.toHaveBeenCalled()
  })

  it('counts only directory entries in .claude/skills', async () => {
    readDirectory.mockResolvedValue({
      ok: true,
      entries: [
        { name: 'onboarding', isDirectory: true, path: '/x' },
        { name: 'triage', isDirectory: true, path: '/y' },
        { name: 'README.md', isDirectory: false, path: '/z' },
      ],
    })
    expect(await getPlaybookCount('/repo')).toBe(2)
    expect(readDirectory).toHaveBeenCalledWith('/repo/.claude/skills')
  })

  it('returns null when the directory read fails (e.g. no .claude/skills)', async () => {
    readDirectory.mockResolvedValue({ ok: false })
    expect(await getPlaybookCount('/repo')).toBeNull()
  })

  it('returns null when the bridge throws', async () => {
    readDirectory.mockRejectedValue(new Error('boom'))
    expect(await getPlaybookCount('/repo')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/renderer/utils/__tests__/playbookCount.test.ts`
Expected: FAIL — module not found / `getPlaybookCount` undefined.

- [ ] **Step 3: Write the implementation**

Create `app/src/renderer/utils/playbookCount.ts`:

```ts
// Count of playbooks in a system = folders directly inside <folder>/.claude/skills.
export async function getPlaybookCount(folderPath: string): Promise<number | null> {
  if (!folderPath) return null
  try {
    const res = await window.api.fs.readDirectory(`${folderPath}/.claude/skills`)
    if (!res.ok || !res.entries) return null
    return res.entries.filter((e: { isDirectory: boolean }) => e.isDirectory).length
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/renderer/utils/__tests__/playbookCount.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/renderer/utils/playbookCount.ts app/src/renderer/utils/__tests__/playbookCount.test.ts
git commit -m "feat(dashboard): add getPlaybookCount helper (.claude/skills folders)"
```

---

## Task 3: System status descriptor

**Files:**
- Create: `app/src/renderer/utils/systemStatus.ts`
- Test: `app/src/renderer/utils/__tests__/systemStatus.test.ts`

**Interfaces:**
- Produces:
  - `type StatusTone = 'idle' | 'ok' | 'attention'`
  - `interface SystemStatus { label: string; tone: StatusTone }`
  - `describeSystemStatus(connected: boolean, hasUnpublished: boolean): SystemStatus`
  - `metaLine(status: SystemStatus, playbooks: number | null): string` — e.g. `'Up to date · 12 playbooks'`, or just the label when `playbooks` is null; singular "1 playbook".

- [ ] **Step 1: Write the failing test**

Create `app/src/renderer/utils/__tests__/systemStatus.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { describeSystemStatus, metaLine } from '../systemStatus'

describe('describeSystemStatus', () => {
  it('is Not connected when there is no folder', () => {
    expect(describeSystemStatus(false, false)).toEqual({ label: 'Not connected', tone: 'idle' })
  })
  it('is Unpublished changes when connected with work', () => {
    expect(describeSystemStatus(true, true)).toEqual({ label: 'Unpublished changes', tone: 'attention' })
  })
  it('is Up to date when connected and clean', () => {
    expect(describeSystemStatus(true, false)).toEqual({ label: 'Up to date', tone: 'ok' })
  })
})

describe('metaLine', () => {
  it('joins label and count', () => {
    expect(metaLine({ label: 'Up to date', tone: 'ok' }, 12)).toBe('Up to date · 12 playbooks')
  })
  it('uses singular for one', () => {
    expect(metaLine({ label: 'Up to date', tone: 'ok' }, 1)).toBe('Up to date · 1 playbook')
  })
  it('shows only the label when count is null', () => {
    expect(metaLine({ label: 'Not connected', tone: 'idle' }, null)).toBe('Not connected')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/renderer/utils/__tests__/systemStatus.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `app/src/renderer/utils/systemStatus.ts`:

```ts
export type StatusTone = 'idle' | 'ok' | 'attention'
export interface SystemStatus { label: string; tone: StatusTone }

/** Friendly, non-technical status for a system card. */
export function describeSystemStatus(connected: boolean, hasUnpublished: boolean): SystemStatus {
  if (!connected) return { label: 'Not connected', tone: 'idle' }
  if (hasUnpublished) return { label: 'Unpublished changes', tone: 'attention' }
  return { label: 'Up to date', tone: 'ok' }
}

/** "Up to date · 12 playbooks" — count omitted when null. */
export function metaLine(status: SystemStatus, playbooks: number | null): string {
  if (playbooks === null) return status.label
  return `${status.label} · ${playbooks} playbook${playbooks === 1 ? '' : 's'}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/renderer/utils/__tests__/systemStatus.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/renderer/utils/systemStatus.ts app/src/renderer/utils/__tests__/systemStatus.test.ts
git commit -m "feat(dashboard): add friendly system status descriptor"
```

---

## Task 4: SystemCard → "Style A"

Restyle the system card from full-gradient to the soft `preview.html` card: white surface, tinted icon chip (derived from the system color), dark line-icon, name, and a status-dot + meta line. The dashboard passes the derived data in.

**Files:**
- Modify: `app/src/renderer/components/SystemCard.tsx` (full rewrite of the component body)
- Modify: `app/src/renderer/components/SystemCard.css` (full rewrite)

**Interfaces:**
- Consumes: `primaryColor`, `softTint` (Task 1); `StatusTone` (Task 3).
- Produces (new props): `SystemCard({ name, path, color, icon, connected, tone, meta })`
  - `color: string` (the system's gradient string), `icon: React.ReactNode`, `tone: StatusTone`, `meta: string` (from `metaLine`).

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `app/src/renderer/components/SystemCard.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { primaryColor, softTint } from '../utils/appearance'
import { StatusTone } from '../utils/systemStatus'
import './SystemCard.css'

interface SystemCardProps {
  name: string
  path: string
  color: string            // the system's stored gradient string
  icon: React.ReactNode
  meta: string             // from metaLine(status, playbooks)
  tone: StatusTone
  connected?: boolean
}

export default function SystemCard({ name, path, color, icon, meta, tone, connected = true }: SystemCardProps) {
  const tint = softTint(primaryColor(color))
  return (
    <Link to={path} className={`system-card ${connected ? '' : 'disconnected'}`}>
      <div className="system-card-chip" style={{ background: tint }}>{icon}</div>
      <div className="system-card-name">{name}</div>
      <div className="system-card-meta">
        <span className={`system-card-dot tone-${tone}`} />
        {meta}
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Rewrite the styles**

Replace the entire contents of `app/src/renderer/components/SystemCard.css`:

```css
.system-card {
  display: block;
  background: var(--amp-white);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  text-decoration: none;
  color: inherit;
  transition: border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease;
}

.system-card:hover {
  border-color: var(--amp-violet-700);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.system-card-chip {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-3);
  color: var(--color-text-primary);
}

.system-card-name {
  font-size: var(--text-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
  margin-bottom: var(--space-2);
}

.system-card-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
}

.system-card-dot { width: 6px; height: 6px; border-radius: 50%; flex: none; }
.system-card-dot.tone-ok { background: var(--color-status-success); }
.system-card-dot.tone-attention { background: var(--amp-violet-700); }
.system-card-dot.tone-idle { background: var(--amp-gray-400); }

.system-card.disconnected { opacity: 0.6; }
.system-card.disconnected:hover { opacity: 0.85; transform: none; }

@media (prefers-reduced-motion: reduce) {
  .system-card { transition: opacity 140ms ease; }
  .system-card:hover { transform: none; }
}

@media (prefers-contrast: more) {
  .system-card { border-color: var(--color-border-strong); }
}
```

- [ ] **Step 3: Verify build compiles**

Run: `cd app && npx tsc --noEmit -p tsconfig.node.json 2>/dev/null; npx vitest run src/renderer/utils/__tests__/appearance.test.ts`
Expected: appearance tests PASS. (SystemCard is consumed in Task 6; a type error there is expected until Dashboard is updated — that's fine for this task.)

- [ ] **Step 4: Commit**

```bash
git add app/src/renderer/components/SystemCard.tsx app/src/renderer/components/SystemCard.css
git commit -m "feat(dashboard): restyle SystemCard to soft Style-A card"
```

---

## Task 5: JumpBackInCard component

A momentum row: system-tinted chip + icon on the left, draft name / system meta in the middle, real `Badge` pinned far right. The chip reuses the parent system's tint so a draft visibly belongs to its system.

**Files:**
- Create: `app/src/renderer/components/JumpBackInCard.tsx`
- Create: `app/src/renderer/components/JumpBackInCard.css`

**Interfaces:**
- Consumes: `primaryColor`, `softTint` (Task 1); `Badge` + `BadgeVariant` (existing `components/Badge.tsx`).
- Produces: `JumpBackInCard({ to, title, subtitle, color, icon, badgeVariant, badgeLabel })`
  - `to: string`, `title: string`, `subtitle: string`, `color: string` (system gradient), `icon: React.ReactNode`, `badgeVariant: BadgeVariant`, `badgeLabel: string`.

- [ ] **Step 1: Write the component**

Create `app/src/renderer/components/JumpBackInCard.tsx`:

```tsx
import { Link } from 'react-router-dom'
import Badge, { BadgeVariant } from './Badge'
import { primaryColor, softTint } from '../utils/appearance'
import './JumpBackInCard.css'

interface JumpBackInCardProps {
  to: string
  title: string
  subtitle: string
  color: string            // the system's stored gradient string
  icon: React.ReactNode
  badgeVariant: BadgeVariant
  badgeLabel: string
}

export default function JumpBackInCard({ to, title, subtitle, color, icon, badgeVariant, badgeLabel }: JumpBackInCardProps) {
  const tint = softTint(primaryColor(color))
  return (
    <Link to={to} className="jumpback-card">
      <div className="jumpback-chip" style={{ background: tint }}>{icon}</div>
      <div className="jumpback-body">
        <div className="jumpback-title">{title}</div>
        <div className="jumpback-sub">{subtitle}</div>
      </div>
      <Badge variant={badgeVariant} className="jumpback-badge">{badgeLabel}</Badge>
    </Link>
  )
}
```

- [ ] **Step 2: Write the styles**

Create `app/src/renderer/components/JumpBackInCard.css`:

```css
.jumpback-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--amp-white);
  border: 1px solid var(--color-border-default);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  text-decoration: none;
  color: inherit;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  transition: border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease;
}

.jumpback-card:hover {
  border-color: var(--amp-violet-700);
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.jumpback-chip {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  color: var(--color-text-primary);
}

.jumpback-body { flex: 1; min-width: 0; }

.jumpback-title {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.jumpback-sub {
  font-size: var(--text-xs);
  color: var(--color-text-tertiary);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.jumpback-badge { flex: none; }

@media (prefers-reduced-motion: reduce) {
  .jumpback-card { transition: border-color 140ms ease; }
  .jumpback-card:hover { transform: none; }
}

@media (prefers-contrast: more) {
  .jumpback-card { border-color: var(--color-border-strong); }
}
```

- [ ] **Step 3: Verify appearance tests still pass**

Run: `cd app && npx vitest run src/renderer/utils/__tests__/appearance.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/renderer/components/JumpBackInCard.tsx app/src/renderer/components/JumpBackInCard.css
git commit -m "feat(dashboard): add JumpBackInCard momentum component"
```

---

## Task 6: Dashboard — two-column layout, wiring, empty state

Compose everything: fetch playbook count + unpublished status per system, render the two-column grid (systems main + jump-back-in rail), the inline "Add system" tile, and the centered welcome empty state.

**Files:**
- Modify: `app/src/renderer/pages/Dashboard.tsx`
- Modify: `app/src/renderer/pages/Dashboard.css`

**Interfaces:**
- Consumes: `getPlaybookCount` (Task 2); `describeSystemStatus`, `metaLine`, `SystemStatus` (Task 3); `SystemCard` (Task 4); `JumpBackInCard` (Task 5); existing `reviewVariant`/`reviewLabel` (`components/Badge.tsx`); existing icons from `SystemIcons.tsx`.

- [ ] **Step 1: Rewrite `Dashboard.tsx`**

Replace the entire contents of `app/src/renderer/pages/Dashboard.tsx`:

```tsx
import { useState, useEffect } from 'react'
import SystemCard from '../components/SystemCard'
import JumpBackInCard from '../components/JumpBackInCard'
import { iconMap, BookIcon } from '../components/SystemIcons'
import { GlobeIcon } from '../components/SystemIcons'
import { getSystems, SystemConfig, SYSTEMS_CHANGED_EVENT } from '../utils/systemStore'
import { listActive } from '../utils/draftStore'
import { getLastPull, setLastPull } from '../utils/pullStatus'
import { getPlaybookCount } from '../utils/playbookCount'
import { describeSystemStatus, metaLine, SystemStatus } from '../utils/systemStatus'
import { useProfile } from '../hooks/useProfile'
import NewSystemModal from '../components/NewSystemModal'
import { reviewVariant, reviewLabel, BadgeVariant } from '../components/Badge'
import './Dashboard.css'

function humanize(branch: string): string {
  return branch
    .replace(/^(draft|feature|fix|hotfix)\//i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

interface DraftInfo {
  systemId: string
  systemName: string
  systemColor: string
  systemIcon: string
  branchName: string
  displayName: string
  modifiedCount: number
  badgeVariant: BadgeVariant
  badgeLabel: string
}

export default function Dashboard() {
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const profile = useProfile()
  const firstName = profile.name ? profile.name.split(' ')[0] : ''
  const [systems, setSystems] = useState<SystemConfig[]>([])
  const [drafts, setDrafts] = useState<DraftInfo[]>([])
  const [counts, setCounts] = useState<Record<string, number | null>>({})
  const [statuses, setStatuses] = useState<Record<string, SystemStatus>>({})
  const [showAddSystem, setShowAddSystem] = useState(false)

  useEffect(() => {
    setSystems(getSystems())
    const reread = () => setSystems(getSystems())
    window.addEventListener('focus', reread)
    window.addEventListener(SYSTEMS_CHANGED_EVENT, reread)
    return () => { window.removeEventListener('focus', reread); window.removeEventListener(SYSTEMS_CHANGED_EVENT, reread) }
  }, [])

  // Silently refresh connected systems on open (throttled), then read status + playbook counts.
  useEffect(() => {
    const load = async () => {
      const connected = getSystems().filter(s => s.folderPath)
      for (const sys of connected) {
        const folder = sys.folderPath
        const last = getLastPull(folder)
        if (!last || Date.now() - last >= 60_000) {
          const r = await window.api.git.refreshMain(folder)
          if (r.ok) setLastPull(folder, Date.now())
        }
      }
      const nextCounts: Record<string, number | null> = {}
      const nextStatuses: Record<string, SystemStatus> = {}
      for (const sys of getSystems()) {
        if (!sys.folderPath) {
          nextCounts[sys.id] = null
          nextStatuses[sys.id] = describeSystemStatus(false, false)
          continue
        }
        nextCounts[sys.id] = await getPlaybookCount(sys.folderPath)
        let hasWork = false
        try {
          const w = await window.api.git.hasUnpublishedWork(sys.folderPath)
          hasWork = !!(w.ok && w.hasWork)
        } catch { /* ignore */ }
        nextStatuses[sys.id] = describeSystemStatus(true, hasWork)
      }
      setCounts(nextCounts)
      setStatuses(nextStatuses)
    }
    void load()
  }, [systems.length])

  useEffect(() => {
    const loadDrafts = async () => {
      const allDrafts: DraftInfo[] = []
      for (const sys of systems) {
        if (!sys.folderPath) continue
        const registered = listActive(sys.id)
        if (registered.length === 0) continue

        let current: string | null = null
        let modifiedCount = 0
        try {
          const statusResult = await window.api.git.status(sys.folderPath)
          if (statusResult.ok && statusResult.status) {
            current = statusResult.status.current
            modifiedCount = statusResult.status.modified.length + statusResult.status.not_added.length
          }
        } catch { /* ignore */ }

        for (const d of registered) {
          let variant: BadgeVariant = 'neutral'
          let label = 'Draft'
          if (d.branch === current) {
            try {
              const prResult = await window.api.git.prStatus(sys.folderPath)
              if (prResult.ok && prResult.hasPR) {
                variant = reviewVariant(prResult.pr?.reviewDecision)
                label = reviewLabel(prResult.pr?.reviewDecision)
              }
            } catch { /* ignore */ }
          }
          allDrafts.push({
            systemId: sys.id,
            systemName: sys.name,
            systemColor: sys.gradient,
            systemIcon: sys.icon,
            branchName: d.branch,
            displayName: d.title || humanize(d.branch),
            modifiedCount: d.branch === current ? modifiedCount : 0,
            badgeVariant: variant,
            badgeLabel: label,
          })
        }
      }
      setDrafts(allDrafts)
    }
    if (systems.length > 0) loadDrafts()
  }, [systems])

  if (systems.length === 0) {
    return (
      <div className="dashboard">
        <div className="dashboard-empty">
          <div className="dashboard-empty-badge"><GlobeIcon size={30} /></div>
          <h1 className="dashboard-empty-title">Welcome to Atlas{firstName ? `, ${firstName}` : ''}</h1>
          <p className="dashboard-empty-sub">Your systems live here — each one holds a set of playbooks you can write, refine, and publish. Add your first to get started.</p>
          <button className="dashboard-empty-btn" onClick={() => setShowAddSystem(true)}>+ Add your first system</button>
        </div>
        <NewSystemModal
          isOpen={showAddSystem}
          onClose={() => setShowAddSystem(false)}
          onCreated={() => setSystems(getSystems())}
        />
      </div>
    )
  }

  return (
    <div className="dashboard">
      <h1 className="dashboard-greeting">{greeting}{firstName ? `, ${firstName}` : ''}</h1>
      <p className="dashboard-subtitle">Here's what's happening across your systems.</p>

      <div className="dashboard-columns">
        <div className="dashboard-main">
          <div className="section-label">Your Systems</div>
          <div className="systems-grid">
            {systems.map(sys => {
              const Icon = iconMap[sys.icon] || BookIcon
              const status = statuses[sys.id] || describeSystemStatus(!!sys.folderPath, false)
              return (
                <SystemCard
                  key={sys.id}
                  name={sys.name}
                  path={`/system/${sys.id}`}
                  color={sys.gradient}
                  meta={metaLine(status, counts[sys.id] ?? null)}
                  tone={status.tone}
                  connected={!!sys.folderPath}
                  icon={<Icon size={22} />}
                />
              )
            })}
            <button className="system-add-tile" onClick={() => setShowAddSystem(true)}>
              <span className="system-add-plus">+</span>
              <span className="system-add-label">Add system</span>
            </button>
          </div>
        </div>

        <div className="dashboard-rail">
          <div className="section-label">Jump Back In</div>
          {drafts.length === 0 ? (
            <div className="rail-empty">Nothing in progress yet. Open a system to start a draft.</div>
          ) : (
            <div className="drafts-list">
              {drafts.map(draft => {
                const Icon = iconMap[draft.systemIcon] || BookIcon
                const sub = `${draft.systemName}${draft.modifiedCount > 0 ? ` · ${draft.modifiedCount} edited` : ''}`
                return (
                  <JumpBackInCard
                    key={`${draft.systemId}-${draft.branchName}`}
                    to={`/system/${draft.systemId}`}
                    title={draft.displayName}
                    subtitle={sub}
                    color={draft.systemColor}
                    icon={<Icon size={16} />}
                    badgeVariant={draft.badgeVariant}
                    badgeLabel={draft.badgeLabel}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>

      <NewSystemModal
        isOpen={showAddSystem}
        onClose={() => setShowAddSystem(false)}
        onCreated={() => setSystems(getSystems())}
      />
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `Dashboard.css`**

Replace the entire contents of `app/src/renderer/pages/Dashboard.css`:

```css
.dashboard {
  max-width: 1240px;
  margin: 0 auto;
  padding: 52px 48px 60px; /* 38px titlebar + spacing */
  overflow-y: auto;
  height: 100%;
}

.dashboard-greeting {
  font-size: var(--text-3xl);
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
  margin-bottom: 4px;
}

.dashboard-subtitle {
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
  margin-bottom: 32px;
}

.section-label {
  font-size: var(--text-xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--amp-gray-400);
  margin-bottom: 14px;
}

/* Two-column: systems (main) + jump-back-in (rail) */
.dashboard-columns {
  display: grid;
  grid-template-columns: 1.65fr 1fr;
  gap: 40px;
  align-items: start;
}

@media (max-width: 900px) {
  .dashboard-columns { grid-template-columns: 1fr; gap: 28px; }
}

.systems-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
}

/* Add-system tile */
.system-add-tile {
  border: 1.5px dashed var(--color-border-strong);
  background: rgba(255, 255, 255, 0.4);
  border-radius: var(--radius-lg);
  min-height: 116px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  font-family: inherit;
  color: var(--amp-gray-400);
  transition: border-color 140ms ease, color 140ms ease;
}
.system-add-tile:hover { border-color: var(--amp-violet-700); color: var(--amp-violet-700); }
.system-add-plus { font-size: 22px; line-height: 1; }
.system-add-label { font-size: var(--text-xs); font-weight: var(--font-weight-semibold); }

/* Momentum rail */
.drafts-list { display: flex; flex-direction: column; gap: 10px; }
.rail-empty {
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
  background: rgba(255, 255, 255, 0.4);
  border: 1px dashed var(--color-border-default);
  border-radius: var(--radius-md);
  padding: 18px;
  line-height: 1.5;
}

/* Empty state — centered welcome */
.dashboard-empty {
  min-height: 70vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.dashboard-empty-badge {
  width: 64px;
  height: 64px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--amp-violet-700);
  background: linear-gradient(135deg, var(--amp-violet-100), var(--amp-orange-100));
  box-shadow: 0 6px 18px rgba(139, 43, 255, 0.14);
  margin-bottom: 18px;
}
.dashboard-empty-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
  margin-bottom: 8px;
}
.dashboard-empty-sub {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  max-width: 380px;
  line-height: 1.55;
  margin-bottom: 22px;
}
.dashboard-empty-btn {
  background: var(--amp-violet-700);
  color: var(--amp-white);
  border: none;
  border-radius: var(--radius-md);
  padding: 10px 20px;
  font-size: var(--text-sm);
  font-weight: var(--font-weight-semibold);
  font-family: inherit;
  cursor: pointer;
  transition: background 140ms ease;
}
.dashboard-empty-btn:hover { background: var(--amp-violet-900); }

@media (prefers-reduced-motion: reduce) {
  .system-add-tile, .dashboard-empty-btn { transition: none; }
}
```

- [ ] **Step 3: Verify types compile and all unit tests pass**

Run: `cd app && npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests PASS.

> If `tsc` reports an error that `GlobeIcon` or `iconMap` is not exported from `SystemIcons.tsx`, the parallel WIP has renamed it — STOP and coordinate (this is the one read-only dependency). Do not edit `SystemIcons.tsx`.

- [ ] **Step 4: Commit**

```bash
git add app/src/renderer/pages/Dashboard.tsx app/src/renderer/pages/Dashboard.css
git commit -m "feat(dashboard): two-column layout, playbook counts, friendly status, welcome empty state"
```

---

## Task 7: Sidebar Dashboard nav icon → Globe

**Files:**
- Modify: `app/src/renderer/components/Sidebar.tsx` (line ~5 import, line ~51 usage)

**Interfaces:**
- Consumes: `GlobeIcon` from `SystemIcons.tsx` (read-only dependency).

- [ ] **Step 1: Add GlobeIcon to the import**

In `app/src/renderer/components/Sidebar.tsx`, change the icon import (line ~5) from:

```tsx
import { iconMap, DiamondIcon, MailIcon, GearIcon } from './SystemIcons'
```

to:

```tsx
import { iconMap, GlobeIcon, MailIcon, GearIcon } from './SystemIcons'
```

- [ ] **Step 2: Swap the Dashboard nav icon**

In the same file (line ~51), change:

```tsx
          <DiamondIcon size={18} /> Dashboard
```

to:

```tsx
          <GlobeIcon size={18} /> Dashboard
```

> If `DiamondIcon` is used elsewhere in `Sidebar.tsx`, keep it in the import; only swap the Dashboard row. Verify with: `grep -n DiamondIcon app/src/renderer/components/Sidebar.tsx` before removing it from the import.

- [ ] **Step 3: Verify compile**

Run: `cd app && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/renderer/components/Sidebar.tsx
git commit -m "feat(dashboard): use Globe icon for Dashboard nav (Atlas)"
```

---

## Task 8: Design-skills critique & polish pass

Run the visual critique + apple-design review against the running app and fix findings. This is the "leverage all UX/UI skills" gate.

**Files:** any of the dashboard files above, as findings require (never the WIP-isolated files).

- [ ] **Step 1: Build and launch the app**

Use the `run` skill (or `cd app && npm run dev`) to launch Electron. Create at least two systems, connect them to folders that contain `.claude/skills`, and start a draft or two so both zones and multiple badge states render. Also verify the empty state (temporarily clear systems in localStorage).

- [ ] **Step 2: Capture the dashboard and run visual critique**

Screenshot the populated dashboard and the empty state. Invoke `visual-critique:critique-screen` on each (it runs all seven critiques — hierarchy, composition, color, typography, information density, affordance, brand consistency) and produce a prioritized fix list.

- [ ] **Step 3: Apple-design checklist pass**

Against `.agents/skills/apple-design/SKILL.md`, verify: hover feedback is instant and compositor-only; motion ~120–150ms; `prefers-reduced-motion`/`prefers-contrast` paths behave (toggle them); heading tracking is tight (`-0.02em`) and body near `0`; the momentum rail is the clear focal entry point (Von Restorff / visual hierarchy); status copy is plain-language with no git jargon.

- [ ] **Step 4: Apply high/medium-priority fixes**

Implement the critique's high- and medium-priority findings in the dashboard files. Re-screenshot to confirm each is resolved.

- [ ] **Step 5: Full verification**

Run: `cd app && npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests PASS. Confirm the app still launches and both dashboard states render correctly.

- [ ] **Step 6: Commit**

```bash
git add app/src/renderer/pages/Dashboard.tsx app/src/renderer/pages/Dashboard.css app/src/renderer/components/SystemCard.css app/src/renderer/components/JumpBackInCard.css
git commit -m "polish(dashboard): apply visual-critique + apple-design findings"
```

---

## Self-Review (completed)

**Spec coverage:** Style-A card (T4) ✓; friendly status + playbook count (T2, T3, T4) ✓; two-column wider layout (T6) ✓; momentum cards inherit system tint + icon, badge right (T5) ✓; real Badge variants (T5, T6) ✓; Globe nav icon (T7) ✓; centered welcome empty state (T6) ✓; personalization preserved — icon/color still drive chip + tint, modals untouched ✓; motion/accessibility (per-component media queries + T8) ✓; playbook-count data path (T2) ✓; WIP isolation (Global Constraints, guard notes in T6/T7) ✓; design-skills guidance (Global Constraints + T8) ✓.

**Placeholder scan:** none — every step has concrete code or exact commands.

**Type consistency:** `SystemCard` props (`color`/`tone`/`meta`) match T4↔T6; `JumpBackInCard` props match T5↔T6; `describeSystemStatus`/`metaLine`/`SystemStatus` match T3↔T6; `getPlaybookCount` signature matches T2↔T6; `primaryColor`/`softTint` match T1↔T4↔T5.
