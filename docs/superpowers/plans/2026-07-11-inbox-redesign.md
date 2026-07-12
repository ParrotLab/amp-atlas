# Inbox Redesign + Review Foundation — Implementation Plan (Part 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Inbox as a tabbed action queue (Needs your review / Ready to publish / Your drafts) and add the review/approval data foundation it needs (PR reviewer/body fields + a real Publish=merge capability).

**Architecture:** A pure, unit-tested classifier maps each open PR + the current user's login to a tab and an action. The Inbox fetches PRs across systems, classifies them, and renders tabbed rows whose buttons reuse existing IPC (navigate to review, switch branch to edit) plus one new capability (`mergePR`) for Publish. Backend changes are small additions to `github.ts` and its IPC/preload/type surface.

**Tech Stack:** React + TypeScript (Electron renderer), Node/`simple-git`/GitHub REST (main), Vitest + jsdom.

**Scope note:** This is Part 1. The role-aware **Review page** redesign (author read-only mode, feedback callout, `latestReview`, Updated-version/What-changed, sticky bar) is **Part 2**, a separate plan. In Part 1, the Inbox's Review/View buttons open the *existing* review page.

## Global Constraints

- **WIP isolation.** Do not edit files in the parallel structural work. Confirm a target file is clean (`git status --short <file>`) before editing. `SystemIcons.tsx` is import-only.
- **No emoji.** Use SVG icons from `components/SystemIcons.tsx`.
- **Design tokens, not raw hex,** where a token exists (`styles/tokens.css`). Reuse the dashboard's language: `softTint(primaryColor(gradient))` chips, the real `Badge` component.
- **Plain language, no git jargon** in user copy: Review, Approve, Request changes, Make Edits, Publish, In review, Changes requested, Approved. Never "PR", "merge", "branch".
- **Code style:** no semicolons, single quotes, 2-space indent, functional components — match surrounding files.
- **Review model:** Approve = sign-off; Publish = merge + delete branch (author). Hard rules deferred to GitHub branch protection — surface friendly errors, don't reimplement.

## File Structure

**Create:**
- `app/src/renderer/utils/inboxClassify.ts` — pure PR→{tab, action, badge} classifier.
- `app/src/renderer/utils/__tests__/inboxClassify.test.ts`
- `app/src/renderer/components/InboxRow.tsx` — one row (chip, meta, badge, action button, ⋯ menu).
- `app/src/renderer/components/InboxRow.css`

**Modify:**
- `app/src/main/github.ts` — add `body`/`requestedReviewers` to `listPRs`; add `mergePR`.
- `app/src/main/index.ts` — add `git:mergePR` handler.
- `app/src/preload/index.ts` — add `git.mergePR` bridge.
- `app/src/renderer/env.d.ts` — extend `listPRs` type; add `mergePR` type.
- `app/src/renderer/pages/Inbox.tsx` + `Inbox.css` — tabbed action queue.

**Test command (run from `app/`):** `npx vitest run <path>` · **Scoped typecheck:** `npx tsc --noEmit 2>&1 | grep -E '<file>'`

---

## Task 1: Extend `listPRs` with reviewer + body fields

**Files:**
- Modify: `app/src/main/github.ts` (the `listPRs` function)
- Modify: `app/src/renderer/env.d.ts` (the `listPRs` type, ~line 107)

**Interfaces:**
- Produces: `listPRs` results additionally include `body: string` and `requestedReviewers: string[]`.

- [ ] **Step 1: Extend the github function**

In `app/src/main/github.ts`, replace the `listPRs` function body's list cast and returned object so each PR includes `body` and `requestedReviewers`:

```ts
export async function listPRs(repoPath: string) {
  const { owner, repo } = await ownerRepo(repoPath)
  const prs = await gh(`/repos/${owner}/${repo}/pulls?state=open&per_page=20`) as Array<{ number: number; title: string; state: string; user: { login: string }; created_at: string; head: { ref: string }; html_url: string; body: string | null; requested_reviewers: { login: string }[] | null }>
  return Promise.all(prs.map(async p => {
    const detail = await gh(`/repos/${owner}/${repo}/pulls/${p.number}`) as { additions: number; deletions: number; changed_files: number }
    return {
      number: p.number, title: p.title, state: p.state.toUpperCase(),
      author: { login: p.user.login, name: p.user.login }, createdAt: p.created_at,
      headRefName: p.head.ref, reviewDecision: await reviewDecision(owner, repo, p.number),
      url: p.html_url, additions: detail.additions, deletions: detail.deletions, changedFiles: detail.changed_files,
      body: p.body || '', requestedReviewers: (p.requested_reviewers ?? []).map(u => u.login),
    }
  }))
}
```

- [ ] **Step 2: Extend the renderer type**

In `app/src/renderer/env.d.ts`, find the `listPRs` line (~107) and add `body` and `requestedReviewers` to the array element type:

```ts
    listPRs: (repoPath: string) => Promise<{ ok: boolean; prs: Array<{ number: number; title: string; state: string; author: { login: string; name: string }; createdAt: string; headRefName: string; reviewDecision: string | null; url: string; additions: number; deletions: number; changedFiles: number; body: string; requestedReviewers: string[] }> }>
```

- [ ] **Step 3: Verify types compile**

Run: `cd app && npx tsc --noEmit 2>&1 | grep -E 'github\.ts|env\.d\.ts' || echo "(clean)"`
Expected: `(clean)`.

- [ ] **Step 4: Commit**

```bash
git add app/src/main/github.ts app/src/renderer/env.d.ts
git commit -m "feat(inbox): add body + requestedReviewers to listPRs"
```

---

## Task 2: `mergePR` capability (Publish = merge + delete branch)

**Files:**
- Modify: `app/src/main/github.ts` (add `mergePR`)
- Modify: `app/src/main/index.ts` (add `git:mergePR` handler)
- Modify: `app/src/preload/index.ts` (add bridge)
- Modify: `app/src/renderer/env.d.ts` (add type)

**Interfaces:**
- Produces: `window.api.git.mergePR(repoPath: string, prNumber: number) => Promise<{ ok: boolean; error?: string }>` — squash-merges the PR then deletes its head branch; friendly error on failure (e.g. branch protection).

- [ ] **Step 1: Add the github function**

Append to `app/src/main/github.ts`:

```ts
export async function mergePR(repoPath: string, num: number) {
  const { owner, repo } = await ownerRepo(repoPath)
  const pr = await gh(`/repos/${owner}/${repo}/pulls/${num}`) as { head: { ref: string } }
  await gh(`/repos/${owner}/${repo}/pulls/${num}/merge`, { method: 'PUT', body: JSON.stringify({ merge_method: 'squash' }) })
  // Deleting the merged branch is best-effort (may be protected or already gone).
  try { await gh(`/repos/${owner}/${repo}/git/refs/heads/${pr.head.ref}`, { method: 'DELETE' }) } catch { /* ignore */ }
}
```

- [ ] **Step 2: Add the IPC handler**

In `app/src/main/index.ts`, next to the other `git:` handlers (e.g. after `git:publish`), add:

```ts
ipcMain.handle('git:mergePR', async (_event, repoPath: string, num: number) => {
  try { await github.mergePR(repoPath, num); return { ok: true } }
  catch (error) { logError('mergePR', error); return { ok: false, error: String(error) } }
})
```

- [ ] **Step 3: Add the preload bridge**

In `app/src/preload/index.ts`, in the `git:` object (near `publish`), add:

```ts
    mergePR: (repoPath: string, prNumber: number) => ipcRenderer.invoke('git:mergePR', repoPath, prNumber),
```

- [ ] **Step 4: Add the renderer type**

In `app/src/renderer/env.d.ts`, in the `git:` block (near `publish`), add:

```ts
    mergePR: (repoPath: string, prNumber: number) => Promise<{ ok: boolean; error?: string }>
```

- [ ] **Step 5: Verify types compile**

Run: `cd app && npx tsc --noEmit 2>&1 | grep -E 'github\.ts|index\.ts|preload|env\.d\.ts' || echo "(clean)"`
Expected: `(clean)`.

- [ ] **Step 6: Commit**

```bash
git add app/src/main/github.ts app/src/main/index.ts app/src/preload/index.ts app/src/renderer/env.d.ts
git commit -m "feat(inbox): add mergePR (squash-merge + delete branch) for Publish"
```

---

## Task 3: PR classifier (pure, TDD)

**Files:**
- Create: `app/src/renderer/utils/inboxClassify.ts`
- Test: `app/src/renderer/utils/__tests__/inboxClassify.test.ts`

**Interfaces:**
- Produces:
  - `type InboxTab = 'review' | 'publish' | 'drafts'`
  - `type InboxAction = 'review' | 'publish' | 'make-edits' | 'view'`
  - `type InboxBadge = 'approved' | 'changes' | 'inreview' | null`
  - `interface ClassifiablePR { author: { login: string }; requestedReviewers: string[]; reviewDecision: string | null }`
  - `interface InboxClassification { tab: InboxTab | null; action: InboxAction; badge: InboxBadge }`
  - `classifyInboxPR(pr: ClassifiablePR, login: string): InboxClassification`

- [ ] **Step 1: Write the failing test**

Create `app/src/renderer/utils/__tests__/inboxClassify.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { classifyInboxPR } from '../inboxClassify'

const me = 'kristi'
const pr = (over: Partial<Parameters<typeof classifyInboxPR>[0]>) =>
  ({ author: { login: 'other' }, requestedReviewers: [], reviewDecision: null, ...over })

describe('classifyInboxPR', () => {
  it('my approved PR is Ready to publish', () => {
    expect(classifyInboxPR(pr({ author: { login: me }, reviewDecision: 'APPROVED' }), me))
      .toEqual({ tab: 'publish', action: 'publish', badge: 'approved' })
  })
  it('my changes-requested PR is a draft with Make Edits', () => {
    expect(classifyInboxPR(pr({ author: { login: me }, reviewDecision: 'CHANGES_REQUESTED' }), me))
      .toEqual({ tab: 'drafts', action: 'make-edits', badge: 'changes' })
  })
  it('my in-review PR is a draft with View', () => {
    expect(classifyInboxPR(pr({ author: { login: me } }), me))
      .toEqual({ tab: 'drafts', action: 'view', badge: 'inreview' })
  })
  it("someone else's PR requesting my review is Needs your review", () => {
    expect(classifyInboxPR(pr({ requestedReviewers: [me] }), me))
      .toEqual({ tab: 'review', action: 'review', badge: null })
  })
  it("someone else's PR not requesting me is hidden", () => {
    expect(classifyInboxPR(pr({ requestedReviewers: ['other2'] }), me).tab).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/renderer/utils/__tests__/inboxClassify.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `app/src/renderer/utils/inboxClassify.ts`:

```ts
export type InboxTab = 'review' | 'publish' | 'drafts'
export type InboxAction = 'review' | 'publish' | 'make-edits' | 'view'
export type InboxBadge = 'approved' | 'changes' | 'inreview' | null

export interface ClassifiablePR {
  author: { login: string }
  requestedReviewers: string[]
  reviewDecision: string | null   // 'APPROVED' | 'CHANGES_REQUESTED' | null
}

export interface InboxClassification {
  tab: InboxTab | null            // null = not shown in the inbox
  action: InboxAction
  badge: InboxBadge
}

/** Map an open PR + the current user's login to a tab, primary action, and badge. */
export function classifyInboxPR(pr: ClassifiablePR, login: string): InboxClassification {
  const mine = pr.author.login === login
  if (mine) {
    if (pr.reviewDecision === 'APPROVED') return { tab: 'publish', action: 'publish', badge: 'approved' }
    if (pr.reviewDecision === 'CHANGES_REQUESTED') return { tab: 'drafts', action: 'make-edits', badge: 'changes' }
    return { tab: 'drafts', action: 'view', badge: 'inreview' }
  }
  if (pr.requestedReviewers.includes(login)) return { tab: 'review', action: 'review', badge: null }
  return { tab: null, action: 'view', badge: null }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/renderer/utils/__tests__/inboxClassify.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/renderer/utils/inboxClassify.ts app/src/renderer/utils/__tests__/inboxClassify.test.ts
git commit -m "feat(inbox): add pure PR classifier (tab/action/badge)"
```

---

## Task 4: `InboxRow` component

**Files:**
- Create: `app/src/renderer/components/InboxRow.tsx`
- Create: `app/src/renderer/components/InboxRow.css`

**Interfaces:**
- Consumes: `primaryColor`, `softTint` (`utils/appearance`); `Badge` (`components/Badge`); `InboxAction`, `InboxBadge` (`utils/inboxClassify`).
- Produces: `InboxRow` component with props:
  ```ts
  interface InboxRowProps {
    to: string                 // review page path, for review/view actions
    title: string
    meta: string
    color: string             // system gradient
    icon: React.ReactNode
    action: InboxAction
    badge: InboxBadge
    url: string               // GitHub PR url (for the ⋯ menu)
    publishing?: boolean
    onPublish: () => void
    onMakeEdits: () => void
  }
  ```

- [ ] **Step 1: Write the component**

Create `app/src/renderer/components/InboxRow.tsx`:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Badge from './Badge'
import { primaryColor, softTint } from '../utils/appearance'
import { InboxAction, InboxBadge } from '../utils/inboxClassify'
import './InboxRow.css'

interface InboxRowProps {
  to: string
  title: string
  meta: string
  color: string
  icon: React.ReactNode
  action: InboxAction
  badge: InboxBadge
  url: string
  publishing?: boolean
  onPublish: () => void
  onMakeEdits: () => void
}

const BADGE = {
  approved: { variant: 'success' as const, label: 'Approved' },
  changes: { variant: 'warning' as const, label: 'Changes requested' },
  inreview: { variant: 'neutral' as const, label: 'In review' },
}

export default function InboxRow({ to, title, meta, color, icon, action, badge, url, publishing, onPublish, onMakeEdits }: InboxRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const tint = softTint(primaryColor(color))

  const primary =
    action === 'review' ? <Link to={to} className="inboxrow-btn primary">Review</Link>
    : action === 'view' ? <Link to={to} className="inboxrow-btn ghost">View</Link>
    : action === 'make-edits' ? <button className="inboxrow-btn primary" onClick={onMakeEdits}>Make Edits</button>
    : <button className="inboxrow-btn publish" onClick={onPublish} disabled={publishing}>{publishing ? 'Publishing…' : 'Publish'}</button>

  return (
    <div className="inboxrow">
      <div className="inboxrow-chip" style={{ background: tint }}>{icon}</div>
      <div className="inboxrow-body">
        <div className="inboxrow-title">{title}</div>
        <div className="inboxrow-meta">{meta}</div>
      </div>
      <div className="inboxrow-right">
        {badge && <Badge variant={BADGE[badge].variant}>{BADGE[badge].label}</Badge>}
        {primary}
        <div className="inboxrow-menu-wrap">
          <button className="inboxrow-kebab" onClick={() => setMenuOpen(o => !o)} aria-label="More actions">⋯</button>
          {menuOpen && (
            <>
              <div className="inboxrow-menu-scrim" onClick={() => setMenuOpen(false)} />
              <div className="inboxrow-menu">
                {action === 'view' && <button className="inboxrow-menu-item" onClick={() => { setMenuOpen(false); onMakeEdits() }}>Make edits</button>}
                <button className="inboxrow-menu-item" onClick={() => { setMenuOpen(false); window.open(url) }}>View on GitHub</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write the styles**

Create `app/src/renderer/components/InboxRow.css`:

```css
.inboxrow {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 13px 15px;
  border-bottom: 1px solid var(--color-border-subtle);
}
.inboxrow:last-child { border-bottom: none; }

.inboxrow-chip {
  width: 34px; height: 34px; border-radius: var(--radius-md);
  display: flex; align-items: center; justify-content: center; flex: none;
  color: var(--color-text-primary);
}
.inboxrow-body { flex: 1; min-width: 0; }
.inboxrow-title {
  font-size: var(--text-sm); font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary); letter-spacing: -0.01em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.inboxrow-meta {
  font-size: var(--text-xs); color: var(--color-text-tertiary); margin-top: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.inboxrow-right { display: flex; align-items: center; gap: var(--space-2); flex: none; }

.inboxrow-btn {
  border: none; border-radius: 8px; padding: 7px 14px;
  font-size: var(--text-xs); font-weight: var(--font-weight-semibold);
  font-family: inherit; cursor: pointer; text-decoration: none; white-space: nowrap;
  transition: filter 140ms ease;
}
.inboxrow-btn:hover { filter: brightness(0.96); }
.inboxrow-btn.primary { background: var(--amp-violet-700); color: var(--amp-white); }
.inboxrow-btn.publish { background: var(--color-status-success); color: var(--amp-white); }
.inboxrow-btn.publish:disabled { opacity: 0.6; cursor: default; }
.inboxrow-btn.ghost { background: var(--amp-white); color: var(--color-text-secondary); border: 1px solid var(--color-border-default); }

.inboxrow-menu-wrap { position: relative; }
.inboxrow-kebab {
  background: none; border: none; color: var(--amp-gray-400);
  font-size: 16px; line-height: 1; padding: 4px 6px; border-radius: 6px; cursor: pointer;
}
.inboxrow-kebab:hover { background: var(--color-bg-secondary); }
.inboxrow-menu-scrim { position: fixed; inset: 0; z-index: 10; }
.inboxrow-menu {
  position: absolute; right: 0; top: 30px; z-index: 11;
  background: var(--amp-white); border: 1px solid var(--color-border-default);
  border-radius: 10px; box-shadow: var(--shadow-md); padding: 5px; width: 168px;
}
.inboxrow-menu-item {
  display: block; width: 100%; text-align: left;
  padding: 8px 10px; font-size: var(--text-xs); color: var(--color-text-primary);
  background: none; border: none; border-radius: 7px; cursor: pointer; font-family: inherit;
}
.inboxrow-menu-item:hover { background: var(--color-bg-tertiary); }

@media (prefers-reduced-motion: reduce) { .inboxrow-btn { transition: none; } }
```

- [ ] **Step 3: Verify types compile**

Run: `cd app && npx tsc --noEmit 2>&1 | grep -E 'InboxRow' || echo "(clean)"`
Expected: `(clean)`.

- [ ] **Step 4: Commit**

```bash
git add app/src/renderer/components/InboxRow.tsx app/src/renderer/components/InboxRow.css
git commit -m "feat(inbox): add InboxRow (chip, meta, badge, action, overflow menu)"
```

---

## Task 5: Rebuild the Inbox as a tabbed action queue

**Files:**
- Modify: `app/src/renderer/pages/Inbox.tsx` (full rewrite)
- Modify: `app/src/renderer/pages/Inbox.css` (full rewrite)

**Interfaces:**
- Consumes: `classifyInboxPR`, `InboxTab` (Task 3); `InboxRow` (Task 4); `getSystems` (`utils/systemStore`); `iconMap`, `BookIcon` (`components/SystemIcons`); `useProfile` (`hooks/useProfile`); `useOnline` (`hooks/useOnline`); `useNavigate` (react-router).

- [ ] **Step 1: Rewrite `Inbox.tsx`**

Replace the entire contents of `app/src/renderer/pages/Inbox.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSystems } from '../utils/systemStore'
import { iconMap, BookIcon } from '../components/SystemIcons'
import { useOnline } from '../hooks/useOnline'
import { useProfile } from '../hooks/useProfile'
import { classifyInboxPR, InboxTab } from '../utils/inboxClassify'
import InboxRow from '../components/InboxRow'
import './Inbox.css'

interface Item {
  systemId: string
  systemName: string
  systemColor: string
  systemIcon: string
  repoPath: string
  number: number
  title: string
  authorName: string
  headRefName: string
  createdAt: string
  changedFiles: number
  url: string
  tab: InboxTab
  action: ReturnType<typeof classifyInboxPR>['action']
  badge: ReturnType<typeof classifyInboxPR>['badge']
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(diff / 86400000)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const TABS: { key: InboxTab; label: string }[] = [
  { key: 'review', label: 'Needs your review' },
  { key: 'publish', label: 'Ready to publish' },
  { key: 'drafts', label: 'Your drafts' },
]

const EMPTY: Record<InboxTab, string> = {
  review: "You're all caught up — no reviews waiting on you.",
  publish: 'Nothing to publish right now.',
  drafts: 'No drafts in progress.',
}

export default function Inbox() {
  const [items, setItems] = useState<Item[]>([])
  const [tab, setTab] = useState<InboxTab>('review')
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState<number | null>(null)
  const online = useOnline()
  const profile = useProfile()
  const navigate = useNavigate()

  const load = async () => {
    if (!online || !profile.login) { setLoading(false); return }
    setLoading(true)
    const all: Item[] = []
    for (const sys of getSystems()) {
      if (!sys.folderPath) continue
      try {
        const result = await window.api.git.listPRs(sys.folderPath)
        if (result.ok && result.prs) {
          for (const pr of result.prs) {
            const c = classifyInboxPR(pr, profile.login)
            if (!c.tab) continue
            all.push({
              systemId: sys.id, systemName: sys.name, systemColor: sys.gradient, systemIcon: sys.icon,
              repoPath: sys.folderPath, number: pr.number, title: pr.title,
              authorName: pr.author.name || pr.author.login, headRefName: pr.headRefName,
              createdAt: pr.createdAt, changedFiles: pr.changedFiles, url: pr.url,
              tab: c.tab, action: c.action, badge: c.badge,
            })
          }
        }
      } catch { /* ignore */ }
    }
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    setItems(all)
    setLoading(false)
  }

  useEffect(() => { void load() }, [online, profile.login])

  const count = (t: InboxTab) => items.filter(i => i.tab === t).length
  const shown = items.filter(i => i.tab === tab)

  const metaFor = (i: Item) =>
    i.tab === 'review'
      ? `${i.authorName} · ${i.systemName} · ${i.changedFiles} file${i.changedFiles === 1 ? '' : 's'} · ${timeAgo(i.createdAt)}`
      : `${i.systemName} · ${i.changedFiles} file${i.changedFiles === 1 ? '' : 's'} · ${timeAgo(i.createdAt)}`

  const publish = async (i: Item) => {
    setPublishing(i.number)
    const r = await window.api.git.mergePR(i.repoPath, i.number)
    setPublishing(null)
    if (r.ok) { await load() } else { alert(`Couldn't publish: ${r.error}`) }
  }

  const makeEdits = async (i: Item) => {
    await window.api.git.switchBranch(i.repoPath, i.headRefName)
    navigate(`/system/${i.systemId}`)
  }

  return (
    <div className="inbox-page">
      <div className="inbox-inner">
        <h1 className="inbox-title">Inbox</h1>
        <p className="inbox-subtitle">Reviews waiting on you, and your work in progress.</p>

        <div className="inbox-tabs">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`inbox-tab ${tab === t.key ? 'on' : ''} ${t.key === 'publish' ? 'publish' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label} <span className="inbox-tab-count">{count(t.key)}</span>
            </button>
          ))}
        </div>

        <div className="inbox-list">
          {!online && <div className="inbox-empty">You're offline — your inbox will refresh when you reconnect.</div>}
          {online && loading && <div className="inbox-empty">Loading…</div>}
          {online && !loading && shown.length === 0 && <div className="inbox-empty">{EMPTY[tab]}</div>}
          {online && !loading && shown.map(i => (
            <InboxRow
              key={`${i.systemId}-${i.number}`}
              to={`/review/${i.systemId}/${i.number}`}
              title={i.title}
              meta={metaFor(i)}
              color={i.systemColor}
              icon={(() => { const Icon = iconMap[i.systemIcon] || BookIcon; return <Icon size={17} /> })()}
              action={i.action}
              badge={i.badge}
              url={i.url}
              publishing={publishing === i.number}
              onPublish={() => publish(i)}
              onMakeEdits={() => makeEdits(i)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `Inbox.css`**

Replace the entire contents of `app/src/renderer/pages/Inbox.css`:

```css
.inbox-page {
  overflow-y: auto;
  height: 100%;
  padding-top: 52px;
}

.inbox-inner {
  max-width: 880px;
  margin: 0 auto;
  padding: 0 48px 80px;
}

.inbox-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
  margin-bottom: 3px;
}
.inbox-subtitle {
  font-size: var(--text-sm);
  color: var(--color-text-tertiary);
  margin-bottom: 22px;
}

.inbox-tabs {
  display: inline-flex;
  gap: 3px;
  background: var(--amp-white);
  border: 1px solid var(--color-border-default);
  border-radius: 10px;
  padding: 3px;
  margin-bottom: 18px;
}
.inbox-tab {
  display: flex; align-items: center; gap: 7px;
  padding: 7px 14px;
  font-size: var(--text-xs); font-weight: var(--font-weight-semibold);
  border: none; background: none; color: var(--color-text-secondary);
  border-radius: 8px; cursor: pointer; font-family: inherit;
  transition: background 120ms ease, color 120ms ease;
}
.inbox-tab:hover { color: var(--color-text-primary); }
.inbox-tab.on { background: var(--amp-violet-700); color: var(--amp-white); }
.inbox-tab.publish.on { background: var(--color-status-success); }
.inbox-tab-count {
  font-size: 10px; font-weight: 700;
  background: var(--color-bg-secondary); color: var(--color-text-secondary);
  border-radius: 9px; padding: 1px 6px;
}
.inbox-tab.on .inbox-tab-count { background: rgba(255,255,255,0.25); color: var(--amp-white); }

.inbox-list {
  background: var(--amp-white);
  border: 1px solid var(--color-border-default);
  border-radius: 14px;
  overflow: visible;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}

.inbox-empty {
  padding: 48px 20px;
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: var(--text-sm);
}

@media (prefers-reduced-motion: reduce) { .inbox-tab { transition: none; } }
```

- [ ] **Step 3: Verify types compile and unit tests pass**

Run: `cd app && npx tsc --noEmit 2>&1 | grep -E 'Inbox\.tsx|InboxRow|inboxClassify' || echo "(clean)"; npx vitest run src/renderer/utils/__tests__/inboxClassify.test.ts`
Expected: `(clean)`; classifier tests PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/renderer/pages/Inbox.tsx app/src/renderer/pages/Inbox.css
git commit -m "feat(inbox): tabbed action queue (needs review / ready to publish / your drafts)"
```

---

## Task 6: Visual-critique + apple-design polish pass

**Files:** any Inbox files above, as findings require (never WIP files).

- [ ] **Step 1: Build and launch**

Launch the app (dev). Ensure at least one connected system with open PRs — ideally one requesting your review, one of your own in review, one approved (to populate all three tabs). If real PRs are unavailable, screenshot with whatever exists.

- [ ] **Step 2: Capture and critique**

Screenshot each tab. Invoke `visual-critique:critique-screen` on the Inbox and produce a prioritized fix list (hierarchy, composition, color, typography, density, affordance, brand consistency).

- [ ] **Step 3: Apple-design checklist**

Against `.agents/skills/apple-design/SKILL.md`: instant/compositor-only hover feedback; ~120–150ms transitions; `prefers-reduced-motion`/`prefers-contrast` behave; tab labels tracking; the tab counts and primary buttons read as the clear focal actions; plain-language copy (no git jargon).

- [ ] **Step 4: Apply high/medium fixes**

Implement high- and medium-priority findings in the Inbox files. Re-screenshot to confirm.

- [ ] **Step 5: Full verification**

Run: `cd app && npx tsc --noEmit 2>&1 | grep -E 'Inbox|inboxClassify|github\.ts|env\.d\.ts' || echo "(clean)"; npx vitest run`
Expected: `(clean)`; all tests PASS. Confirm the app launches and all three tabs render with correct actions.

- [ ] **Step 6: Commit**

```bash
git add app/src/renderer/pages/Inbox.tsx app/src/renderer/pages/Inbox.css app/src/renderer/components/InboxRow.css
git commit -m "polish(inbox): apply visual-critique + apple-design findings"
```

---

## Self-Review (completed)

**Spec coverage (Part 1 scope):** tabbed three-tab action queue (T5) ✓; classifier for the taxonomy (T3) ✓; row anatomy + ⋯ overflow + View on GitHub + per-state actions (T4) ✓; Publish = merge + delete branch (T2) ✓; Make Edits = switch branch + open system (T5) ✓; `requestedReviewers`/`body` foundation (T1) ✓; plain-language empty/offline states (T5) ✓; design-system reuse — chips, Badge, tokens (T4/T5) ✓; sidebar count already exists (`reviewRequestCount`) — unchanged, still valid. **Deferred to Part 2:** role-aware Review page, author mode, feedback callout, `latestReview`, Updated-version/What-changed, sticky bar, PR-body display.

**Placeholder scan:** none — every step has concrete code or exact commands.

**Type consistency:** `classifyInboxPR` return (`tab`/`action`/`badge`) matches `InboxRow` props and `Item` fields (T3↔T4↔T5); `mergePR`/`listPRs` signatures match across `github.ts`, `env.d.ts`, and `Inbox.tsx` usage (T1/T2↔T5); `InboxAction`/`InboxBadge` imported consistently (T3↔T4).
