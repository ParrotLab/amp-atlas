# Safety / Support Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give non-technical users a recovery + support path when git operations fail — local logging, a Diagnostics panel, one-click Retry, and a guarded Re-sync-from-GitHub escape hatch.

**Architecture:** A main-process `logger.ts` (electron-log, file-only) records failures; `diagnostics:*` IPC exposes the log for Copy/Reveal/Report in Settings. The shared `Toast` gains an optional non-dismissing action button used for Retry. A main-process `resync.ts` detects unpublished work and hard-resets a system to the Live Version, driven from Settings behind an explicit choice + strong-warning confirm.

**Tech Stack:** Electron (main/preload/renderer IPC), electron-log, simple-git, React 19, Vitest 4.

**Spec:** [`docs/superpowers/specs/2026-07-09-safety-support-surface-design.md`](../specs/2026-07-09-safety-support-surface-design.md)

---

## File Structure

- **`app/src/main/logger.ts`** — electron-log wrapper: `logError`, `logInfo`, `logFilePath`.
- **`app/src/main/resync.ts`** — `hasUnpublishedWork`, `resyncFromLive`.
- **`app/src/main/__tests__/resync.test.ts`** — temp-repo tests for both.
- **`app/src/renderer/utils/support.ts`** — `SUPPORT_FORM_URL` + pure `shouldOpenForm`.
- **`app/src/renderer/utils/__tests__/support.test.ts`** — tests `shouldOpenForm`.
- **`app/src/renderer/components/ResyncModal.tsx`** + **`ResyncModal.css`** — three-way unpublished-work modal.
- **`app/src/main/index.ts`** — logger wiring, `diagnostics:*`, `git:hasUnpublishedWork`, `git:resyncFromLive`.
- **`app/src/main/updater.ts`** — route its errors through `logError`.
- **`app/src/preload/index.ts`** + **`app/src/renderer/env.d.ts`** — `diagnostics`, `git.hasUnpublishedWork`, `git.resyncFromLive`.
- **`app/src/renderer/components/Toast.tsx`** + **`Toast.css`** — optional action button.
- **`app/src/renderer/pages/Settings.tsx`** + **`Settings.css`** — Diagnostics section + per-system Re-sync.

All commands run from `app/`. Run one test file with `npx vitest run <path>`.

---

## Task 1: Logging foundation

**Files:**
- Create: `app/src/main/logger.ts`
- Modify: `app/package.json`, `app/src/main/index.ts`, `app/src/main/updater.ts`

- [ ] **Step 1: Install electron-log**

Run: `npm install electron-log`
Expected: added to `dependencies` in `package.json`.

- [ ] **Step 2: Create the logger wrapper**

Create `app/src/main/logger.ts`:

```ts
import log from 'electron-log/main'

// File transport only; timestamped; rotates at a size cap. Console stays on in dev.
log.transports.file.level = 'info'
log.transports.file.maxSize = 5 * 1024 * 1024 // 5 MB, then rotates
log.initialize()

/** Log an operation failure with a short context tag, e.g. logError('publish', err). */
export function logError(context: string, err: unknown): void {
  log.error(`[${context}]`, err instanceof Error ? err.stack || err.message : String(err))
}

export function logInfo(context: string, message: string): void {
  log.info(`[${context}] ${message}`)
}

/** Absolute path to the current log file (for reveal / read). */
export function logFilePath(): string {
  return log.transports.file.getFile().path
}
```

- [ ] **Step 3: Wire the logger into main**

In `app/src/main/index.ts`, add the import near the top (after the existing imports):

```ts
import { logError, logFilePath } from './logger'
```

Immediately after the imports, add a process-level catch:

```ts
process.on('uncaughtException', (err) => logError('uncaught', err))
```

Then add `logError(<tag>, error)` inside the existing `catch` blocks of these handlers (leave the returned `{ ok:false, error }` shapes unchanged):
- `git:publish` → `logError('publish', error)`
- `git:updateFromLive` → in its `catch`, `logError('updateFromLive', <err>)` (the handler currently swallows; add a `(err)` param and log it)
- `git:createPR` → `logError('createPR', error)`
- `git:reviewPR` → `logError('review', error)`
- the `auth:startDeviceFlow` / `auth:pollToken` catches → `logError('auth', error)`

Example (publish handler):

```ts
ipcMain.handle('git:publish', async (_event, repoPath: string) => {
  try {
    // ...existing body...
  } catch (error) {
    logError('publish', error)
    return { ok: false, error: String(error) }
  }
})
```

- [ ] **Step 4: Route updater errors through the logger**

In `app/src/main/updater.ts`, add `import { logError } from './logger'` and replace the two `console.error('[updater]', …)` / `console.error('[updater] check failed', …)` calls with `logError('updater', err)`.

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add app/package.json app/package-lock.json app/src/main/logger.ts app/src/main/index.ts app/src/main/updater.ts
git commit -m "feat: electron-log logging foundation; route operation failures to a local log file"
```

---

## Task 2: Diagnostics IPC + support helper

**Files:**
- Modify: `app/src/main/index.ts`, `app/src/preload/index.ts`, `app/src/renderer/env.d.ts`
- Create: `app/src/renderer/utils/support.ts`, `app/src/renderer/utils/__tests__/support.test.ts`

- [ ] **Step 1: Write the failing test for the support helper**

Create `app/src/renderer/utils/__tests__/support.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { shouldOpenForm } from '../support'

describe('shouldOpenForm', () => {
  it('returns true when a form URL is configured', () => {
    expect(shouldOpenForm('https://airtable.com/form')).toBe(true)
  })
  it('returns false when the URL is empty', () => {
    expect(shouldOpenForm('')).toBe(false)
  })
  it('returns false for whitespace-only', () => {
    expect(shouldOpenForm('   ')).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/renderer/utils/__tests__/support.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the support helper**

Create `app/src/renderer/utils/support.ts`:

```ts
// The Airtable "Report a problem" form. Empty until the form is built; fill this one line in then.
export const SUPPORT_FORM_URL = ''

/** Whether Report-a-problem should open the form (vs. just copying logs). */
export function shouldOpenForm(url: string): boolean {
  return url.trim().length > 0
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/renderer/utils/__tests__/support.test.ts`
Expected: PASS (3 cases).

- [ ] **Step 5: Add the diagnostics IPC handlers**

In `app/src/main/index.ts`, add near the other handlers (`readFile` is already imported from `fs/promises`, `shell` from `electron`, `logFilePath` from Task 1):

```ts
ipcMain.handle('diagnostics:recent', async () => {
  try {
    const text = await readFile(logFilePath(), 'utf-8')
    return { ok: true, text: text.split('\n').slice(-200).join('\n') }
  } catch (error) { return { ok: false, error: String(error), text: '' } }
})

ipcMain.handle('diagnostics:reveal', async () => {
  try { shell.showItemInFolder(logFilePath()); return { ok: true } }
  catch (error) { return { ok: false, error: String(error) } }
})
```

- [ ] **Step 6: Expose diagnostics in preload**

In `app/src/preload/index.ts`, add a new group inside `const api = { … }` (e.g. after the `system:` group):

```ts
  diagnostics: {
    recent: () => ipcRenderer.invoke('diagnostics:recent'),
    reveal: () => ipcRenderer.invoke('diagnostics:reveal'),
  },
```

- [ ] **Step 7: Add the renderer types**

In `app/src/renderer/env.d.ts`, add after the `system:` group:

```ts
  diagnostics: {
    recent: () => Promise<{ ok: boolean; text: string; error?: string }>
    reveal: () => Promise<{ ok: boolean; error?: string }>
  }
```

- [ ] **Step 8: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds.

- [ ] **Step 9: Commit**

```bash
git add app/src/main/index.ts app/src/preload/index.ts app/src/renderer/env.d.ts app/src/renderer/utils/support.ts app/src/renderer/utils/__tests__/support.test.ts
git commit -m "feat: diagnostics IPC (recent/reveal) + support form helper"
```

---

## Task 3: Diagnostics panel in Settings

**Files:**
- Modify: `app/src/renderer/pages/Settings.tsx`, `app/src/renderer/pages/Settings.css`

- [ ] **Step 1: Add the imports and handlers**

In `app/src/renderer/pages/Settings.tsx`, add the import near the top:

```tsx
import { SUPPORT_FORM_URL, shouldOpenForm } from '../utils/support'
```

Inside the `Settings` component (with the other handlers), add:

```tsx
  const handleCopyLogs = async () => {
    const r = await window.api.diagnostics.recent()
    if (r.ok) { await navigator.clipboard.writeText(r.text); showToast('Logs copied to clipboard.') }
    else showToast("Couldn't read logs.")
  }

  const handleRevealLogs = () => { window.api.diagnostics.reveal() }

  const handleReport = async () => {
    const r = await window.api.diagnostics.recent()
    if (r.ok) await navigator.clipboard.writeText(r.text)
    if (shouldOpenForm(SUPPORT_FORM_URL)) window.open(SUPPORT_FORM_URL)
    else showToast('Logs copied — paste them to your team lead.')
  }
```

- [ ] **Step 2: Add the Diagnostics section to the JSX**

In the returned JSX, add a new section before the closing `</div></div>` of `settings-inner` (e.g. after the "About" section):

```tsx
        <div className="settings-section">
          <div className="settings-section-title" style={{ marginBottom: '14px' }}>Diagnostics</div>
          <div className="settings-info-card">
            <div className="settings-info-label">Something not working?</div>
            <div className="settings-info-value">Copy your logs or send a report so we can help.</div>
            <div className="settings-diagnostics-actions">
              <button className="settings-btn" onClick={handleCopyLogs}>Copy logs</button>
              <button className="settings-btn" onClick={handleRevealLogs}>Reveal log file</button>
              <button className="settings-btn primary" onClick={handleReport}>Report a problem</button>
            </div>
          </div>
        </div>
```

- [ ] **Step 3: Add styles**

Append to `app/src/renderer/pages/Settings.css`:

```css
.settings-diagnostics-actions { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/src/renderer/pages/Settings.tsx app/src/renderer/pages/Settings.css
git commit -m "feat: Settings Diagnostics panel — copy logs, reveal log file, report a problem"
```

---

## Task 4: Toast action button (Retry substrate)

**Files:**
- Modify: `app/src/renderer/components/Toast.tsx`, `app/src/renderer/components/Toast.css`

- [ ] **Step 1: Extend the Toast provider**

Replace the body of `app/src/renderer/components/Toast.tsx` with:

```tsx
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import './Toast.css'

interface ToastAction { label: string; onClick: () => void }
interface ToastCtx { showToast: (msg: string, action?: ToastAction) => void }
const Ctx = createContext<ToastCtx>({ showToast: () => {} })
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const [action, setAction] = useState<ToastAction | null>(null)

  const showToast = useCallback((m: string, a?: ToastAction) => {
    setMsg(m)
    setAction(a ?? null)
    // Only auto-dismiss plain toasts; an actionable toast stays until used or dismissed.
    if (!a) setTimeout(() => { setMsg(null); setAction(null) }, 4000)
  }, [])

  const dismiss = () => { setMsg(null); setAction(null) }

  return (
    <Ctx.Provider value={{ showToast }}>
      {children}
      {msg && (
        <div className="amp-toast">
          <span>{msg}</span>
          {action && (
            <span className="amp-toast-actions">
              <button className="amp-toast-btn" onClick={() => { action.onClick(); dismiss() }}>{action.label}</button>
              <button className="amp-toast-dismiss" onClick={dismiss} aria-label="Dismiss">✕</button>
            </span>
          )}
        </div>
      )}
    </Ctx.Provider>
  )
}
```

- [ ] **Step 2: Add styles for the action buttons**

Append to `app/src/renderer/components/Toast.css`:

```css
.amp-toast-actions { display: inline-flex; align-items: center; gap: 8px; margin-left: 14px; }
.amp-toast-btn {
  background: #8B2BFF; color: #fff; border: none; border-radius: 6px;
  padding: 5px 12px; font-size: 13px; cursor: pointer; font-family: inherit;
}
.amp-toast-btn:hover { background: #7A1FE8; }
.amp-toast-dismiss {
  background: none; border: none; color: inherit; opacity: 0.6; cursor: pointer; font-size: 13px;
}
.amp-toast-dismiss:hover { opacity: 1; }
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds. Existing `showToast('...')` calls still compile (the action arg is optional).

- [ ] **Step 4: Commit**

```bash
git add app/src/renderer/components/Toast.tsx app/src/renderer/components/Toast.css
git commit -m "feat: optional non-dismissing action button on toasts (Retry substrate)"
```

---

## Task 5: Wire Retry into failed operations

**Files:**
- Modify: `app/src/renderer/pages/SystemOverview.tsx`

- [ ] **Step 1: Add Retry to the publish failure**

In `app/src/renderer/pages/SystemOverview.tsx`, find the publish failure toast in `handleDoPublish`:

```tsx
    const pushResult = await window.api.git.publish(rootPath)
    if (!pushResult.ok) {
      showToast(`Couldn't publish: ${pushResult.error}`)
      return
    }
```

Replace the `showToast(...)` line with an actionable one that re-runs the same publish:

```tsx
    const pushResult = await window.api.git.publish(rootPath)
    if (!pushResult.ok) {
      showToast("Couldn't publish — check your connection.", {
        label: 'Retry',
        onClick: () => { void handleDoPublish(title, description, reviewers) },
      })
      return
    }
```

- [ ] **Step 2: Add Retry to any other GitHub failure toasts in this file**

Search `SystemOverview.tsx` for other `showToast("Couldn't …")` calls tied to a GitHub op (e.g. a sync/refresh or review-submit failure). For each, add the same `{ label: 'Retry', onClick: () => <re-invoke that handler> }` second argument, calling the specific handler that failed. If there are none beyond publish, this step is a no-op — do not invent new failure sites.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/src/renderer/pages/SystemOverview.tsx
git commit -m "feat: offer Retry on failed publish (and other GitHub ops)"
```

---

## Task 6: Re-sync core logic

**Files:**
- Create: `app/src/main/resync.ts`, `app/src/main/__tests__/resync.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/src/main/__tests__/resync.test.ts`. It reuses the same temp-repo + origin pattern as `draftOps.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { simpleGit } from 'simple-git'
import { hasUnpublishedWork, resyncFromLive } from '../resync'

async function tempRepo(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'amp-'))
  const git = simpleGit(dir)
  await git.init()
  await git.addConfig('user.email', 't@t.com')
  await git.addConfig('user.name', 'T')
  await git.checkoutLocalBranch('main')
  writeFileSync(join(dir, 'readme.md'), '# hi\n')
  await git.add('-A'); await git.commit('init')
  return dir
}

async function withOrigin(dir: string): Promise<{ originWork: string }> {
  const bare = mkdtempSync(join(tmpdir(), 'amp-bare-'))
  await simpleGit(dir).raw(['clone', '--bare', dir, bare])
  await simpleGit(dir).addRemote('origin', bare)
  await simpleGit(dir).fetch('origin', 'main')
  const originWork = mkdtempSync(join(tmpdir(), 'amp-origin-'))
  await simpleGit(originWork).clone(bare, originWork)
  await simpleGit(originWork).addConfig('user.email', 't@t.com')
  await simpleGit(originWork).addConfig('user.name', 'T')
  return { originWork }
}

describe('hasUnpublishedWork', () => {
  it('false on a clean base that matches origin', async () => {
    const dir = await tempRepo(); await withOrigin(dir)
    expect(await hasUnpublishedWork(dir)).toBe(false)
  })
  it('true when the working tree is dirty', async () => {
    const dir = await tempRepo(); await withOrigin(dir)
    writeFileSync(join(dir, 'readme.md'), '# hi\n\nedited\n')
    expect(await hasUnpublishedWork(dir)).toBe(true)
  })
  it('true when an unmerged local draft branch exists', async () => {
    const dir = await tempRepo(); await withOrigin(dir)
    await simpleGit(dir).checkoutLocalBranch('draft/x')
    writeFileSync(join(dir, 'note.md'), 'draft\n')
    await simpleGit(dir).add('-A'); await simpleGit(dir).commit('draft work')
    await simpleGit(dir).checkout('main')
    expect(await hasUnpublishedWork(dir)).toBe(true)
  })
})

describe('resyncFromLive', () => {
  it('hard-resets local state to match the Live Version', async () => {
    const dir = await tempRepo(); const { originWork } = await withOrigin(dir)
    // origin advances
    writeFileSync(join(originWork, 'live.md'), 'live\n')
    await simpleGit(originWork).add('-A'); await simpleGit(originWork).commit('live edit')
    await simpleGit(originWork).push('origin', 'main')
    // local diverges: a stray commit + an untracked file
    writeFileSync(join(dir, 'readme.md'), '# hi\n\nlocal junk\n')
    await simpleGit(dir).add('-A'); await simpleGit(dir).commit('local junk')
    writeFileSync(join(dir, 'untracked.md'), 'junk\n')

    const res = await resyncFromLive(dir)
    expect(res).toEqual({ base: 'main' })
    // now matches origin/main exactly
    expect(existsSync(join(dir, 'live.md'))).toBe(true)         // pulled from Live
    expect(existsSync(join(dir, 'untracked.md'))).toBe(false)   // cleaned
    const localHead = (await simpleGit(dir).revparse(['HEAD'])).trim()
    const originHead = (await simpleGit(dir).revparse(['origin/main'])).trim()
    expect(localHead).toBe(originHead)
    expect((await simpleGit(dir).status()).isClean()).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/main/__tests__/resync.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement resync.ts**

Create `app/src/main/resync.ts`:

```ts
import { simpleGit } from 'simple-git'

function baseName(all: string[]): string {
  return all.includes('main') ? 'main' : all.includes('master') ? 'master' : 'main'
}

/** Unpublished work = a dirty working tree OR a local draft branch not merged into origin/base. */
export async function hasUnpublishedWork(repoPath: string): Promise<boolean> {
  const git = simpleGit(repoPath)
  const status = await git.status()
  if (!status.isClean()) return true
  const info = await git.branch()
  const base = baseName(info.all)
  const merged = new Set(
    (await git.raw(['branch', '--merged', `origin/${base}`]))
      .split('\n').map(s => s.replace('*', '').trim()).filter(Boolean),
  )
  return info.all.some(b => b !== base && !b.startsWith('remotes/') && !merged.has(b))
}

/** Hard-reset the local system to exactly match the Live Version. Destroys local changes. */
export async function resyncFromLive(repoPath: string): Promise<{ base: string }> {
  const git = simpleGit(repoPath)
  const info = await git.branch()
  const base = baseName(info.all)
  await git.fetch('origin', base)
  await git.checkout(base)
  await git.reset(['--hard', `origin/${base}`])
  await git.clean('f', ['-d'])
  return { base }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/main/__tests__/resync.test.ts`
Expected: PASS (4 cases).

- [ ] **Step 5: Commit**

```bash
git add app/src/main/resync.ts app/src/main/__tests__/resync.test.ts
git commit -m "feat: resync core — hasUnpublishedWork + resyncFromLive (hard reset to Live Version)"
```

---

## Task 7: Re-sync IPC

**Files:**
- Modify: `app/src/main/index.ts`, `app/src/preload/index.ts`, `app/src/renderer/env.d.ts`

- [ ] **Step 1: Register the handlers**

In `app/src/main/index.ts`, add `import { hasUnpublishedWork, resyncFromLive } from './resync'` near the top, then add near the other `git:*` handlers:

```ts
ipcMain.handle('git:hasUnpublishedWork', async (_event, repoPath: string) => {
  try { return { ok: true, hasWork: await hasUnpublishedWork(repoPath) } }
  catch (error) { logError('resync', error); return { ok: false, hasWork: false, error: String(error) } }
})

ipcMain.handle('git:resyncFromLive', async (_event, repoPath: string) => {
  try { await resyncFromLive(repoPath); return { ok: true } }
  catch (error) { logError('resync', error); return { ok: false, error: String(error) } }
})
```

- [ ] **Step 2: Expose in preload**

In `app/src/preload/index.ts`, inside the `git` group, add:

```ts
    hasUnpublishedWork: (repoPath: string) => ipcRenderer.invoke('git:hasUnpublishedWork', repoPath),
    resyncFromLive: (repoPath: string) => ipcRenderer.invoke('git:resyncFromLive', repoPath),
```

- [ ] **Step 3: Add renderer types**

In `app/src/renderer/env.d.ts`, inside the `git` group, add:

```ts
    hasUnpublishedWork: (repoPath: string) => Promise<{ ok: boolean; hasWork: boolean; error?: string }>
    resyncFromLive: (repoPath: string) => Promise<{ ok: boolean; error?: string }>
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/index.ts app/src/preload/index.ts app/src/renderer/env.d.ts
git commit -m "feat: wire git:hasUnpublishedWork + git:resyncFromLive over IPC"
```

---

## Task 8: Re-sync UI (ResyncModal + Settings button)

**Files:**
- Create: `app/src/renderer/components/ResyncModal.tsx`, `app/src/renderer/components/ResyncModal.css`
- Modify: `app/src/renderer/pages/Settings.tsx`, `app/src/renderer/pages/Settings.css`

- [ ] **Step 1: Create the three-way modal**

Create `app/src/renderer/components/ResyncModal.tsx`:

```tsx
import { useEffect } from 'react'
import './ResyncModal.css'

interface ResyncModalProps {
  isOpen: boolean
  systemName: string
  onPublishFirst: () => void
  onDiscard: () => void
  onClose: () => void   // "Keep editing" / cancel
}

/** Shown when Re-sync is requested on a system that has unpublished work. */
export default function ResyncModal({ isOpen, systemName, onPublishFirst, onDiscard, onClose }: ResyncModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="resync-modal-overlay" onClick={onClose}>
      <div className="resync-modal" onClick={e => e.stopPropagation()}>
        <h2 className="resync-modal-title">You have unpublished work in {systemName}</h2>
        <p className="resync-modal-body">
          Re-syncing replaces this system with the Live Version from GitHub. What would you like to do with your unpublished work?
        </p>
        <div className="resync-modal-actions">
          <button className="resync-modal-primary" onClick={onPublishFirst}>Publish first</button>
          <button className="resync-modal-ghost" onClick={onClose}>Keep editing</button>
          <button className="resync-modal-danger" onClick={onDiscard}>Discard &amp; re-sync</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create the modal styles**

Create `app/src/renderer/components/ResyncModal.css`:

```css
.resync-modal-overlay {
  position: fixed; inset: 0; background: rgba(40, 20, 50, 0.35);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.resync-modal {
  background: #fffdf9; border-radius: 14px; padding: 28px 30px; max-width: 460px; width: 90%;
  box-shadow: 0 12px 40px rgba(40, 20, 50, 0.25); font-family: inherit;
}
.resync-modal-title { margin: 0 0 12px; font-size: 19px; color: #3b2a44; }
.resync-modal-body { margin: 0 0 12px; font-size: 14px; line-height: 1.5; color: #4a3d52; }
.resync-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; flex-wrap: wrap; }
.resync-modal-primary {
  background: #6b2fb3; color: #fff; border: none; border-radius: 8px; padding: 9px 18px; font-size: 14px; cursor: pointer;
}
.resync-modal-primary:hover { background: #5a259c; }
.resync-modal-ghost {
  background: none; border: none; color: #6b6966; padding: 9px 12px; font-size: 14px; cursor: pointer;
}
.resync-modal-ghost:hover { color: #3b2a44; }
.resync-modal-danger {
  background: #fff; color: #c02626; border: 1px solid #eab8b8; border-radius: 8px; padding: 9px 18px; font-size: 14px; cursor: pointer;
}
.resync-modal-danger:hover { background: #fdf0f0; }
```

- [ ] **Step 3: Wire the Re-sync flow into Settings**

In `app/src/renderer/pages/Settings.tsx`, add the import:

```tsx
import ResyncModal from '../components/ResyncModal'
```

Add state (with the other `useState`s):

```tsx
  const [resyncFor, setResyncFor] = useState<SystemConfig | null>(null)
```

Add the flow handlers inside the component:

```tsx
  // Step 1: user clicks Re-sync on a system row.
  const handleResyncClick = async (sys: SystemConfig) => {
    if (!sys.folderPath) return
    const r = await window.api.git.hasUnpublishedWork(sys.folderPath)
    if (r.ok && r.hasWork) { setResyncFor(sys); return }  // ask what to do first
    void confirmAndResync(sys)                             // clean: straight to strong-warning confirm
  }

  // Steps 3–4: strong-warning confirm, then hard reset.
  const confirmAndResync = async (sys: SystemConfig) => {
    if (!sys.folderPath) return
    const ok = window.confirm(
      `This replaces everything in "${sys.name}" with the Live Version from GitHub.\n\n` +
      `Any unpublished changes will be gone. This can't be undone.`,
    )
    if (!ok) return
    const r = await window.api.git.resyncFromLive(sys.folderPath)
    if (r.ok) showToast(`${sys.name} is back in sync with the Live Version.`)
    else showToast("Couldn't re-sync.", { label: 'Retry', onClick: () => { void confirmAndResync(sys) } })
  }
```

Add a **Re-sync** button in each system's `settings-system-actions` block (only when a folder is connected), after the existing Change/Remove buttons:

```tsx
                  {sys.folderPath && (
                    <button className="settings-btn subtle" onClick={() => handleResyncClick(sys)}>
                      Re-sync
                    </button>
                  )}
```

Render the modal once, before the final closing `</div></div>` of the page:

```tsx
      <ResyncModal
        isOpen={resyncFor !== null}
        systemName={resyncFor?.name ?? ''}
        onPublishFirst={() => { const s = resyncFor; setResyncFor(null); if (s) showToast(`Open ${s.name} and publish your draft first.`) }}
        onDiscard={() => { const s = resyncFor; setResyncFor(null); if (s) void confirmAndResync(s) }}
        onClose={() => setResyncFor(null)}
      />
```

- [ ] **Step 4: Add the subtle button style**

Append to `app/src/renderer/pages/Settings.css`:

```css
.settings-btn.subtle { color: #6b6966; background: transparent; }
.settings-btn.subtle:hover { color: #3b2a44; background: rgba(0,0,0,0.04); }
```

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add app/src/renderer/components/ResyncModal.tsx app/src/renderer/components/ResyncModal.css app/src/renderer/pages/Settings.tsx app/src/renderer/pages/Settings.css
git commit -m "feat: Re-sync from GitHub — Settings escape hatch with unpublished-work choice + strong-warning confirm"
```

---

## Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all suites PASS, including the new `support` and `resync` cases.

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 3: Manual smoke (Kristi, in dev)**

Run: `npm run dev`, then:
- Disconnect the network and publish a draft → toast offers **Retry**; reconnect, click Retry → it publishes. The failure is written to the log.
- Settings → **Copy logs** (paste somewhere to confirm text), **Reveal log file** (Finder opens the log folder), **Report a problem** (logs copied; toast appears since no URL is set yet).
- Settings → **Re-sync** on a clean system → strong-warning confirm → system matches the Live Version.
- Make an unpublished edit in a system, then **Re-sync** it → the three-way modal appears; **Keep editing** and **Publish first** leave the work intact; **Discard & re-sync** (after the confirm) resets it.

- [ ] **Step 4: Add manual cases to the MVP testing checklist**

Add a "Safety / support surface" section to `docs/mvp-testing-checklist.md` with the four manual cases from Step 3 (Retry, Diagnostics buttons, clean Re-sync, unpublished-work Re-sync). Commit it.

- [ ] **Step 5: Finish the branch**

Use the **superpowers:finishing-a-development-branch** skill to run tests, then push and open a PR.

---

## Self-Review Notes

- **Spec coverage:** Part 1 → Task 1. Part 2 (Diagnostics + Report) → Tasks 2–3. Part 3 (Retry) → Tasks 4–5. Part 4 (Re-sync) → Tasks 6–8. Error-handling table → logger catches (Task 1), diagnostics degradation (Task 2), resync IPC try/catch (Task 7), Retry-on-resync-failure (Task 8). Testing plan → Tasks 2, 6, 9.
- **Type consistency:** `diagnostics.recent/reveal`, `git.hasUnpublishedWork` (`{ ok, hasWork }`), `git.resyncFromLive` (`{ ok, error? }`) are identical across preload (Tasks 2/7), env.d.ts (Tasks 2/7), and consumers (Tasks 3/8). `ToastAction { label, onClick }` is defined in Task 4 and used in Tasks 5/8. `resyncFromLive` returns `{ base }` (Task 6) — consumed only in tests; the IPC handler discards it and returns `{ ok }`.
- **No RTL:** the Toast change is verified by build + manual smoke (no React Testing Library in the project); automated coverage is placed on the pure `shouldOpenForm` and the `resync` git functions.
- **No placeholders:** `SUPPORT_FORM_URL = ''` is an intentional, documented config seam, not a stub.
