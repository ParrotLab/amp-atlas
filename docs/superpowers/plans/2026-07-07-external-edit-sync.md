# External-Edit Sync (Live View) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app the live view of files on disk — external changes (Claude/Obsidian/`git pull`) auto-reflect in the tree, git status, and open files, with one neutral "updated" banner only for the rare case where you're mid-editing the exact file that changed.

**Architecture:** A `chokidar` watcher in the main process pushes `fs:changed` batches to the renderer. The renderer refreshes git status + the file tree (non-destructively) and reconciles the open file via a pure decision function that uses the existing `lastWritten` ref to tell our-own-writes / clean / dirty apart.

**Tech Stack:** Electron + `chokidar` (main), React 19, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-07-external-edit-sync-design.md`

---

## File Structure

**New**
- `app/src/renderer/utils/reconcile.ts` — pure `reconcileDecision()` (ignore | reload | prompt). Unit-tested.
- `app/src/main/watcher.ts` — `shouldIgnore()` + `startWatch()` / `stopWatch()` (chokidar). Tested.

**Modify**
- `app/src/main/index.ts` — module-level window ref; `fs:watch` / `fs:unwatch` IPC forwarding batches via `webContents.send('fs:changed', paths)`.
- `app/src/preload/index.ts` + `app/src/renderer/env.d.ts` — `fs.onChanged(cb) => unsubscribe`.
- `app/src/renderer/hooks/useFileDocument.ts` — `reconcile()`, `externalPrompt`, `resolveExternal()` using `reconcileDecision`.
- `app/src/renderer/components/FileViewer.tsx` (+ `.css`) — non-blocking "updated" banner.
- `app/src/renderer/components/FileTree.tsx` — `refreshToken` non-destructive refresh (keeps expansion + selection).
- `app/src/renderer/pages/SystemOverview.tsx` — start/stop watch, react to batches, tree refresh token, open-file reconcile + deleted-file handling.
- `app/package.json` — add `chokidar`.

**Conventions:** run commands from `app/`; `git` from repo root (`cd ..`). Every task ends in a commit.

---

## Phase 0 — Pure logic (TDD)

### Task 1: `reconcileDecision`

**Files:**
- Create: `app/src/renderer/utils/reconcile.ts`
- Test: `app/src/renderer/utils/__tests__/reconcile.test.ts`

- [ ] **Step 1: Write failing tests**

Create `app/src/renderer/utils/__tests__/reconcile.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { reconcileDecision } from '../reconcile'

describe('reconcileDecision', () => {
  it('ignores when disk equals what we last wrote (our own autosave)', () => {
    expect(reconcileDecision('X', 'X', 'X')).toBe('ignore')
    expect(reconcileDecision('X', 'X', 'Y')).toBe('ignore') // even if buffer differs, disk is unchanged
  })

  it('reloads when the editor is clean but disk changed externally', () => {
    // buffer matches lastWritten (clean), disk is different
    expect(reconcileDecision('DISK', 'OLD', 'OLD')).toBe('reload')
  })

  it('prompts when both the editor and disk diverged (true collision)', () => {
    expect(reconcileDecision('DISK', 'OLD', 'MINE')).toBe('prompt')
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `cd app && npx vitest run src/renderer/utils/__tests__/reconcile.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `app/src/renderer/utils/reconcile.ts`:

```typescript
export type ReconcileDecision = 'ignore' | 'reload' | 'prompt'

/**
 * Decide what to do when an open file may have changed on disk.
 * - disk === lastWritten  → nothing really changed (or it was our own autosave)
 * - editor === lastWritten → editor is clean → adopt disk silently
 * - otherwise             → editor and disk both diverged → ask the user
 */
export function reconcileDecision(diskContent: string, lastWritten: string, editorContent: string): ReconcileDecision {
  if (diskContent === lastWritten) return 'ignore'
  if (editorContent === lastWritten) return 'reload'
  return 'prompt'
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd app && npx vitest run src/renderer/utils/__tests__/reconcile.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
cd .. && git add app/src/renderer/utils/reconcile.ts app/src/renderer/utils/__tests__/reconcile.test.ts && git commit -m "feat: pure reconcileDecision for external-edit sync"
```

### Task 2: `watcher` (shouldIgnore + chokidar)

**Files:**
- Create: `app/src/main/watcher.ts`
- Test: `app/src/main/__tests__/watcher.test.ts`
- Modify: `app/package.json`

- [ ] **Step 1: Install chokidar**

Run: `cd app && npm install chokidar@^4`
Expected: added, no errors.

- [ ] **Step 2: Write failing tests**

Create `app/src/main/__tests__/watcher.test.ts`:

```typescript
import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { shouldIgnore, startWatch, stopWatch } from '../watcher'

describe('shouldIgnore', () => {
  it('ignores .git and node_modules', () => {
    expect(shouldIgnore('/repo/.git/HEAD')).toBe(true)
    expect(shouldIgnore('/repo/node_modules/x/index.js')).toBe(true)
  })
  it('allows normal files and .claude', () => {
    expect(shouldIgnore('/repo/work/notes.md')).toBe(false)
    expect(shouldIgnore('/repo/.claude/skills/a/SKILL.md')).toBe(false)
  })
})

describe('startWatch', () => {
  afterEach(() => stopWatch())

  it('fires onChange with the changed path when a file is written', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'amp-watch-'))
    const seen: string[] = []
    await startWatch(dir, (paths) => seen.push(...paths))
    writeFileSync(join(dir, 'note.md'), 'hello\n')
    await new Promise<void>((resolve, reject) => {
      const t0 = Date.now()
      const iv = setInterval(() => {
        if (seen.some(p => p.endsWith('note.md'))) { clearInterval(iv); resolve() }
        else if (Date.now() - t0 > 4000) { clearInterval(iv); reject(new Error('no event')) }
      }, 50)
    })
    expect(seen.some(p => p.endsWith('note.md'))).toBe(true)
  })
})
```

- [ ] **Step 3: Run, verify fail**

Run: `cd app && npx vitest run src/main/__tests__/watcher.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `app/src/main/watcher.ts`:

```typescript
import chokidar, { FSWatcher } from 'chokidar'

export function shouldIgnore(p: string): boolean {
  return /(^|\/)\.git(\/|$)/.test(p) || /(^|\/)node_modules(\/|$)/.test(p)
}

let watcher: FSWatcher | null = null
let debounceTimer: ReturnType<typeof setTimeout> | undefined
let pending = new Set<string>()

/** Watch repoPath and call onChange with a debounced batch of changed absolute paths. Resolves when ready. */
export function startWatch(repoPath: string, onChange: (paths: string[]) => void): Promise<void> {
  stopWatch()
  return new Promise<void>((resolve) => {
    watcher = chokidar.watch(repoPath, {
      ignored: (p: string) => shouldIgnore(p),
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 20 },
    })
    watcher.on('all', (_event, path) => {
      pending.add(path)
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        const batch = [...pending]
        pending.clear()
        onChange(batch)
      }, 200)
    })
    watcher.on('ready', () => resolve())
  })
}

export function stopWatch(): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  pending.clear()
  if (watcher) { watcher.close(); watcher = null }
}
```

- [ ] **Step 5: Run, verify pass**

Run: `cd app && npx vitest run src/main/__tests__/watcher.test.ts`
Expected: PASS, 3 tests. (If the fire-on-change test is flaky on a slow machine, re-run; the 4s budget is generous.)

- [ ] **Step 6: Commit**

```bash
cd .. && git add app/src/main/watcher.ts app/src/main/__tests__/watcher.test.ts app/package.json app/package-lock.json && git commit -m "feat: chokidar watcher (shouldIgnore + start/stop)"
```

---

## Phase 1 — IPC (main → renderer push)

### Task 3: `fs:watch` / `fs:unwatch` + `fs.onChanged`

**Files:**
- Modify: `app/src/main/index.ts`, `app/src/preload/index.ts`, `app/src/renderer/env.d.ts`

- [ ] **Step 1: Module-level window ref + import watcher**

In `app/src/main/index.ts`, add the import near the others:

```typescript
import { startWatch, stopWatch } from './watcher'
```

Change `createWindow` so the window is reachable from IPC handlers. Replace the line `function createWindow(): void {` + `  const mainWindow = new BrowserWindow({` with:

```typescript
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
```

- [ ] **Step 2: Add the watch IPC handlers**

Add near the other `ipcMain.handle` blocks in `app/src/main/index.ts`:

```typescript
ipcMain.handle('fs:watch', async (_event, repoPath: string) => {
  try {
    await startWatch(repoPath, (paths) => {
      mainWindow?.webContents.send('fs:changed', paths)
    })
    return { ok: true }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('fs:unwatch', async () => {
  stopWatch()
  return { ok: true }
})
```

- [ ] **Step 3: Expose in preload**

In `app/src/preload/index.ts`, add to the `fs` object:

```typescript
    watch: (path: string) => ipcRenderer.invoke('fs:watch', path),
    unwatch: () => ipcRenderer.invoke('fs:unwatch'),
    onChanged: (cb: (paths: string[]) => void) => {
      const handler = (_e: unknown, paths: string[]) => cb(paths)
      ipcRenderer.on('fs:changed', handler)
      return () => ipcRenderer.removeListener('fs:changed', handler)
    },
```

- [ ] **Step 4: Add types**

In `app/src/renderer/env.d.ts`, inside the `fs: {` block, add:

```typescript
    watch: (path: string) => Promise<{ ok: boolean; error?: string }>
    unwatch: () => Promise<{ ok: boolean }>
    onChanged: (cb: (paths: string[]) => void) => () => void
```

- [ ] **Step 5: Typecheck + build**

Run: `cd app && npx tsc -p tsconfig.node.json --noEmit && npx tsc -p tsconfig.web.json --noEmit && npm run build`
Expected: no errors; build OK.

- [ ] **Step 6: Commit**

```bash
cd .. && git add app/src/main/index.ts app/src/preload/index.ts app/src/renderer/env.d.ts && git commit -m "feat: fs:watch/unwatch IPC + fs.onChanged push event"
```

---

## Phase 2 — Renderer

### Task 4: `useFileDocument` reconcile

**Files:**
- Modify: `app/src/renderer/hooks/useFileDocument.ts`

- [ ] **Step 1: Import + state**

In `useFileDocument.ts`, update the imports:

```typescript
import { useState, useEffect, useRef, useCallback } from 'react'
import { parseDocument, composeDocument } from '../utils/fileDocument'
import { reconcileDecision } from '../utils/reconcile'
```

After the existing `const [status, setStatus] = useState<WriteStatus>('idle')` line, add:

```typescript
  const [externalPrompt, setExternalPrompt] = useState(false)
  const pendingDisk = useRef<string>('')
```

- [ ] **Step 2: Add reconcile + resolveExternal**

Add before the `return` of the hook:

```typescript
  const adoptDisk = (raw: string) => {
    const doc = parseDocument(raw)
    loading.current = true
    lastWritten.current = raw
    setData(doc.data)
    setBody(doc.body)
    setTimeout(() => { loading.current = false }, 0)
  }

  // Called when the open file may have changed on disk.
  const reconcile = useCallback(async () => {
    if (!filePath) return
    const res = await window.api.fs.readFile(filePath)
    if (!res.ok || res.content === undefined) return // deletion handled by the caller
    const disk = res.content
    const decision = reconcileDecision(disk, lastWritten.current, composeDocument(data, body))
    if (decision === 'ignore') return
    if (decision === 'reload') { adoptDisk(disk); return }
    pendingDisk.current = disk
    setExternalPrompt(true)
  }, [filePath, data, body])

  const resolveExternal = useCallback((mode: 'reload' | 'keep') => {
    setExternalPrompt(false)
    const disk = pendingDisk.current
    pendingDisk.current = ''
    if (!disk) return
    if (mode === 'reload') adoptDisk(disk)
    else lastWritten.current = disk // keep editing; next save overwrites, don't re-prompt
  }, [])
```

- [ ] **Step 3: Return the new members**

Change the return to:

```typescript
  return { data, body, status, updateBody, updateData, externalPrompt, resolveExternal, reconcile }
```

- [ ] **Step 4: Typecheck**

Run: `cd app && npx tsc -p tsconfig.web.json --noEmit 2>&1 | grep useFileDocument || echo "clean"`
Expected: `clean`.

- [ ] **Step 5: Commit**

```bash
cd .. && git add app/src/renderer/hooks/useFileDocument.ts && git commit -m "feat: useFileDocument external reconcile (silent reload / prompt)"
```

### Task 5: FileViewer "updated" banner

**Files:**
- Modify: `app/src/renderer/components/FileViewer.tsx`, `app/src/renderer/components/FileViewer.css`

- [ ] **Step 1: Add props**

In `FileViewer.tsx`, add to `FileViewerProps`:

```typescript
  externalPrompt?: boolean
  onReloadExternal?: () => void
  onKeepExternal?: () => void
```

Add them to the destructured params of the component signature (append to the existing list): `externalPrompt, onReloadExternal, onKeepExternal`.

- [ ] **Step 2: Render the banner**

In the returned JSX, immediately inside `<div className="file-viewer-content">` (before the header row), add:

```tsx
        {externalPrompt && (
          <div className="file-updated-banner">
            <span>This file was just updated.</span>
            <div className="file-updated-actions">
              <button onClick={onReloadExternal}>Reload</button>
              <button className="ghost" onClick={onKeepExternal}>Keep editing</button>
            </div>
          </div>
        )}
```

- [ ] **Step 3: Styles**

Append to `app/src/renderer/components/FileViewer.css`:

```css
.file-updated-banner {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin-bottom: 14px; padding: 8px 12px;
  background: #F3ECFF; border: 1px solid #E0CCFF; border-radius: 10px;
  font-size: 12px; color: #4A2E7A;
}
.file-updated-actions { display: flex; gap: 6px; }
.file-updated-actions button {
  padding: 4px 12px; font-size: 12px; font-weight: 500; border-radius: 6px;
  border: none; cursor: pointer; font-family: inherit; background: #8B2BFF; color: #fff;
}
.file-updated-actions button.ghost { background: transparent; color: #6B6966; }
```

- [ ] **Step 4: Build**

Run: `cd app && npm run build`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd .. && git add app/src/renderer/components/FileViewer.tsx app/src/renderer/components/FileViewer.css && git commit -m "feat: non-blocking file-updated banner in the editor"
```

### Task 6: FileTree non-destructive refresh

**Files:**
- Modify: `app/src/renderer/components/FileTree.tsx`

- [ ] **Step 1: Add the prop**

In `FileTreeProps`, add:

```typescript
  refreshToken?: number
```

Add `refreshToken` to the destructured props of the component.

- [ ] **Step 2: Re-load categories + expanded children on refresh**

Extract the categorize logic so it can be reused, then add a refresh effect. Replace the existing initial-load `useEffect` (the `const load = async () => { ... }; load()` block) with a `useCallback` + two effects:

```typescript
  const loadCategories = useCallback(async () => {
    const rootEntries = await loadDirectory(rootPath)
    const instructions: TreeNode[] = []
    const files: TreeNode[] = []
    let playbooks: TreeNode[] = []
    for (const entry of rootEntries) {
      if (!entry.isDirectory) instructions.push(entry)
      else if (entry.name === '.claude') continue
      else files.push(entry)
    }
    const skillsResult = await window.api.fs.readDirectory(`${rootPath}/.claude/skills`)
    if (skillsResult.ok && skillsResult.entries) {
      playbooks = skillsResult.entries.filter(e => e.isDirectory).map(entry => ({ ...entry, depth: 0, expanded: false }))
    }
    setCategories({ instructions, playbooks, files })
  }, [rootPath, loadDirectory])

  // Initial load
  useEffect(() => { if (rootPath) loadCategories() }, [rootPath, loadCategories])

  // Non-destructive external refresh: re-load categories + re-fetch children of
  // currently-expanded folders, preserving which folders are open.
  useEffect(() => {
    if (!rootPath || !refreshToken) return
    loadCategories()
    setExpandedNodes(prev => {
      const paths = [...prev.keys()]
      Promise.all(paths.map(async p => [p, await loadDirectory(p)] as const)).then(pairs => {
        setExpandedNodes(cur => {
          const next = new Map(cur)
          for (const [p, children] of pairs) if (next.has(p)) next.set(p, children)
          return next
        })
      })
      return prev
    })
  }, [refreshToken, rootPath, loadCategories, loadDirectory])
```

- [ ] **Step 3: Build**

Run: `cd app && npm run build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd .. && git add app/src/renderer/components/FileTree.tsx && git commit -m "feat: non-destructive FileTree refresh (keeps expansion + selection)"
```

### Task 7: SystemOverview — watch, react, reconcile, deleted-file

**Files:**
- Modify: `app/src/renderer/pages/SystemOverview.tsx`

- [ ] **Step 1: Pull reconcile members from the hook**

Change the `useFileDocument` destructure to include the new members:

```typescript
  const { data, body, status: writeStatus, updateBody, updateData, externalPrompt, resolveExternal, reconcile } = useFileDocument(selectedFile, isMainBranch)
```

- [ ] **Step 2: Add a tree refresh token + a live handler ref**

Add state near the other `useState`s:

```typescript
  const [treeRefresh, setTreeRefresh] = useState(0)
  const changeHandler = useRef<(paths: string[]) => void>(() => {})
```

(Add `useRef` to the React import at the top: `import { useState, useEffect, useCallback, useRef } from 'react'`.)

Keep the handler current on every render (place after `reconcile`/`fetchGitStatus` are defined, before the `return`):

```typescript
  changeHandler.current = (paths: string[]) => {
    fetchGitStatus()
    setTreeRefresh(t => t + 1)
    if (selectedFile && paths.includes(selectedFile)) {
      window.api.fs.stat(selectedFile).then(s => {
        if (!s.ok) { // deleted externally
          showToast('This file was removed.')
          handleTabClose(selectedFile)
        } else {
          reconcile()
        }
      })
    }
  }
```

- [ ] **Step 3: Start/stop the watcher**

Add an effect (after the capabilities effect):

```typescript
  useEffect(() => {
    if (!rootPath) return
    window.api.fs.watch(rootPath)
    const unsub = window.api.fs.onChanged(paths => changeHandler.current(paths))
    return () => { window.api.fs.unwatch(); unsub() }
  }, [rootPath])
```

- [ ] **Step 4: Wire the tree token + banner props**

On the `<FileTree ... />` element, add `refreshToken={treeRefresh}`.

On the `<FileViewer ... />` element, add:

```tsx
            externalPrompt={externalPrompt}
            onReloadExternal={() => resolveExternal('reload')}
            onKeepExternal={() => resolveExternal('keep')}
```

- [ ] **Step 5: Typecheck + build**

Run: `cd app && npx tsc -p tsconfig.web.json --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd .. && git add app/src/renderer/pages/SystemOverview.tsx && git commit -m "feat: SystemOverview watches folder, reflects external edits live"
```

---

## Phase 3 — Verify

### Task 8: Full verification + manual smoke

- [ ] **Step 1: Everything green**

Run: `cd app && npm test && npx tsc -p tsconfig.web.json --noEmit && npx tsc -p tsconfig.node.json --noEmit && npm run build`
Expected: all tests pass; no type errors; build succeeds.

- [ ] **Step 2: Manual smoke** (`cd app && npm run dev`)

Against a real system, verify the spec's success criteria:
1. Edit a file **outside the app** (in a terminal / Obsidian) → the open file, the tree, and git dots update automatically.
2. Expand some folders, then trigger an external change → folders stay expanded, selection kept.
3. Type in the app and let it autosave → no banner, no reload (self-writes are no-ops).
4. Type in a file, then change that same file on disk before it autosaves → the "This file was just updated" banner appears; **Keep editing** preserves your text; **Reload** adopts the disk version.
5. Delete the open file on disk → tab closes with "This file was removed", no crash.

- [ ] **Step 3: Commit any touch-ups**

```bash
cd .. && git add -A && git commit -m "chore: external-edit sync verified end-to-end" || echo "nothing to commit"
```

---

## Self-Review Notes (author)

- **Spec coverage:** watcher §1 → T2; push IPC §2 → T3; renderer reaction §3 → T7; reconcile §4 → T1/T4 + banner T5; non-destructive tree §5 → T6; edge cases §6 (deleted file → T7 step 2; branch switch → same batch path); testing §8 → T1/T2 + manual. All covered.
- **Type consistency:** `reconcileDecision(disk, lastWritten, editor)` signature identical in T1 and T4; `fs.onChanged(cb) => () => void` identical across preload (T3) and env.d.ts (T3) and SystemOverview (T7); `externalPrompt`/`resolveExternal` returned by the hook (T4) and consumed by FileViewer via SystemOverview (T5/T7).
- **Self-write safety:** relies on `lastWritten` equality (T1 `ignore` branch); no main-side suppression, matching the spec.
- **Deferred (out of scope):** cross-user collision banners, git conflict resolution, OAuth, packaging.
