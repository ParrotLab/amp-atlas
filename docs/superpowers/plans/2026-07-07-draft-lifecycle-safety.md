# Draft Lifecycle & Work-Loss Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make drafts ephemeral, safe, and legible — an app-owned draft registry (only app-known drafts show), fresh-from-Live-Version branching, Save-or-Discard on draft switch (no silent stash), archive-that-keeps-work, merged-only deletion, plus two onboarding flows ("Add existing work…" and "Move changes into a draft").

**Architecture:** A pure `localStorage` **draft registry** (`draftStore`) owns per-user draft visibility/state. Testable git operations live in a new `draftOps` module the IPC handlers call. The renderer enforces the Save-or-Discard rule (main no longer stashes). All git vocabulary stays hidden behind Draft / Live Version / Save / Archive.

**Tech Stack:** Electron + `simple-git`, React 19, Vitest + jsdom (renderer) / node (main).

**Spec:** `docs/superpowers/specs/2026-07-07-draft-lifecycle-safety-design.md`

---

## File Structure

**New**
- `app/src/renderer/utils/draftStore.ts` — per-user draft registry (localStorage). Pure, unit-tested.
- `app/src/main/draftOps.ts` — testable git operations (slugify, create-from-main, switch, create-from-changes, list-adoptable).
- `app/src/renderer/components/ConfirmSwitchModal.tsx` + `.css` — Save / Discard / Cancel modal.

**Modify**
- `app/src/main/index.ts` — wire handlers to `draftOps`; add `git:createDraftFromChanges`, `git:listAdoptableBranches`; keep `git:deleteBranch` for merged-retire only.
- `app/src/preload/index.ts` + `app/src/renderer/env.d.ts` — new IPC surface.
- `app/src/renderer/pages/SystemOverview.tsx` — registry wiring, Save-or-Discard orchestration, archive-as-registry, Flow-2 detection, last-saved read.
- `app/src/renderer/components/StatusBar.tsx` — registry-driven draft lists, Archived section, "Add existing work…", "Move changes into a draft", legible status.

**Conventions:** run all commands from `app/`. Every task ends with a commit. `git` commands run from the repo root (`cd ..`).

---

## Phase 0 — Draft registry (pure, TDD)

### Task 1: `draftStore`

**Files:**
- Create: `app/src/renderer/utils/draftStore.ts`
- Test: `app/src/renderer/utils/__tests__/draftStore.test.ts`

- [ ] **Step 1: Write failing tests**

Create `app/src/renderer/utils/__tests__/draftStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerDraft, setDraftState, touchDraft, removeDraft,
  getDraft, listActive, listArchived,
} from '../draftStore'

beforeEach(() => localStorage.clear())

describe('draftStore', () => {
  it('registers a draft as active with a title', () => {
    registerDraft('sys1', 'draft/onboarding', 'Onboarding')
    const d = getDraft('sys1', 'draft/onboarding')!
    expect(d.title).toBe('Onboarding')
    expect(d.state).toBe('active')
  })

  it('lists only active drafts under active, archived under archived', () => {
    registerDraft('sys1', 'draft/a', 'A')
    registerDraft('sys1', 'draft/b', 'B')
    setDraftState('sys1', 'draft/b', 'archived')
    expect(listActive('sys1').map(d => d.branch)).toEqual(['draft/a'])
    expect(listArchived('sys1').map(d => d.branch)).toEqual(['draft/b'])
  })

  it('isolates drafts per system', () => {
    registerDraft('sys1', 'draft/a', 'A')
    registerDraft('sys2', 'draft/a', 'A')
    setDraftState('sys1', 'draft/a', 'archived')
    expect(listActive('sys1')).toHaveLength(0)
    expect(listActive('sys2')).toHaveLength(1)
  })

  it('touch updates lastOpenedAt without changing state', () => {
    registerDraft('sys1', 'draft/a', 'A')
    setDraftState('sys1', 'draft/a', 'archived')
    touchDraft('sys1', 'draft/a')
    expect(getDraft('sys1', 'draft/a')!.state).toBe('archived')
  })

  it('removes a draft entirely', () => {
    registerDraft('sys1', 'draft/a', 'A')
    removeDraft('sys1', 'draft/a')
    expect(getDraft('sys1', 'draft/a')).toBeUndefined()
  })

  it('re-registering an existing branch keeps it and refreshes title', () => {
    registerDraft('sys1', 'draft/a', 'Old')
    setDraftState('sys1', 'draft/a', 'archived')
    registerDraft('sys1', 'draft/a', 'New')
    const d = getDraft('sys1', 'draft/a')!
    expect(d.title).toBe('New')
    expect(d.state).toBe('active')
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `cd app && npx vitest run src/renderer/utils/__tests__/draftStore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `app/src/renderer/utils/draftStore.ts`:

```typescript
export type DraftState = 'active' | 'archived'

export interface DraftEntry {
  branch: string
  title: string
  state: DraftState
  createdAt: string
  lastOpenedAt: string
}

type Store = Record<string, Record<string, DraftEntry>> // systemId -> branch -> entry

const KEY = 'amp-drafts-v1'

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return {}
}

function write(store: Store): void {
  localStorage.setItem(KEY, JSON.stringify(store))
}

export function getDrafts(systemId: string): DraftEntry[] {
  return Object.values(read()[systemId] || {})
}

export function getDraft(systemId: string, branch: string): DraftEntry | undefined {
  return read()[systemId]?.[branch]
}

export function listActive(systemId: string): DraftEntry[] {
  return getDrafts(systemId).filter(d => d.state === 'active')
}

export function listArchived(systemId: string): DraftEntry[] {
  return getDrafts(systemId).filter(d => d.state === 'archived')
}

/** Upsert a draft as active; refresh title + timestamps. */
export function registerDraft(systemId: string, branch: string, title: string): DraftEntry {
  const store = read()
  const now = new Date().toISOString()
  const existing = store[systemId]?.[branch]
  const entry: DraftEntry = {
    branch,
    title,
    state: 'active',
    createdAt: existing?.createdAt || now,
    lastOpenedAt: now,
  }
  store[systemId] = { ...(store[systemId] || {}), [branch]: entry }
  write(store)
  return entry
}

export function setDraftState(systemId: string, branch: string, state: DraftState): void {
  const store = read()
  const entry = store[systemId]?.[branch]
  if (!entry) return
  entry.state = state
  write(store)
}

export function touchDraft(systemId: string, branch: string): void {
  const store = read()
  const entry = store[systemId]?.[branch]
  if (!entry) return
  entry.lastOpenedAt = new Date().toISOString()
  write(store)
}

export function removeDraft(systemId: string, branch: string): void {
  const store = read()
  if (store[systemId]) {
    delete store[systemId][branch]
    write(store)
  }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd app && npx vitest run src/renderer/utils/__tests__/draftStore.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
cd .. && git add app/src/renderer/utils/draftStore.ts app/src/renderer/utils/__tests__/draftStore.test.ts && git commit -m "feat: app-owned draft registry (draftStore)"
```

---

## Phase 1 — Git operations (`draftOps`, TDD against temp repos)

### Task 2: `slugifyDraft` + `listAdoptableBranches`

**Files:**
- Create: `app/src/main/draftOps.ts`
- Test: `app/src/main/__tests__/draftOps.test.ts`

- [ ] **Step 1: Write failing tests**

Create `app/src/main/__tests__/draftOps.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { simpleGit } from 'simple-git'
import { slugifyDraft, listAdoptableBranches } from '../draftOps'

async function tempRepo(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'amp-'))
  const git = simpleGit(dir)
  await git.init()
  await git.addConfig('user.email', 't@t.com')
  await git.addConfig('user.name', 'T')
  await git.checkoutLocalBranch('main')
  writeFileSync(join(dir, 'readme.md'), '# hi\n')
  await git.add('-A')
  await git.commit('init')
  return dir
}

describe('slugifyDraft', () => {
  it('slugifies with a draft/ prefix', () => {
    expect(slugifyDraft('My Cool Draft')).toBe('draft/my-cool-draft')
  })
  it('strips leading/trailing separators', () => {
    expect(slugifyDraft('  Hello!! ')).toBe('draft/hello')
  })
})

describe('listAdoptableBranches', () => {
  it('returns local branches except main/master', async () => {
    const dir = await tempRepo()
    const git = simpleGit(dir)
    await git.branch(['feature-a'])
    await git.branch(['feature-b'])
    const names = (await listAdoptableBranches(dir)).map(b => b.name).sort()
    expect(names).toEqual(['feature-a', 'feature-b'])
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `cd app && npx vitest run src/main/__tests__/draftOps.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement (partial file)**

Create `app/src/main/draftOps.ts`:

```typescript
import { simpleGit } from 'simple-git'

export function slugifyDraft(name: string): string {
  return 'draft/' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export interface AdoptableBranch {
  name: string
  isRemoteOnly: boolean
}

/** Branches the app could adopt: local + remote (origin/*), excluding main/master. */
export async function listAdoptableBranches(repoPath: string): Promise<AdoptableBranch[]> {
  const git = simpleGit(repoPath)
  const info = await git.branch(['-a'])
  const skip = new Set(['main', 'master'])
  const local = new Set<string>()
  const result: AdoptableBranch[] = []

  for (const raw of info.all) {
    if (raw.startsWith('remotes/')) continue
    if (skip.has(raw)) continue
    local.add(raw)
    result.push({ name: raw, isRemoteOnly: false })
  }
  for (const raw of info.all) {
    if (!raw.startsWith('remotes/origin/')) continue
    const name = raw.replace('remotes/origin/', '')
    if (skip.has(name) || name === 'HEAD' || local.has(name)) continue
    result.push({ name, isRemoteOnly: true })
  }
  return result
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd app && npx vitest run src/main/__tests__/draftOps.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
cd .. && git add app/src/main/draftOps.ts app/src/main/__tests__/draftOps.test.ts && git commit -m "feat: draftOps slugify + list adoptable branches"
```

### Task 3: `createDraftFromChanges` + `switchDraft`

**Files:**
- Modify: `app/src/main/draftOps.ts`
- Modify: `app/src/main/__tests__/draftOps.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `app/src/main/__tests__/draftOps.test.ts` (add the imports to the existing top `import { slugifyDraft, listAdoptableBranches } from '../draftOps'` line → make it `import { slugifyDraft, listAdoptableBranches, createDraftFromChanges, switchDraft } from '../draftOps'`):

```typescript
describe('createDraftFromChanges', () => {
  it('creates a draft carrying the uncommitted changes, leaving main branch selectable', async () => {
    const dir = await tempRepo()
    writeFileSync(join(dir, 'readme.md'), '# hi\n\nedited outside the app\n')
    const { branch } = await createDraftFromChanges(dir, 'From Main Edits')
    const git = simpleGit(dir)
    const status = await git.status()
    expect(status.current).toBe('draft/from-main-edits')
    expect(branch).toBe('draft/from-main-edits')
    // the edit is still present (carried onto the new draft)
    expect(status.modified).toContain('readme.md')
  })
})

describe('switchDraft', () => {
  it('checks out an existing branch', async () => {
    const dir = await tempRepo()
    await simpleGit(dir).branch(['feature-x'])
    await switchDraft(dir, 'feature-x')
    expect((await simpleGit(dir).status()).current).toBe('feature-x')
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `cd app && npx vitest run src/main/__tests__/draftOps.test.ts`
Expected: FAIL — `createDraftFromChanges`/`switchDraft` not exported.

- [ ] **Step 3: Implement (append to `draftOps.ts`)**

```typescript
/** Create a new draft that carries the current uncommitted working-tree changes (Flow 2). */
export async function createDraftFromChanges(repoPath: string, draftName: string): Promise<{ branch: string }> {
  const git = simpleGit(repoPath)
  const branch = slugifyDraft(draftName)
  // checkoutLocalBranch keeps the dirty working tree; changes follow onto the new branch.
  await git.checkoutLocalBranch(branch)
  return { branch }
}

/** Plain checkout of an existing branch (no stashing — the renderer resolves dirty state first). */
export async function switchDraft(repoPath: string, branch: string): Promise<void> {
  await simpleGit(repoPath).checkout(branch)
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd app && npx vitest run src/main/__tests__/draftOps.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
cd .. && git add app/src/main/draftOps.ts app/src/main/__tests__/draftOps.test.ts && git commit -m "feat: draftOps create-from-changes + plain switch"
```

### Task 4: `createDraftFromMain`

**Files:**
- Modify: `app/src/main/draftOps.ts`
- Modify: `app/src/main/__tests__/draftOps.test.ts`

- [ ] **Step 1: Add failing test (offline / no-remote path)**

Add to the imports line: `createDraftFromMain`. Append test:

```typescript
describe('createDraftFromMain', () => {
  it('branches from main; pulled=false when there is no remote', async () => {
    const dir = await tempRepo()
    // start on a different branch to prove it returns to main first
    await simpleGit(dir).checkoutLocalBranch('scratch')
    const { branch, pulled } = await createDraftFromMain(dir, 'Fresh Draft')
    expect(branch).toBe('draft/fresh-draft')
    expect(pulled).toBe(false)
    expect((await simpleGit(dir).status()).current).toBe('draft/fresh-draft')
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `cd app && npx vitest run src/main/__tests__/draftOps.test.ts`
Expected: FAIL — `createDraftFromMain` not exported.

- [ ] **Step 3: Implement (append to `draftOps.ts`)**

```typescript
/** New Draft: switch to the Live Version, pull latest if possible, then branch. */
export async function createDraftFromMain(repoPath: string, draftName: string): Promise<{ branch: string; pulled: boolean }> {
  const git = simpleGit(repoPath)
  const info = await git.branch()
  const base = info.all.includes('main') ? 'main' : info.all.includes('master') ? 'master' : 'main'
  await git.checkout(base)
  let pulled = false
  try {
    await git.pull(['--ff-only'])
    pulled = true
  } catch {
    // offline / no remote / non-ff — branch from local base with pulled=false
  }
  const branch = slugifyDraft(draftName)
  await git.checkoutLocalBranch(branch)
  return { branch, pulled }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd app && npx vitest run src/main/__tests__/draftOps.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
cd .. && git add app/src/main/draftOps.ts app/src/main/__tests__/draftOps.test.ts && git commit -m "feat: draftOps create-draft-from-fresh-main"
```

---

## Phase 2 — IPC wiring

### Task 5: Wire handlers + new IPC surface

**Files:**
- Modify: `app/src/main/index.ts`
- Modify: `app/src/preload/index.ts`
- Modify: `app/src/renderer/env.d.ts`

- [ ] **Step 1: Import draftOps + replace `git:createDraft` and `git:switchBranch`**

In `app/src/main/index.ts`, add near the other imports:

```typescript
import { createDraftFromMain, createDraftFromChanges, switchDraft, listAdoptableBranches } from './draftOps'
```

Replace the whole `git:createDraft` handler body with:

```typescript
ipcMain.handle('git:createDraft', async (_event, repoPath: string, draftName: string) => {
  try {
    const { branch, pulled } = await createDraftFromMain(repoPath, draftName)
    return { ok: true, branch, pulled }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})
```

Replace the whole `git:switchBranch` handler body (removing the stash logic) with:

```typescript
ipcMain.handle('git:switchBranch', async (_event, repoPath: string, branch: string) => {
  try {
    await switchDraft(repoPath, branch)
    return { ok: true, branch }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})
```

- [ ] **Step 2: Add the two new handlers**

Add after `git:switchBranch` in `app/src/main/index.ts`:

```typescript
ipcMain.handle('git:createDraftFromChanges', async (_event, repoPath: string, draftName: string) => {
  try {
    const { branch } = await createDraftFromChanges(repoPath, draftName)
    return { ok: true, branch }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('git:listAdoptableBranches', async (_event, repoPath: string) => {
  try {
    return { ok: true, branches: await listAdoptableBranches(repoPath) }
  } catch (error) {
    return { ok: false, error: String(error), branches: [] }
  }
})
```

Leave `git:deleteBranch` as-is — it is now used **only** by the merged-retire path.

- [ ] **Step 3: Expose in preload**

In `app/src/preload/index.ts`, inside the `git` object, replace the `createDraft` line and add two methods:

```typescript
    createDraft: (repoPath: string, draftName: string) => ipcRenderer.invoke('git:createDraft', repoPath, draftName),
    createDraftFromChanges: (repoPath: string, draftName: string) => ipcRenderer.invoke('git:createDraftFromChanges', repoPath, draftName),
    listAdoptableBranches: (repoPath: string) => ipcRenderer.invoke('git:listAdoptableBranches', repoPath),
```

- [ ] **Step 4: Add types**

In `app/src/renderer/env.d.ts`, inside the `git:` block of `ElectronAPI`, update `createDraft` and add:

```typescript
    createDraft: (repoPath: string, draftName: string) => Promise<{ ok: boolean; error?: string; branch?: string; pulled?: boolean }>
    createDraftFromChanges: (repoPath: string, draftName: string) => Promise<{ ok: boolean; error?: string; branch?: string }>
    listAdoptableBranches: (repoPath: string) => Promise<{ ok: boolean; error?: string; branches: { name: string; isRemoteOnly: boolean }[] }>
```

- [ ] **Step 5: Typecheck + build + tests**

Run: `cd app && npx tsc -p tsconfig.node.json --noEmit && npx tsc -p tsconfig.web.json --noEmit && npm run build && npm test`
Expected: no type errors; build OK; all tests pass.

- [ ] **Step 6: Commit**

```bash
cd .. && git add app/src/main/index.ts app/src/preload/index.ts app/src/renderer/env.d.ts && git commit -m "feat: wire draftOps IPC (fresh-main, no-stash switch, from-changes, adoptable)"
```

---

## Phase 3 — UI

### Task 6: `ConfirmSwitchModal` (Save / Discard / Cancel)

**Files:**
- Create: `app/src/renderer/components/ConfirmSwitchModal.tsx`
- Create: `app/src/renderer/components/ConfirmSwitchModal.css`

- [ ] **Step 1: Implement the modal**

Create `app/src/renderer/components/ConfirmSwitchModal.tsx`:

```typescript
import { useEffect } from 'react'
import './ConfirmSwitchModal.css'

interface ConfirmSwitchModalProps {
  isOpen: boolean
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export default function ConfirmSwitchModal({ isOpen, onSave, onDiscard, onCancel }: ConfirmSwitchModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div className="confirm-switch-overlay" onClick={onCancel}>
      <div className="confirm-switch-modal" onClick={e => e.stopPropagation()}>
        <div className="confirm-switch-title">You have unsaved edits in this draft</div>
        <div className="confirm-switch-body">
          Save them before switching, or discard them? Discarding can’t be undone.
        </div>
        <div className="confirm-switch-actions">
          <button className="confirm-switch-btn ghost" onClick={onCancel}>Cancel</button>
          <button className="confirm-switch-btn danger" onClick={onDiscard}>Discard</button>
          <button className="confirm-switch-btn primary" onClick={onSave}>Save &amp; switch</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Styles**

Create `app/src/renderer/components/ConfirmSwitchModal.css`:

```css
.confirm-switch-overlay {
  position: fixed; inset: 0; background: rgba(26,26,46,0.35);
  display: flex; align-items: center; justify-content: center; z-index: 1200;
}
.confirm-switch-modal {
  background: #fff; border-radius: 16px; padding: 24px; width: 420px; max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
}
.confirm-switch-title { font-size: 16px; font-weight: 600; color: #1a1a2e; margin-bottom: 8px; }
.confirm-switch-body { font-size: 13px; color: #6B6966; line-height: 1.5; margin-bottom: 20px; }
.confirm-switch-actions { display: flex; justify-content: flex-end; gap: 8px; }
.confirm-switch-btn {
  padding: 8px 16px; font-size: 13px; font-weight: 500; border-radius: 8px;
  border: none; cursor: pointer; font-family: inherit;
}
.confirm-switch-btn.ghost { background: #F0EBE5; color: #6B6966; }
.confirm-switch-btn.danger { background: #FEF2F2; color: #DC2626; }
.confirm-switch-btn.primary { background: #8B2BFF; color: #fff; }
```

- [ ] **Step 3: Build**

Run: `cd app && npm run build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd .. && git add app/src/renderer/components/ConfirmSwitchModal.tsx app/src/renderer/components/ConfirmSwitchModal.css && git commit -m "feat: Save-or-Discard confirm modal"
```

### Task 7: SystemOverview — registry wiring, prompt orchestration, archive, Flow 2, last-saved

**Files:**
- Modify: `app/src/renderer/pages/SystemOverview.tsx`

Context: `systemId` is available; `branch`, `isMainBranch`, `isDirty`, `rootPath`, `showToast`, `fetchGitStatus`, `setTreeKey`, `setTabs`, `setSelectedFile` all already exist. `humanize()` already exists in this file.

- [ ] **Step 1: Imports + registry/last-saved/pending state**

Add imports:

```typescript
import ConfirmSwitchModal from '../components/ConfirmSwitchModal'
import { listActive, listArchived, registerDraft, setDraftState, touchDraft, removeDraft, DraftEntry } from '../utils/draftStore'
```

Add state near the other `useState`s:

```typescript
  const [activeDrafts, setActiveDrafts] = useState<DraftEntry[]>([])
  const [archivedDrafts, setArchivedDrafts] = useState<DraftEntry[]>([])
  const [lastSaved, setLastSaved] = useState<string>('')
  // pending action awaiting Save/Discard resolution when the tree is dirty
  const [pending, setPending] = useState<null | (() => Promise<void>)>(null)

  const refreshDrafts = useCallback(() => {
    if (!systemId) return
    setActiveDrafts(listActive(systemId))
    setArchivedDrafts(listArchived(systemId))
  }, [systemId])

  useEffect(() => { refreshDrafts() }, [refreshDrafts, branch])
```

- [ ] **Step 2: Register the current draft + read last-saved in `fetchGitStatus`**

Inside `fetchGitStatus`, after `setBranch(...)` / `setIsMainBranch(...)` are set from `result.status`, add (using the local `result.status.current`):

```typescript
      const cur = result.status.current
      if (systemId && cur && cur !== 'main' && cur !== 'master') {
        registerDraft(systemId, cur, humanize(cur))
        touchDraft(systemId, cur)
        setActiveDrafts(listActive(systemId))
        setArchivedDrafts(listArchived(systemId))
      }
```

After the branch block in `fetchGitStatus`, read last-saved time:

```typescript
    const logResult = await window.api.git.log(rootPath, 1)
    if (logResult.ok && logResult.log && logResult.log[0]) {
      const d = new Date(logResult.log[0].date)
      const mins = Math.floor((Date.now() - d.getTime()) / 60000)
      setLastSaved(mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)}h ago`)
    }
```

- [ ] **Step 3: The Save-or-Discard guard**

Add a helper that runs an action, prompting first if the tree is dirty:

```typescript
  // Run `action`, but if there are unsaved edits, prompt Save/Discard first.
  const guarded = (action: () => Promise<void>) => {
    if (isDirty && !isMainBranch) {
      setPending(() => action)
    } else {
      void action()
    }
  }

  const resolvePending = async (mode: 'save' | 'discard' | 'cancel') => {
    const action = pending
    setPending(null)
    if (!action || mode === 'cancel') return
    if (mode === 'save') {
      await window.api.git.save(rootPath, `Updated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`)
    } else {
      await window.api.git.discard(rootPath)
    }
    await action()
  }
```

- [ ] **Step 4: Rewrite the draft handlers to use the guard + registry**

Replace `handleSwitchBranch`, `handleCreateDraft`, and `handleArchiveBranch` with:

```typescript
  const doSwitch = async (branchName: string) => {
    setGitModified(new Set()); setGitNew(new Set()); setGitDeleted(new Set())
    setTabs([]); setSelectedFile(undefined); setIsDirty(false)
    const result = await window.api.git.switchBranch(rootPath, branchName)
    if (result.ok) {
      if (systemId && branchName !== 'main' && branchName !== 'master') {
        registerDraft(systemId, branchName, humanize(branchName)); touchDraft(systemId, branchName)
      }
      await new Promise(r => setTimeout(r, 500))
      await fetchGitStatus(); setTreeKey(k => k + 1); refreshDrafts()
    } else {
      showToast(`Couldn't switch: ${result.error}`); await fetchGitStatus()
    }
  }
  const handleSwitchBranch = (branchName: string) => guarded(() => doSwitch(branchName))

  const doCreateDraft = async (name: string) => {
    const result = await window.api.git.createDraft(rootPath, name)
    if (result.ok && result.branch) {
      if (systemId) registerDraft(systemId, result.branch, humanize(result.branch))
      setTabs([]); setSelectedFile(undefined); setIsDirty(false); setTreeKey(k => k + 1)
      await fetchGitStatus(); refreshDrafts()
      if (result.pulled === false) showToast("Draft created from your local Live Version (offline — couldn't pull latest).")
    } else {
      showToast(`Couldn't create draft: ${result.error}`)
    }
  }
  const handleCreateDraft = (name: string) => guarded(() => doCreateDraft(name))

  // Archive = mark archived in the registry (keep the branch); switch off it first if current.
  const handleArchiveBranch = (branchName: string) => guarded(async () => {
    if (!systemId) return
    if (branch === branchName) await doSwitch('main')
    setDraftState(systemId, branchName, 'archived')
    refreshDrafts()
    const entry = archivedDrafts.find(d => d.branch === branchName)
    showToast(`Archived "${humanize(branchName)}". You can restore it anytime.`)
    void entry
  })

  const handleUnarchive = (branchName: string) => {
    if (!systemId) return
    setDraftState(systemId, branchName, 'active'); refreshDrafts()
  }
```

- [ ] **Step 5: Flow 2 — "Move changes into a draft" + adopt**

Add:

```typescript
  const handleMoveChangesToDraft = async (name: string) => {
    const result = await window.api.git.createDraftFromChanges(rootPath, name)
    if (result.ok && result.branch) {
      if (systemId) registerDraft(systemId, result.branch, humanize(result.branch))
      setTabs([]); setSelectedFile(undefined); setTreeKey(k => k + 1)
      await fetchGitStatus(); refreshDrafts()
    } else {
      showToast(`Couldn't move changes into a draft: ${result.error}`)
    }
  }

  const handleAddExistingWork = (branchName: string) => guarded(() => doSwitch(branchName))
```

- [ ] **Step 6: Update the merged-retire effect to clean the registry**

In the `checkMerged` effect, after `deleteBranch`, add registry cleanup. Change the merged block to:

```typescript
      if (result.ok && result.merged && result.branch) {
        showToast(`"${humanize(result.branch)}" has been published and archived. You're now on the Live Version.`)
        await window.api.git.switchBranch(rootPath, 'main')
        await window.api.git.deleteBranch(rootPath, result.branch)
        if (systemId) removeDraft(systemId, result.branch)
        setTabs([]); setSelectedFile(undefined); setTreeKey(k => k + 1)
        await fetchGitStatus(); refreshDrafts()
      }
```

- [ ] **Step 7: Render the modal + pass registry props to StatusBar**

Add `<ConfirmSwitchModal isOpen={!!pending} onSave={() => resolvePending('save')} onDiscard={() => resolvePending('discard')} onCancel={() => resolvePending('cancel')} />` near the other modals.

Update the `<StatusBar ... />` props: remove `branches={allBranches}` and add:

```tsx
          activeDrafts={activeDrafts}
          archivedDrafts={archivedDrafts}
          lastSaved={lastSaved}
          onUnarchive={handleUnarchive}
          onAddExistingWork={handleAddExistingWork}
          onMoveChangesToDraft={handleMoveChangesToDraft}
          repoPath={rootPath}
```

(Keep existing `onSave`, `onDiscard`, `onPublish`, `onSwitchBranch`, `onNewDraft`, `onArchiveBranch`, `prStatus`, capability props.)

- [ ] **Step 8: Typecheck (StatusBar errors expected until Task 8)**

Run: `cd app && npx tsc -p tsconfig.web.json --noEmit 2>&1 | grep SystemOverview || echo "SystemOverview clean"`
Expected: `SystemOverview clean` (StatusBar prop errors are fixed in Task 8).

- [ ] **Step 9: Commit**

```bash
cd .. && git add app/src/renderer/pages/SystemOverview.tsx && git commit -m "feat: registry-driven draft orchestration + Save-or-Discard guard + Flow 2"
```

### Task 8: StatusBar — registry lists, Archived section, Add existing work, legible status

**Files:**
- Modify: `app/src/renderer/components/StatusBar.tsx`

- [ ] **Step 1: Replace props: drop raw branches, add registry + callbacks**

In `StatusBarProps`, remove `branches?: BranchInfo[]` and add:

```typescript
  activeDrafts: { branch: string; title: string }[]
  archivedDrafts: { branch: string; title: string }[]
  lastSaved?: string
  onUnarchive?: (branch: string) => void
  onAddExistingWork?: (branch: string) => void
  onMoveChangesToDraft?: (name: string) => void
  repoPath?: string
```

Update the destructure to drop `branches` and add `activeDrafts, archivedDrafts, lastSaved, onUnarchive, onAddExistingWork, onMoveChangesToDraft, repoPath`.

- [ ] **Step 2: Replace the dropdown body to render registry drafts**

Replace the entire `{showDropdown && (() => { ... })()}` block with one that lists `activeDrafts` under "Your Drafts", an "Archived" section from `archivedDrafts`, and an "Add existing work…" action:

```tsx
              {showDropdown && (
                <>
                  <div className="status-dropdown-overlay" onClick={() => setShowDropdown(false)} />
                  <div className="status-dropdown">
                    <div className="status-dropdown-label">Switch version</div>
                    <button
                      className={`status-dropdown-item ${isMain ? 'active' : ''}`}
                      onClick={() => { onSwitchBranch?.('main'); setShowDropdown(false) }}
                    >
                      <span className="status-dot green" />
                      Live Version
                      {isMain && <span className="status-dropdown-check">✓</span>}
                    </button>

                    {activeDrafts.length > 0 && (
                      <>
                        <div className="status-dropdown-divider" />
                        <div className="status-dropdown-label">Your Drafts</div>
                        {activeDrafts.map(d => (
                          <div key={d.branch} className={`status-dropdown-item ${d.branch === branchName ? 'active' : ''}`}>
                            <span className="status-dot violet" />
                            <span className="status-dropdown-item-name" onClick={() => { onSwitchBranch?.(d.branch); setShowDropdown(false) }}>
                              Draft: {d.title}
                            </span>
                            {d.branch === branchName && <span className="status-dropdown-check">✓</span>}
                            {d.branch !== branchName && (
                              <button className="status-archive-btn" title="Archive this draft" onClick={(e) => { e.stopPropagation(); onArchiveBranch?.(d.branch); setShowDropdown(false) }}>✕</button>
                            )}
                          </div>
                        ))}
                      </>
                    )}

                    {archivedDrafts.length > 0 && (
                      <>
                        <div className="status-dropdown-divider" />
                        <div className="status-dropdown-label">Archived</div>
                        {archivedDrafts.map(d => (
                          <div key={d.branch} className="status-dropdown-item" style={{ color: '#8E8B87' }}>
                            <span className="status-dot" style={{ background: '#B5B1AC' }} />
                            <span className="status-dropdown-item-name">Draft: {d.title}</span>
                            <button className="status-archive-btn" title="Restore this draft" onClick={(e) => { e.stopPropagation(); onUnarchive?.(d.branch); setShowDropdown(false) }}>↩</button>
                          </div>
                        ))}
                      </>
                    )}

                    <div className="status-dropdown-divider" />
                    <button className="status-dropdown-item new-draft" onClick={() => { onNewDraft?.(); setShowDropdown(false) }}>
                      <span style={{ fontSize: '14px', color: '#8B2BFF' }}>+</span>
                      New Draft
                    </button>
                    <button className="status-dropdown-item" style={{ color: '#6B6966' }} onClick={() => { setShowAdopt(true); setShowDropdown(false) }}>
                      Add existing work…
                    </button>
                  </div>
                </>
              )}
```

- [ ] **Step 3: Add the adopt picker + "Move changes into a draft" affordance state**

Add state at the top of the component:

```typescript
  const [showAdopt, setShowAdopt] = useState(false)
  const [adoptable, setAdoptable] = useState<{ name: string; isRemoteOnly: boolean }[]>([])

  useEffect(() => {
    if (!showAdopt || !repoPath) return
    window.api.git.listAdoptableBranches(repoPath).then(r => {
      if (r.ok) {
        const known = new Set([...activeDrafts, ...archivedDrafts].map(d => d.branch))
        setAdoptable(r.branches.filter(b => !known.has(b.name)))
      }
    })
  }, [showAdopt, repoPath, activeDrafts, archivedDrafts])
```

Render the adopt picker (place before the closing `</div>` of `.status-bar`):

```tsx
      {showAdopt && (
        <div className="status-dropdown-overlay" onClick={() => setShowAdopt(false)}>
          <div className="status-dropdown" style={{ left: 20, bottom: 56 }} onClick={e => e.stopPropagation()}>
            <div className="status-dropdown-label">Add existing work</div>
            {adoptable.length === 0 && <div className="status-dropdown-item" style={{ color: '#B5B1AC' }}>Nothing to add</div>}
            {adoptable.map(b => (
              <button key={b.name} className="status-dropdown-item" onClick={() => { onAddExistingWork?.(b.name); setShowAdopt(false) }}>
                <span className="status-dot violet" />
                {b.name}{b.isRemoteOnly ? ' (on GitHub)' : ''}
              </button>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 4: Legible status text + Flow-2 affordance on the Live Version**

Replace the status-left content region that renders `displayBranch`/counts so that, when a draft is active, it shows the plain-language line, and when on a dirty Live Version it offers Flow 2. Add this just after the branch button `</div>` (inside `status-left`, replacing the `{hasChanges ? ... : ...}` block):

```tsx
        {!isMain && (
          <span className="status-item" style={{ color: '#8E8B87' }}>
            {editedCount + newCount > 0 ? `${editedCount + newCount} unsaved edit${editedCount + newCount !== 1 ? 's' : ''}` : 'all changes saved'}
            {lastSaved && ` · saved ${lastSaved}`}
          </span>
        )}
        {isMain && isDirty && (
          <button
            className="status-btn outline"
            onClick={() => { const n = window.prompt('Name this draft:'); if (n && n.trim()) onMoveChangesToDraft?.(n.trim()) }}
          >
            Move changes into a draft
          </button>
        )}
        {isMain && !isDirty && <span style={{ color: '#16A34A' }}>Live Version — read only</span>}
```

- [ ] **Step 5: Typecheck + build**

Run: `cd app && npx tsc -p tsconfig.web.json --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd .. && git add app/src/renderer/components/StatusBar.tsx && git commit -m "feat: registry-driven StatusBar — drafts, archived, add existing work, legible status"
```

---

## Phase 4 — Verify

### Task 9: Full verification + manual smoke

- [ ] **Step 1: Everything green**

Run: `cd app && npm test && npx tsc -p tsconfig.web.json --noEmit && npx tsc -p tsconfig.node.json --noEmit && npm run build`
Expected: all tests pass; no type errors; build succeeds.

- [ ] **Step 2: Manual smoke against a real system** (`cd app && npm run dev`)

Verify each success criterion from the spec:
1. Edit in a draft, switch drafts → **Save-or-Discard prompt** appears; navigating between systems does **not** prompt and edits are still there on return.
2. New Draft → starts from the Live Version (pull if online); creating while on a draft still branches from the Live Version.
3. Archive a draft → it moves to the **Archived** section and can be restored; it is **not** deleted.
4. Only app-known drafts show — a repo with extra branches does not flood the dropdown.
5. **Add existing work…** lists local + GitHub branches; picking one opens it as a Draft.
6. With uncommitted edits on the Live Version, **Move changes into a draft** carries them into a new Draft and leaves the Live Version clean.
7. Status line reads in plain language; the word "branch" never appears.

- [ ] **Step 3: Commit any touch-ups**

```bash
cd .. && git add -A && git commit -m "chore: draft lifecycle verified end-to-end" || echo "nothing to commit"
```

---

## Self-Review Notes (author)

- **Spec coverage:** registry → T1; fresh-from-main → T4; no-stash switch → T3/T5; Save-or-Discard guard → T6/T7; archive-keeps-branch → T7; merged-retire → T7 step 6; Add existing work → T2/T5/T8; Move changes into a draft → T3/T5/T7/T8; legible status → T7/T8; only-known-drafts → T7/T8. All covered.
- **Type consistency:** `DraftEntry` from `draftStore` used in SystemOverview + StatusBar (StatusBar accepts the structural `{branch,title}` subset). IPC shapes match across main/preload/env.d.ts (`createDraft` returns `pulled`; `createDraftFromChanges` returns `branch`; `listAdoptableBranches` returns `{name,isRemoteOnly}[]`).
- **Deferred (correctly out of scope):** file-watching/external-edit sync, collision-prevention banners, conflict resolution, OAuth, packaging, content templates.
- **Note:** `git:deleteBranch` remains solely for merged-retire; the archive path never deletes.
