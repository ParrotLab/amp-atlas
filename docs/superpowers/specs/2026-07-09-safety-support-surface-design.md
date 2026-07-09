# Design: Safety / Support Surface

**Date:** 2026-07-09
**Status:** Approved (pending written-spec review)
**Workstream:** MVP #8 — see [`docs/mvp-planning.md`](../../mvp-planning.md) §8 and the roadmap "Sync, safety & support".
**Branch:** `feat/safety-support`

## Background

Even with git vocabulary hidden, operations fail — auth expires, the network drops, a repo gets into a weird state — and a non-technical pilot user can't read a git error or recover on their own. Today failures surface as a transient toast and stop there. This workstream adds a coherent recovery + support story so a stuck user has a path that doesn't require reading git, and so Kristi (the "support" role for the pilot) can diagnose problems over a screenshare.

Four parts, in dependency order:

1. **Logging foundation** (`electron-log`) — the local, persistent record everything else reads.
2. **Diagnostics panel** (Settings) — Copy logs / Reveal log file / Report a problem. For Kristi's debugging, not an in-app log viewer.
3. **Retry** — failed GitHub operations offer a one-click re-run via an actionable toast.
4. **Re-sync from GitHub** — a Settings-only escape hatch that resets a broken local system to the Live Version, gated by an explicit unpublished-work choice and a strong-warning confirm.

Anything more technical than Retry or Re-sync → escalate to Kristi. That is the honest MVP boundary.

## Decisions (all confirmed)

- **Logging:** `electron-log`, file transport only, written to the OS log dir. **Strictly local — no remote log access.** Tokens are never logged (they live in `safeStorage`); logs may contain repo paths and branch names, which is acceptable for an internal pilot.
- **No in-app log viewer.** The Diagnostics panel is action buttons only (Copy / Reveal / Report). Kristi reads the actual log file.
- **Retry** is delivered by extending the existing shared `Toast` with an optional action button; a toast with an action does not auto-dismiss.
- **Re-sync** is Settings-only, per-system. When unpublished work exists, the user chooses **Publish first / Keep editing / Discard & re-sync**. "Discard & re-sync" is **literal** — it destroys unpublished work (no hidden backup branch). The two-step flow (choice + strong-warning confirm) is the safeguard.
- **Report a problem** copies recent logs to the clipboard and opens an Airtable form URL **if configured**; otherwise it toasts "Logs copied — paste them to your team lead." The URL is a one-line config constant, empty until Kristi builds the form.

---

## Part 1 — Logging foundation

**New dependency:** `electron-log` (runtime; bundled into the main process by electron-vite).

**New file `app/src/main/logger.ts`** — thin wrapper so the rest of the code doesn't import `electron-log` directly:

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

/** Absolute path to the current log file (for reveal). */
export function logFilePath(): string {
  return log.transports.file.getFile().path
}
```

**Wiring in `app/src/main/index.ts`:**
- Call nothing extra at startup beyond importing `logger` (importing runs `log.initialize()`).
- Register a process-level catch so an unexpected main crash is recorded:
  ```ts
  process.on('uncaughtException', (err) => logError('uncaught', err))
  ```
- Add `logError(<tag>, error)` inside the `catch` of the key `git:*`/`auth:*` handlers that can fail meaningfully: `git:publish` (`publish`), `git:updateFromLive` (`updateFromLive`), `git:createPR` (`createPR`), `git:reviewPR` (`review`), `git:resyncFromLive` (`resync`, added in Part 4), and the auth device-flow/poll handlers (`auth`). These are additions to existing `catch` blocks — the returned `{ ok:false, error }` shape is unchanged.
- The updater already `console.error`s; add `logError('updater', err)` alongside.

**Three IPC handlers (in `index.ts`):**
```ts
ipcMain.handle('diagnostics:recent', async () => {
  try {
    const text = await fs.promises.readFile(logFilePath(), 'utf8')
    const lines = text.split('\n')
    return { ok: true, text: lines.slice(-200).join('\n') }   // last ~200 lines
  } catch (error) { return { ok: false, error: String(error), text: '' } }
})

ipcMain.handle('diagnostics:reveal', async () => {
  try { shell.showItemInFolder(logFilePath()); return { ok: true } }
  catch (error) { return { ok: false, error: String(error) } }
})
```
(`shell` and `fs` are already imported in `index.ts`; if not, add them.)

**Preload + `env.d.ts`:** expose a `diagnostics` api: `recent(): Promise<{ ok; text; error? }>` and `reveal(): Promise<{ ok; error? }>`.

## Part 2 — Diagnostics panel (Settings → Diagnostics)

A new `settings-section` appended to `app/src/renderer/pages/Settings.tsx`, matching the existing card style. **No rendered log box** — three actions:

- **Copy logs** — `const r = await window.api.diagnostics.recent(); if (r.ok) navigator.clipboard.writeText(r.text)` → toast "Logs copied to clipboard."
- **Reveal log file** — `window.api.diagnostics.reveal()` → opens the log folder in Finder.
- **Report a problem** — copies logs (as above) **and** opens the support form:
  ```ts
  const SUPPORT_FORM_URL = '' // Airtable form; fill in when built
  // ...
  if (r.ok) navigator.clipboard.writeText(r.text)
  if (SUPPORT_FORM_URL) window.open(SUPPORT_FORM_URL)
  else showToast('Logs copied — paste them to your team lead.')
  ```
  `SUPPORT_FORM_URL` lives in a tiny new `app/src/renderer/utils/support.ts` so there's one obvious place to set it.

Section copy is plain and non-alarming, e.g. a short line: *"Something not working? Copy your logs or send a report so we can help."*

## Part 3 — Retry (actionable toast)

**Extend `app/src/renderer/components/Toast.tsx`:**

```ts
interface ToastAction { label: string; onClick: () => void }
interface ToastCtx { showToast: (msg: string, action?: ToastAction) => void }
```

Behavior:
- `showToast(msg)` — unchanged: plain message, auto-dismiss after 4s.
- `showToast(msg, { label, onClick })` — renders the message plus an action button; **does not auto-dismiss**. Clicking the button runs `onClick` then clears the toast; a small ✕ also dismisses it.

Provider holds `{ msg, action }` instead of just `msg`; the timeout is only armed when `action` is undefined.

**Wire the key failure points** to offer a Retry that re-invokes the same operation:
- `SystemOverview` publish failure: `showToast("Couldn't publish — check your connection.", { label: 'Retry', onClick: () => handleDoPublish(title, description, reviewers) })`.
- The update-from-Live / sync failure path and the review-submit failure path get the same treatment, each re-calling their own handler.

## Part 4 — Re-sync from GitHub (Settings-only escape hatch)

**New main-process logic in `app/src/main/resync.ts`:**

```ts
import { simpleGit } from 'simple-git'

/** Unpublished work = a dirty working tree OR a local draft branch not merged into origin/base. */
export async function hasUnpublishedWork(repoPath: string): Promise<boolean> {
  const git = simpleGit(repoPath)
  const status = await git.status()
  if (!status.isClean()) return true
  const info = await git.branch()
  const base = info.all.includes('main') ? 'main' : info.all.includes('master') ? 'master' : 'main'
  // Local branches other than base that are NOT merged into origin/base.
  const merged = new Set((await git.raw(['branch', '--merged', `origin/${base}`])).split('\n').map(s => s.replace('*', '').trim()).filter(Boolean))
  return info.all.some(b => b !== base && !b.startsWith('remotes/') && !merged.has(b))
}

/** Hard-reset the local system to exactly match the Live Version. Destroys local changes. */
export async function resyncFromLive(repoPath: string): Promise<{ base: string }> {
  const git = simpleGit(repoPath)
  const info = await git.branch()
  const base = info.all.includes('main') ? 'main' : info.all.includes('master') ? 'master' : 'main'
  await git.fetch('origin', base)
  await git.checkout(base)
  await git.reset(['--hard', `origin/${base}`])
  await git.clean('f', ['-d'])
  return { base }
}
```

**IPC handlers:** `git:hasUnpublishedWork(repoPath)` → `{ ok, hasWork }`; `git:resyncFromLive(repoPath)` → `{ ok, error? }` (logs `resync` on failure). Exposed via preload + `env.d.ts`.

**UI in Settings** — a subtle **Re-sync from GitHub** button in each system's row (only for systems with a connected folder). On click:

1. `const { hasWork } = await window.api.git.hasUnpublishedWork(folderPath)`.
2. **If `hasWork`** → a three-way modal (`ResyncModal`, styled like `ConflictModal`):
   - Title: *"You have unpublished work in ‹system›"*
   - Body: *"Re-syncing replaces this system with the Live Version from GitHub. What would you like to do with your unpublished work?"*
   - Buttons: **Publish first** (closes modal; navigates the user to that system so they can publish — for MVP, closes with a toast *"Open ‹system› and publish your draft first."*), **Keep editing** (cancel), **Discard & re-sync** (→ step 3).
3. **Strong-warning confirm** (`window.confirm` is acceptable here, or a second modal state): *"This replaces everything in ‹system› with the Live Version from GitHub. Any unpublished changes will be gone. This can't be undone."* → Confirm / Cancel.
4. On confirm → `await window.api.git.resyncFromLive(folderPath)` → toast *"‹system› is back in sync with the Live Version."* On failure → toast with a Retry action (Part 3).

**If `hasWork` is false**, skip step 2 and go straight to the strong-warning confirm.

The "Publish first" branch intentionally does not orchestrate publishing from Settings (that flow lives in `SystemOverview`); it just steers the user there without losing anything. This keeps the escape hatch small and avoids duplicating the publish flow.

## Error handling summary

| Situation | Behavior |
|---|---|
| Any logged operation fails | `{ ok:false, error }` returned as today **and** `logError(tag, err)` records it to the file |
| `diagnostics:recent` can't read the log (missing file) | returns `{ ok:false, text:'' }`; Copy/Report still no-op gracefully |
| Report-a-problem with no form URL | logs copied to clipboard; toast tells the user to paste to their team lead |
| Re-sync fetch/reset fails (offline, etc.) | `resyncFromLive` rejects → handler returns `{ ok:false }` → toast with Retry |
| Re-sync on a system with unpublished work | never proceeds without the explicit three-way choice + strong-warning confirm |

## Testing

**Automated (runnable here):**
- `hasUnpublishedWork` over temp repos: clean base only → false; dirty working tree → true; an unmerged local `draft/*` branch → true; a draft branch already merged into `origin/base` → false. (Uses the `withOrigin` temp-repo helper pattern from `draftOps.test.ts`.)
- `resyncFromLive` over temp repos: local commits/edits ahead of origin → after re-sync the working tree exactly matches `origin/base` (extra commits gone, untracked files removed), and it returns the right `base`.
- `Toast` (renderer, jsdom): `showToast(msg)` auto-dismisses; `showToast(msg, action)` renders the button, does not auto-dismiss, and runs `onClick` + clears on click.
- Report-a-problem URL logic (pure helper): returns "open form" when a URL is set, "copied only" when empty.

**Manual (Kristi, in dev):**
- Force a publish failure (disconnect network) → toast shows Retry; reconnect and click Retry → it publishes.
- Settings → Copy logs (paste somewhere to confirm), Reveal log file (Finder opens the folder), Report a problem (logs copied; toast since no URL yet).
- Re-sync a clean system → strong-warning confirm → system matches Live Version.
- Re-sync a system with an unpublished draft → three-way modal appears; "Discard & re-sync" after confirm resets it; "Keep editing" and "Publish first" both leave the work intact.

## Affected files (indicative)

- **New:** `app/src/main/logger.ts`, `app/src/main/resync.ts` (+ `__tests__/resync.test.ts`), `app/src/renderer/utils/support.ts`, `app/src/renderer/components/ResyncModal.tsx` (+ css), `app/src/renderer/components/__tests__/Toast.test.tsx`.
- **Modify:** `app/package.json` (add `electron-log`), `app/src/main/index.ts` (logger import, `uncaughtException`, `logError` in key catches, `diagnostics:*` + `git:hasUnpublishedWork` + `git:resyncFromLive` handlers), `app/src/main/updater.ts` (`logError('updater', …)`), `app/src/preload/index.ts` + `app/src/renderer/env.d.ts` (`diagnostics`, `git.hasUnpublishedWork`, `git.resyncFromLive`), `app/src/renderer/components/Toast.tsx` (+ css) (optional action), `app/src/renderer/pages/Settings.tsx` (+ css) (Diagnostics section + per-system Re-sync).

## Success criteria

1. Operation failures are written to a local, persistent, rotating log file; tokens never appear in it.
2. Settings → Diagnostics can **Copy logs**, **Reveal log file**, and **Report a problem** (copies logs; opens the form when a URL is set, else guides the user to paste to their team lead).
3. A failed publish/sync/review shows a toast with a **Retry** that re-runs the operation and does not auto-vanish.
4. **Re-sync from GitHub** resets a chosen system to exactly match the Live Version, but only after an explicit unpublished-work choice (Publish first / Keep editing / Discard) and a strong-warning confirm.
5. `hasUnpublishedWork` and `resyncFromLive` are unit-tested; the Toast action behavior is unit-tested; tests/build stay green and the app still runs in dev.
