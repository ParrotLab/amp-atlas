# Design: External-Edit Sync (Live View)

**Date:** 2026-07-07
**Status:** Approved (pending written-spec review)
**Workstream:** MVP #4 — see [`docs/mvp-planning.md`](../../mvp-planning.md) §7 ("External edits — MVP") and the roadmap.
**Branch:** `feat/external-edit-sync`

## Background

AMP Atlas should be the **live view of the files on your computer**, like an IDE — regardless of who or what changed them. Today the app only reflects changes on a 3-second git-status poll, and an open file isn't reloaded when it changes on disk; the file tree only updates on a full remount (which collapses expanded folders). Because **Claude edits files outside the app** (and users may use Obsidian, or `git pull`), the app must reflect external changes automatically.

**Framing (decided with Kristi, 2026-07-07):** the app has **no concept of "Claude's edit vs. your edit."** An edit is an edit; the file on disk is the truth; the app reflects it. External changes should read as if you made them yourself — no "someone else changed this" scariness.

## Goals / non-goals

**Goals:** open files, the file tree, and git status reflect external changes **automatically and silently**; the one unavoidable collision (unsaved in-app edits to the exact file that just changed) is handled with a **neutral, non-scary** nudge and never loses the user's in-progress typing without asking.

**Non-goals (this workstream):** operational/merge of concurrent edits, collision-prevention banners across users (separate workstream), conflict resolution for git, OAuth, packaging.

## Constraints

- macOS-only MVP (single BrowserWindow, one active system at a time via `/system/:id`).
- Autosave already debounces writes ~600ms, so the editor is "ahead of disk" only briefly.
- The renderer already tracks `lastWritten` (the exact on-disk content last read/written) in `useFileDocument` — this is the key signal to distinguish our own writes and clean-vs-dirty state.

---

## 1. Watcher module (main process)

**Decision:** use **`chokidar`** (v4). It normalizes atomic saves (editors/Obsidian write a temp file then rename, which raw `fs.watch` reports as delete+create), debounces, and supports ignores — the reliability is worth one small dependency. (`fs.watch` and polling were considered and rejected: `fs.watch` misreports atomic saves as deletions; polling isn't "live.")

**New file:** `src/main/watcher.ts`
- `startWatch(repoPath: string, onChange: (paths: string[]) => void): void` — watch `repoPath`, ignoring `**/.git/**` and `**/node_modules/**`. Debounce ~200ms and emit the **batch** of changed absolute paths.
- `stopWatch(): void` — close the current watcher (only one active at a time).
- Pure helper `shouldIgnore(path): boolean` — unit-tested.

**IPC (main `index.ts`):**
- `fs:watch(repoPath)` → `startWatch`, forwarding batches to the renderer via `mainWindow.webContents.send('fs:changed', { paths })`.
- `fs:unwatch()` → `stopWatch`.

**Self-writes are not suppressed in main** — the renderer's `lastWritten` comparison already turns "a change event for a file whose new disk content equals what we just wrote" into a no-op. Keeping main dumb avoids a fragile suppression list.

## 2. Push IPC (new pattern)

The app's first **main → renderer push** event. Preload adds:

```
fs.onChanged(cb: (paths: string[]) => void): () => void   // returns an unsubscribe
```

Implemented with `ipcRenderer.on('fs:changed', ...)`; the returned function removes the listener. Everything else in the app stays request/response.

## 3. Renderer reaction (SystemOverview)

- On `rootPath` set (system opened): call `window.api.fs.watch(rootPath)` and subscribe via `fs.onChanged`. On unmount / `rootPath` change: `fs.unwatch()` + unsubscribe. (One watcher tracks the active system.)
- On a `fs:changed` batch:
  1. **Immediately** run `fetchGitStatus()` (faster than the 3s poll — which **stays as a fallback** so status never goes stale if an event is missed).
  2. Bump a **tree refresh token** (see §5) — non-destructive.
  3. If the batch includes the currently open file (`selectedFile`), call the reconcile step (§4).

## 4. Reconcile the open file (`useFileDocument`)

Add an external-change path. When notified the open file may have changed, re-read disk and decide with a **pure function** (unit-tested):

```
type ReconcileDecision = 'ignore' | 'reload' | 'prompt'
function reconcileDecision(diskContent: string, lastWritten: string, editorContent: string): ReconcileDecision {
  if (diskContent === lastWritten) return 'ignore'      // our own autosave / no real change
  if (editorContent === lastWritten) return 'reload'    // editor clean → silently adopt disk
  return 'prompt'                                        // true simultaneous edit
}
```

- **ignore** → do nothing.
- **reload** → parse disk, `setData`/`setBody`, update `lastWritten` (Claude's edit "just appears").
- **prompt** → surface a neutral **"This file was just updated"** nudge with **Reload** and **Keep editing**:
  - *Reload* → adopt disk (as reload above).
  - *Keep editing* → keep the buffer; set `lastWritten = diskContent` so we don't re-prompt for the same change and the user's next autosave cleanly overwrites with their version.

The hook exposes `externalPrompt: boolean` + `resolveExternal('reload' | 'keep')` and a `reconcile()` function that SystemOverview calls when the open file is in a change batch. `editorContent` for the comparison is the composed document (`composeDocument(data, body)`), matching what autosave writes.

**The nudge is a non-blocking banner inside `FileViewer`** (fed `externalPrompt`/`resolveExternal` as props via SystemOverview) — a slim bar above the editor with "This file was just updated · Reload · Keep editing" — **not** a modal. It must not block the rest of the app; only the true-collision case shows it.

## 5. Non-destructive tree refresh (`FileTree`)

Add `refreshToken?: number`. A `useEffect` on `refreshToken` re-runs the root categorization **and** re-fetches children for every path currently in `expandedNodes`, updating both `categories` and `expandedNodes` while **preserving the expanded keys**. `selectedFile` is a prop and is unaffected, so the user's place is kept. Replaces the current full-remount (`treeKey`) as the mechanism for *external* refreshes; `treeKey` remounts remain only for branch/draft switches (which intentionally reset the view).

## 6. Edge cases

- **Open file deleted externally:** disk read fails on reconcile → close its tab, clear selection, and toast *"This file was removed."*
- **External branch/draft switch (many files at once):** the batch triggers tree + status refresh; the open file reconciles via §4 (usually a silent reload). No special-casing.
- **Rapid bursts:** the 200ms debounce coalesces; the renderer handles one batch.

## 7. Error handling & performance

- One watcher at a time; always torn down on unmount/navigation.
- Ignores keep `.git`/`node_modules` noise out.
- The reconcile re-read is a single `fs.readFile` of one file, only when the open file is in the batch.
- Uniform `{ ok, ... }` IPC shapes; failures are non-fatal (fall back to the poll).

## 8. Testing

- **Pure/unit (Vitest):** `reconcileDecision` (all three branches), `shouldIgnore` (ignores `.git`/`node_modules`, allows `.claude`).
- **Integration:** `watcher.ts` fires `onChange` with the right path when a file in a temp dir is written (chokidar against a real temp directory, with a ready/settle wait).
- Renderer wiring verified manually against a real system (edit a file outside the app → it reflects; edit in-app while it changes on disk → nudge).

## Affected files (indicative)

- **New:** `src/main/watcher.ts` (+ tests). The "file updated" nudge is a **non-blocking banner rendered inside `FileViewer`** (no new modal).
- **Modify:** `src/main/index.ts` (`fs:watch`/`fs:unwatch` + forward events), `src/preload/index.ts` + `src/renderer/env.d.ts` (`fs.onChanged`), `src/renderer/hooks/useFileDocument.ts` (reconcile + `reconcileDecision` extracted for testing), `src/renderer/pages/SystemOverview.tsx` (start/stop watch, react to batches, tree refresh token, deleted-file handling), `src/renderer/components/FileTree.tsx` (`refreshToken` non-destructive refresh), `src/renderer/components/FileViewer.tsx` (render the nudge if we surface it there), `package.json` (add `chokidar`).

## Success criteria

1. Editing a file **outside the app** (Claude/Obsidian/manual) updates the open file, the tree, and git status **automatically**, with no user action.
2. The file tree updates **without collapsing** expanded folders or losing the current selection.
3. The app's **own autosave** never triggers a reload or a nudge (self-writes are no-ops).
4. Editing in-app **while the same file changes on disk** shows one neutral "updated" nudge; **Keep editing** never loses the user's typing.
5. A deleted open file is handled gracefully (tab closes, clear message) — no crash.
6. Vitest covers `reconcileDecision` and `shouldIgnore`; the watcher's fire-on-change is integration-tested.
