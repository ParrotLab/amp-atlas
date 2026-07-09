# Collision Prevention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent silent edit collisions — update a draft against the Live Version before publishing (aborting safely on a real overlap), escalate conflicts calmly, and softly warn when someone else already has the open file in review.

**Architecture:** Two main-process functions do the work. `updateFromLive` (in `draftOps.ts`) fetches + merges the base branch into the draft before push, aborting on conflict so the draft is untouched. `fileWatchers` (in `github.ts`) lists open PRs by others that touch a given file. Both are exposed over IPC. The renderer wires `updateFromLive` into `handleDoPublish` (with a calm conflict modal) and shows a soft awareness banner in `FileViewer` via a `useFileWatchers` hook.

**Tech Stack:** Electron (main/preload/renderer IPC), simple-git, GitHub REST API (existing `github.ts` helpers), React 19, Vitest 4.

**Spec:** [`docs/superpowers/specs/2026-07-09-collision-prevention-design.md`](../specs/2026-07-09-collision-prevention-design.md)

---

## File Structure

- **`app/src/main/draftOps.ts`** — add `updateFromLive` + `UpdateFromLiveResult` (git merge/abort logic).
- **`app/src/main/__tests__/draftOps.test.ts`** — add `updateFromLive` tests (reuses the file's existing `tempRepo` helper).
- **`app/src/main/github.ts`** — add `selectWatchers` (pure), `fileWatchers` (orchestration), `FileWatcher`, `resolveUserName`.
- **`app/src/main/__tests__/selectWatchers.test.ts`** — new: pure-logic tests for `selectWatchers`.
- **`app/src/main/index.ts`** — register `git:updateFromLive` and `git:fileWatchers` IPC handlers.
- **`app/src/preload/index.ts`** — expose both on the `git` api.
- **`app/src/renderer/env.d.ts`** — types for both new git-api methods.
- **`app/src/renderer/components/ConflictModal.tsx`** + **`ConflictModal.css`** — new: calm escalation modal.
- **`app/src/renderer/pages/SystemOverview.tsx`** — call `updateFromLive` in `handleDoPublish`; conflict state; render `ConflictModal`.
- **`app/src/renderer/hooks/useFileWatchers.ts`** — new: fetch watchers on file open + window focus, session-cached.
- **`app/src/renderer/components/FileViewer.tsx`** + **`FileViewer.css`** — awareness banner.

All commands run from `app/` (the project dir). Run a single test file with `npx vitest run <path>`.

---

## Task 1: `updateFromLive` (main-process git logic)

**Files:**
- Modify: `app/src/main/draftOps.ts`
- Test: `app/src/main/__tests__/draftOps.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `app/src/main/__tests__/draftOps.test.ts`. Add `updateFromLive` to the existing import from `../draftOps`, and add these tests. They reuse the `tempRepo()` helper already defined at the top of the file. The pattern: `tempRepo()` makes a repo with `main` + `readme.md`; we create a `origin` remote pointing at a bare clone so `fetch origin main` works, branch a draft, advance `main` on the origin, then update.

```ts
import { mkdtempSync, writeFileSync } from 'fs'   // already imported at top — do not duplicate

// Helper: give `dir` an origin remote (bare clone) so fetch works, and return the origin's working clone.
async function withOrigin(dir: string): Promise<{ originWork: string }> {
  const bare = mkdtempSync(join(tmpdir(), 'amp-bare-'))
  await simpleGit(dir).raw(['clone', '--bare', dir, bare])
  await simpleGit(dir).addRemote('origin', bare)
  // A separate working clone of origin to push new base commits from.
  const originWork = mkdtempSync(join(tmpdir(), 'amp-origin-'))
  await simpleGit(originWork).clone(bare, originWork)
  await simpleGit(originWork).addConfig('user.email', 't@t.com')
  await simpleGit(originWork).addConfig('user.name', 'T')
  return { originWork }
}

describe('updateFromLive', () => {
  it('merges new base commits into the draft (updated:true)', async () => {
    const dir = await tempRepo()
    const { originWork } = await withOrigin(dir)
    // draft branches from main, edits a different file
    await simpleGit(dir).checkoutLocalBranch('draft/x')
    writeFileSync(join(dir, 'draft-note.md'), 'draft work\n')
    await simpleGit(dir).add('-A'); await simpleGit(dir).commit('draft edit')
    // meanwhile main advances on origin with a NON-overlapping file
    writeFileSync(join(originWork, 'live.md'), 'live change\n')
    await simpleGit(originWork).add('-A'); await simpleGit(originWork).commit('live edit')
    await simpleGit(originWork).push('origin', 'main')

    const res = await updateFromLive(dir)
    expect(res).toEqual({ ok: true, updated: true })
    // the live file is now present on the draft
    expect(existsSync(join(dir, 'live.md'))).toBe(true)
  })

  it('reports updated:false when the draft is already current', async () => {
    const dir = await tempRepo()
    await withOrigin(dir)
    await simpleGit(dir).checkoutLocalBranch('draft/y')
    const res = await updateFromLive(dir)
    expect(res).toEqual({ ok: true, updated: false })
  })

  it('aborts on a real overlap, leaving the draft untouched (conflicted)', async () => {
    const dir = await tempRepo()
    const { originWork } = await withOrigin(dir)
    // draft edits readme.md line
    await simpleGit(dir).checkoutLocalBranch('draft/z')
    writeFileSync(join(dir, 'readme.md'), '# hi\n\nDRAFT VERSION\n')
    await simpleGit(dir).add('-A'); await simpleGit(dir).commit('draft readme')
    const draftContent = readFileSync(join(dir, 'readme.md'), 'utf8')
    // main advances with an overlapping edit to the SAME line
    writeFileSync(join(originWork, 'readme.md'), '# hi\n\nLIVE VERSION\n')
    await simpleGit(originWork).add('-A'); await simpleGit(originWork).commit('live readme')
    await simpleGit(originWork).push('origin', 'main')

    const res = await updateFromLive(dir)
    expect(res).toEqual({ ok: false, conflicted: true, files: ['readme.md'] })
    // draft is byte-identical to before, and the tree is clean (merge aborted)
    expect(readFileSync(join(dir, 'readme.md'), 'utf8')).toBe(draftContent)
    expect((await simpleGit(dir).status()).isClean()).toBe(true)
  })
})
```

Add `existsSync, readFileSync` to the `fs` import at the top of the test file (currently `import { mkdtempSync, writeFileSync } from 'fs'`):

```ts
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from 'fs'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/__tests__/draftOps.test.ts`
Expected: FAIL — `updateFromLive is not a function` / not exported.

- [ ] **Step 3: Implement `updateFromLive`**

Append to `app/src/main/draftOps.ts`:

```ts
export type UpdateFromLiveResult =
  | { ok: true; updated: boolean }
  | { ok: false; conflicted: true; files: string[] }

/**
 * Bring the current draft up to date with the Live Version (origin base branch) before publishing.
 * Merges cleanly when possible; on a real overlap it aborts the merge so the draft is left untouched.
 */
export async function updateFromLive(repoPath: string): Promise<UpdateFromLiveResult> {
  const git = simpleGit(repoPath)
  const info = await git.branch()
  const base = info.all.includes('main') ? 'main' : info.all.includes('master') ? 'master' : 'main'

  // Fetch the latest Live Version. Offline / no remote => nothing to merge, proceed.
  try {
    await git.fetch('origin', base)
  } catch {
    return { ok: true, updated: false }
  }

  // Anything new on origin/base the draft doesn't already have?
  const behind = (await git.raw(['rev-list', '--count', `HEAD..origin/${base}`])).trim()
  if (behind === '0') return { ok: true, updated: false }

  try {
    await git.merge([`origin/${base}`])
    return { ok: true, updated: true }
  } catch {
    // Conflict: capture overlapping files, then abort so the working tree is exactly as the user left it.
    const files = (await git.raw(['diff', '--name-only', '--diff-filter=U']))
      .split('\n').map(s => s.trim()).filter(Boolean)
    await git.merge(['--abort'])
    return { ok: false, conflicted: true, files }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/main/__tests__/draftOps.test.ts`
Expected: PASS (all `updateFromLive` cases plus the pre-existing tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/main/draftOps.ts app/src/main/__tests__/draftOps.test.ts
git commit -m "feat: updateFromLive — merge Live into draft before publish, abort safely on conflict"
```

---

## Task 2: Expose `git:updateFromLive` over IPC

**Files:**
- Modify: `app/src/main/index.ts`
- Modify: `app/src/preload/index.ts`
- Modify: `app/src/renderer/env.d.ts`

- [ ] **Step 1: Register the IPC handler**

In `app/src/main/index.ts`, ensure `updateFromLive` is in the import from `./draftOps` (it already imports `createDraftFromChanges`, `createDraftFromMain`, etc. — add `updateFromLive`). Then add this handler next to the other `git:` handlers (e.g. right after the `git:createDraftFromChanges` handler):

```ts
ipcMain.handle('git:updateFromLive', async (_event, repoPath: string) => {
  try {
    return await updateFromLive(repoPath)
  } catch {
    // An unexpected failure must not block publishing — treat as "nothing to update".
    return { ok: true, updated: false }
  }
})
```

- [ ] **Step 2: Expose it in preload**

In `app/src/preload/index.ts`, inside the `git` object (next to `publish`), add:

```ts
    updateFromLive: (repoPath: string) => ipcRenderer.invoke('git:updateFromLive', repoPath),
```

- [ ] **Step 3: Add the renderer type**

In `app/src/renderer/env.d.ts`, inside the `git` api type (next to the `publish` line ~91), add:

```ts
    updateFromLive: (repoPath: string) => Promise<
      | { ok: true; updated: boolean }
      | { ok: false; conflicted: true; files: string[] }
    >
```

- [ ] **Step 4: Verify it typechecks and builds**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/index.ts app/src/preload/index.ts app/src/renderer/env.d.ts
git commit -m "feat: wire git:updateFromLive over IPC"
```

---

## Task 3: `ConflictModal` component

**Files:**
- Create: `app/src/renderer/components/ConflictModal.tsx`
- Create: `app/src/renderer/components/ConflictModal.css`

- [ ] **Step 1: Create the component**

Create `app/src/renderer/components/ConflictModal.tsx`:

```tsx
import { useEffect } from 'react'
import './ConflictModal.css'

interface ConflictModalProps {
  isOpen: boolean
  files: string[]
  onClose: () => void
}

/** Calm, non-technical escalation when the Live Version changed in a way that overlaps the draft. */
export default function ConflictModal({ isOpen, files, onClose }: ConflictModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="conflict-modal-overlay" onClick={onClose}>
      <div className="conflict-modal" onClick={e => e.stopPropagation()}>
        <h2 className="conflict-modal-title">The Live Version changed while you were working</h2>
        <p className="conflict-modal-body">
          Someone published edits that overlap yours in{' '}
          {files.map((f, i) => (
            <span key={f}>
              <strong>{f}</strong>{i < files.length - 1 ? ', ' : ''}
            </span>
          ))}
          . Your draft is safe and unchanged — nothing was lost.
        </p>
        <p className="conflict-modal-body">
          To finish publishing, <strong>contact your team lead</strong> and they’ll help merge the two versions.
        </p>
        <div className="conflict-modal-actions">
          <button className="conflict-modal-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create the styles**

Create `app/src/renderer/components/ConflictModal.css`. Mirror the app's warm palette (plum/cream). Keep it self-contained:

```css
.conflict-modal-overlay {
  position: fixed; inset: 0; background: rgba(40, 20, 50, 0.35);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.conflict-modal {
  background: #fffdf9; border-radius: 14px; padding: 28px 30px; max-width: 460px; width: 90%;
  box-shadow: 0 12px 40px rgba(40, 20, 50, 0.25); font-family: inherit;
}
.conflict-modal-title { margin: 0 0 12px; font-size: 19px; color: #3b2a44; }
.conflict-modal-body { margin: 0 0 12px; font-size: 14px; line-height: 1.5; color: #4a3d52; }
.conflict-modal-body strong { color: #6b2fb3; }
.conflict-modal-actions { display: flex; justify-content: flex-end; margin-top: 20px; }
.conflict-modal-primary {
  background: #6b2fb3; color: #fff; border: none; border-radius: 8px;
  padding: 9px 20px; font-size: 14px; cursor: pointer;
}
.conflict-modal-primary:hover { background: #5a259c; }
```

- [ ] **Step 3: Verify it builds**

Run: `npx tsc --noEmit`
Expected: no type errors (unused-component warning is fine; wired up in Task 4).

- [ ] **Step 4: Commit**

```bash
git add app/src/renderer/components/ConflictModal.tsx app/src/renderer/components/ConflictModal.css
git commit -m "feat: ConflictModal — calm, jargon-free publish-conflict escalation"
```

---

## Task 4: Wire update-before-publish + escalation into the publish flow

**Files:**
- Modify: `app/src/renderer/pages/SystemOverview.tsx`

- [ ] **Step 1: Add conflict state**

In `app/src/renderer/pages/SystemOverview.tsx`, add the import near the other modal imports (after `import PublishModal from '../components/PublishModal'`):

```tsx
import ConflictModal from '../components/ConflictModal'
```

Add state near the other `useState` modal flags (e.g. after `const [showPublish, setShowPublish] = useState(false)`):

```tsx
  const [conflictFiles, setConflictFiles] = useState<string[] | null>(null)
```

- [ ] **Step 2: Call `updateFromLive` before pushing**

In `handleDoPublish`, insert the update step **between** the commit block and the `git.publish` call. The existing code is:

```tsx
    // First commit any uncommitted changes
    const status = await window.api.git.status(rootPath)
    if (status.ok && status.status && !status.status.isClean) {
      await window.api.git.save(rootPath, title)
    }

    // Push to GitHub
    const pushResult = await window.api.git.publish(rootPath)
```

Change it to:

```tsx
    // First commit any uncommitted changes
    const status = await window.api.git.status(rootPath)
    if (status.ok && status.status && !status.status.isClean) {
      await window.api.git.save(rootPath, title)
    }

    // Bring the draft up to date with the Live Version before pushing.
    const update = await window.api.git.updateFromLive(rootPath)
    if (!update.ok) {
      setConflictFiles(update.files)   // real overlap — escalate calmly, do not push
      return
    }

    // Push to GitHub
    const pushResult = await window.api.git.publish(rootPath)
```

- [ ] **Step 3: Render the modal**

Add `ConflictModal` next to the existing `<PublishModal ... />` render (just before the closing `</div>` that ends the component):

```tsx
      <ConflictModal
        isOpen={conflictFiles !== null}
        files={conflictFiles ?? []}
        onClose={() => setConflictFiles(null)}
      />
```

- [ ] **Step 4: Verify it builds**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds. TypeScript narrows `update.files` inside the `!update.ok` branch (the conflicted variant), so no cast is needed.

- [ ] **Step 5: Commit**

```bash
git add app/src/renderer/pages/SystemOverview.tsx
git commit -m "feat: update draft from Live before publish; escalate conflicts via ConflictModal"
```

---

## Task 5: `fileWatchers` (main-process PR query)

**Files:**
- Modify: `app/src/main/github.ts`
- Test: `app/src/main/__tests__/selectWatchers.test.ts`

- [ ] **Step 1: Write the failing tests for the pure selector**

Create `app/src/main/__tests__/selectWatchers.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { selectWatchers } from '../github'

const pr = (number: number, headRefName: string, login: string, title = `PR ${number}`) =>
  ({ number, headRefName, title, author: { login } })

describe('selectWatchers', () => {
  it('returns PRs (not on the current branch) whose files include relPath', () => {
    const prs = [pr(1, 'draft/other', 'hannah'), pr(2, 'draft/mine', 'me')]
    const filesByPr = { 1: ['systems/a/notes.md'], 2: ['systems/a/notes.md'] }
    const out = selectWatchers(prs, filesByPr, 'draft/mine', 'systems/a/notes.md')
    expect(out).toEqual([{ number: 1, login: 'hannah', title: 'PR 1', branch: 'draft/other' }])
  })

  it('excludes the current branch even when it touches the file', () => {
    const prs = [pr(2, 'draft/mine', 'me')]
    const out = selectWatchers(prs, { 2: ['a.md'] }, 'draft/mine', 'a.md')
    expect(out).toEqual([])
  })

  it('returns [] when no PR touches the file', () => {
    const prs = [pr(1, 'draft/other', 'hannah')]
    const out = selectWatchers(prs, { 1: ['b.md'] }, 'draft/mine', 'a.md')
    expect(out).toEqual([])
  })

  it('returns every PR that touches the file', () => {
    const prs = [pr(1, 'draft/a', 'hannah'), pr(3, 'draft/c', 'sam')]
    const filesByPr = { 1: ['a.md'], 3: ['a.md', 'c.md'] }
    const out = selectWatchers(prs, filesByPr, 'draft/mine', 'a.md')
    expect(out.map(w => w.number)).toEqual([1, 3])
  })

  it('handles zero open PRs', () => {
    expect(selectWatchers([], {}, 'draft/mine', 'a.md')).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/main/__tests__/selectWatchers.test.ts`
Expected: FAIL — `selectWatchers` not exported.

- [ ] **Step 3: Implement the selector, orchestration, and name resolution**

Append to `app/src/main/github.ts` (the file already imports `simpleGit` and defines `gh`, `listPRs`, `prFiles`):

```ts
export type FileWatcher = { number: number; author: string; title: string; branch: string }

type WatcherPR = { number: number; title: string; headRefName: string; author: { login: string } }

/** Pure: open PRs not on `currentBranch` whose file set includes `relPath` (author kept as login). */
export function selectWatchers(
  prs: WatcherPR[],
  filesByPr: Record<number, string[]>,
  currentBranch: string | null,
  relPath: string,
): { number: number; login: string; title: string; branch: string }[] {
  return prs
    .filter(p => p.headRefName !== currentBranch)
    .filter(p => (filesByPr[p.number] || []).includes(relPath))
    .map(p => ({ number: p.number, login: p.author.login, title: p.title, branch: p.headRefName }))
}

// Display name for a GitHub login, falling back to the login. Cached per login for the process lifetime.
const nameCache = new Map<string, string>()
async function resolveUserName(login: string): Promise<string> {
  const cached = nameCache.get(login)
  if (cached) return cached
  let name = login
  try {
    const u = await gh(`/users/${login}`) as { name: string | null }
    if (u.name) name = u.name
  } catch { /* offline / rate-limited — fall back to login */ }
  nameCache.set(login, name)
  return name
}

/** Open PRs by others that already touch `relPath`, with author display names resolved. */
export async function fileWatchers(repoPath: string, relPath: string): Promise<FileWatcher[]> {
  const currentBranch = (await simpleGit(repoPath).status()).current
  const prs = await listPRs(repoPath)
  const others = prs.filter(p => p.headRefName !== currentBranch)

  const filesByPr: Record<number, string[]> = {}
  for (const p of others) filesByPr[p.number] = await prFiles(repoPath, p.number)

  const picked = selectWatchers(prs as unknown as WatcherPR[], filesByPr, currentBranch, relPath)
  const out: FileWatcher[] = []
  for (const w of picked) {
    out.push({ number: w.number, author: await resolveUserName(w.login), title: w.title, branch: w.branch })
  }
  return out
}
```

Note: `listPRs` returns objects shaped `{ number, title, headRefName, author: { login, name }, ... }`, which structurally satisfies `WatcherPR`; the `as unknown as WatcherPR[]` bridges the wider type.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/main/__tests__/selectWatchers.test.ts`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add app/src/main/github.ts app/src/main/__tests__/selectWatchers.test.ts
git commit -m "feat: fileWatchers — open PRs by others touching a file, with display names"
```

---

## Task 6: Expose `git:fileWatchers` over IPC

**Files:**
- Modify: `app/src/main/index.ts`
- Modify: `app/src/preload/index.ts`
- Modify: `app/src/renderer/env.d.ts`

- [ ] **Step 1: Register the IPC handler**

In `app/src/main/index.ts`, next to the other `github.*` PR handlers (e.g. after `git:prDiff`), add — degrading to `[]` on any error so file opening never breaks:

```ts
ipcMain.handle('git:fileWatchers', async (_event, repoPath: string, relPath: string) => {
  try { return { ok: true, watchers: await github.fileWatchers(repoPath, relPath) } }
  catch { return { ok: true, watchers: [] } }
})
```

(`github` is already imported in `index.ts` — the existing handlers call `github.listPRs`, `github.prFiles`, etc.)

- [ ] **Step 2: Expose it in preload**

In `app/src/preload/index.ts`, inside the `git` object (next to `prDiff`), add:

```ts
    fileWatchers: (repoPath: string, relPath: string) => ipcRenderer.invoke('git:fileWatchers', repoPath, relPath),
```

- [ ] **Step 3: Add the renderer type**

In `app/src/renderer/env.d.ts`, inside the `git` api type (next to `prDiff` ~line 102), add:

```ts
    fileWatchers: (repoPath: string, relPath: string) => Promise<{
      ok: boolean
      watchers: Array<{ number: number; author: string; title: string; branch: string }>
    }>
```

- [ ] **Step 4: Verify it typechecks and builds**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/index.ts app/src/preload/index.ts app/src/renderer/env.d.ts
git commit -m "feat: wire git:fileWatchers over IPC"
```

---

## Task 7: Awareness banner in the editor

**Files:**
- Create: `app/src/renderer/hooks/useFileWatchers.ts`
- Modify: `app/src/renderer/components/FileViewer.tsx`
- Modify: `app/src/renderer/components/FileViewer.css`

- [ ] **Step 1: Create the hook**

Create `app/src/renderer/hooks/useFileWatchers.ts`:

```ts
import { useState, useEffect, useCallback } from 'react'

export interface Watcher { number: number; author: string; title: string; branch: string }

// Session cache keyed by (root, relPath) so re-opening a file shows instantly before the refresh lands.
const cache = new Map<string, Watcher[]>()

/** Open-PR "watchers" for the currently open file. Refreshes on file change and on window focus. */
export function useFileWatchers(filePath: string | undefined, rootPath: string): Watcher[] {
  const [watchers, setWatchers] = useState<Watcher[]>([])
  const relPath = filePath && rootPath ? filePath.replace(rootPath + '/', '') : ''

  const refresh = useCallback(async () => {
    if (!relPath || !rootPath) { setWatchers([]); return }
    const r = await window.api.git.fileWatchers(rootPath, relPath)
    const list = r.ok ? r.watchers : []
    cache.set(rootPath + '::' + relPath, list)
    setWatchers(list)
  }, [relPath, rootPath])

  useEffect(() => {
    if (!relPath) { setWatchers([]); return }
    const cached = cache.get(rootPath + '::' + relPath)
    setWatchers(cached ?? [])          // instant (or clear) on file switch
    void refresh()                     // then refresh from GitHub
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [relPath, rootPath, refresh])

  return watchers
}
```

- [ ] **Step 2: Render the banner in FileViewer**

In `app/src/renderer/components/FileViewer.tsx`, add the import at the top:

```tsx
import { useFileWatchers } from '../hooks/useFileWatchers'
```

Inside the `FileViewer` component body (with the other hooks, above the `if (!filePath)` early return), add:

```tsx
  const watchers = useFileWatchers(filePath, rootPath)
  const [dismissedFile, setDismissedFile] = useState<string>('')
  const showWatchers = watchers.length > 0 && dismissedFile !== filePath
```

Ensure `useState` is imported in FileViewer (it already imports React hooks — add `useState` to the existing `react` import if absent).

Then, in the returned JSX, add the banner directly **after** the existing `externalPrompt` banner block (after its closing `)}` and before `<div className="file-viewer-header-row">`):

```tsx
        {showWatchers && (
          <div className="file-watchers-banner">
            <span>
              👀{' '}
              {watchers.length === 1 ? (
                <>
                  <strong>{watchers[0].author}</strong> also has edits to this file in review
                  {watchers[0].title ? <> (“{watchers[0].title}”)</> : null}. Coordinate before
                  publishing so your changes don’t clash.
                </>
              ) : (
                <>
                  <strong>{watchers[0].author}</strong> and{' '}
                  <strong>{watchers.length - 1} {watchers.length - 1 === 1 ? 'other' : 'others'}</strong>{' '}
                  also have edits to this file in review. Coordinate before publishing.
                </>
              )}
            </span>
            <button className="ghost" onClick={() => setDismissedFile(filePath || '')}>Dismiss</button>
          </div>
        )}
```

- [ ] **Step 3: Add the banner styles**

Append to `app/src/renderer/components/FileViewer.css` — soft amber, visually distinct from the (neutral) `file-updated-banner`:

```css
.file-watchers-banner {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  background: #fdf3e0; border: 1px solid #f2d9a8; color: #7a5a1e;
  border-radius: 8px; padding: 9px 14px; margin-bottom: 12px; font-size: 13.5px; line-height: 1.45;
}
.file-watchers-banner strong { color: #8a5a12; font-weight: 600; }
.file-watchers-banner .ghost {
  background: none; border: none; color: #9a7433; cursor: pointer; font-size: 13px; white-space: nowrap;
}
.file-watchers-banner .ghost:hover { color: #7a5a1e; text-decoration: underline; }
```

- [ ] **Step 4: Verify it builds and boots**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/src/renderer/hooks/useFileWatchers.ts app/src/renderer/components/FileViewer.tsx app/src/renderer/components/FileViewer.css
git commit -m "feat: soft awareness banner when another open PR touches the open file"
```

---

## Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all suites PASS, including the new `updateFromLive` and `selectWatchers` cases.

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 3: Manual smoke (Kristi, in dev)**

Run: `npm run dev`, then:
- Create two drafts that edit the **same** file; publish one as a PR.
- Open that file in the other draft → the amber banner names the PR author. Switch away and back to the window → it refreshes.
- Publish the second draft → the calm `ConflictModal` appears (if the edits overlap the same lines), the draft's contents are intact, and nothing was pushed. If the edits are in different parts of the file, publish succeeds cleanly (auto-merged).

- [ ] **Step 4: Finish the branch**

Use the **superpowers:finishing-a-development-branch** skill to run tests, then push and open a PR.

---

## Self-Review Notes

- **Spec coverage:** Part 1 → Tasks 1–2, 4. Part 2 (escalation) → Tasks 3–4. Part 3 (banner) → Tasks 5–7. Error-handling table → handler try/catch degradation in Tasks 2 & 6, offline branch in Task 1. Merge-not-rebase, generic "team lead" copy, dismiss-only, on-open+focus refresh, display-name fallback → all realized in the code above.
- **Type consistency:** `UpdateFromLiveResult` shape is identical in Task 1 (main), Task 2 (env.d.ts), and Task 4 (consumer). `FileWatcher`/`Watcher` fields (`number, author, title, branch`) are identical across Task 5, Task 6, and Task 7. Handler wrapping (`{ ok, ... }`) matches the existing `git:*` convention, except `git:updateFromLive` which intentionally returns the discriminated union directly (it already carries `ok`).
- **No placeholders:** every code step is complete and runnable.
