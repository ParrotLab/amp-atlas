# Design: Collision Prevention

**Date:** 2026-07-09
**Status:** Approved (pending written-spec review)
**Workstream:** MVP — see [`docs/mvp-planning.md`](../../mvp-planning.md) §7 (trust core) and the roadmap.
**Branch:** `feat/collision-prevention`

## Background

Multiple teammates edit the same GitHub-backed vault. Two people can touch the same file at the same time. Today nothing warns them, and a real overlap only surfaces as a scary GitHub merge conflict at merge time — exactly the git-vocabulary dead-end this app exists to avoid (`mvp-planning.md` §7).

Two guardrails already exist from the draft-lifecycle workstream: drafts branch **from the Live Version only**, and a draft **pulls fresh main on create**. This workstream adds the remaining §7 pieces:

- **Part 1 — Update-before-publish:** bring the draft up to date with the latest Live Version immediately before pushing, so the PR is conflict-free at GitHub and any true overlap surfaces in one controlled moment.
- **Part 2 — Conflict escalation:** if that update hits a real overlap, block the publish calmly — never show git markers — and route the user to their team lead. The draft is provably safe because the merge is aborted.
- **Part 3 — Awareness banner:** a soft, non-blocking heads-up when you open a file that someone else already has in review, so collisions are avoided by coordination before they happen.

Part 1 is the guarantee. Part 3 is visibility. They are independent and layer cleanly.

## Decisions (all confirmed)

- **Merge, not rebase**, for update-before-publish. No history rewrite, no force-push; if anything fails the draft branch is untouched. Safer for non-technical users.
- **Escalation contact is generic:** copy says "**contact your team lead**" — no personal name, no maintenance.
- **Escalation modal is dismiss-only** (`Got it`). No "copy details" button.
- **Awareness banner sees submitted work only.** Open PRs are the only cross-machine signal the GitHub API exposes; someone's un-submitted local draft is invisible by nature. The banner honestly covers "drafts in review." Part 1 still catches an unpublished overlap at publish time.
- **Banner refreshes on file open and on window focus.** Not continuous polling.
- **Banner shows the author's display name**, falling back to their GitHub login when no name is set. Names are resolved once per author and cached.
- Banner styling is soft/informational (warm amber heads-up), never a red error, and never blocks editing or publishing.

---

## Part 1 — Update-before-publish

### New git operation — `updateFromLive`

Add to `app/src/main/draftOps.ts` (mirrors `createDraftFromMain`'s base-branch detection and fetch style):

```ts
export type UpdateFromLiveResult =
  | { ok: true; updated: boolean }               // updated = new commits merged in
  | { ok: false; conflicted: true; files: string[] }

export async function updateFromLive(repoPath: string): Promise<UpdateFromLiveResult> {
  const git = simpleGit(repoPath)
  const info = await git.branch()
  const base = info.all.includes('main') ? 'main' : info.all.includes('master') ? 'master' : 'main'

  // Fetch latest Live Version. Offline / no remote => treat as up-to-date, nothing to merge.
  try {
    await git.fetch('origin', base)
  } catch {
    return { ok: true, updated: false }
  }

  // Is there anything new on origin/base that the draft doesn't have?
  const behind = (await git.raw(['rev-list', '--count', `HEAD..origin/${base}`])).trim()
  if (behind === '0') return { ok: true, updated: false }

  try {
    await git.merge([`origin/${base}`])
    return { ok: true, updated: true }
  } catch (e) {
    // Conflict: capture the overlapping files, then abort so the draft is exactly as the user left it.
    const files = (await git.raw(['diff', '--name-only', '--diff-filter=U']))
      .split('\n').map(s => s.trim()).filter(Boolean)
    await git.merge(['--abort'])
    return { ok: false, conflicted: true, files }
  }
}
```

Notes:
- `git.merge` throwing on conflict is simple-git's documented behavior; the `catch` is the conflict path.
- The abort is unconditional in the catch, so a returned `conflicted` result **always** means a clean working tree. That is the safety guarantee the modal relies on.
- `updated: false` covers three cases (offline, no new commits, up-to-date) — all mean "nothing to do, proceed."

### IPC wiring

- `app/src/preload/index.ts`: add `updateFromLive: (repoPath) => ipcRenderer.invoke('git:updateFromLive', repoPath)` to the `git` api, and the matching type in the preload `Api` interface / `src/renderer/env.d.ts` (wherever the git api is typed).
- `app/src/main/index.ts`: register `ipcMain.handle('git:updateFromLive', (_e, repoPath) => updateFromLive(repoPath))`, importing `updateFromLive` from `./draftOps`.

### Slot into the publish flow

In `app/src/renderer/pages/SystemOverview.tsx`, `handleDoPublish`, **after** the commit and **before** `git.publish`:

```ts
// Commit any uncommitted changes (existing code) ...

// Bring the draft up to date with the Live Version before pushing.
const update = await window.api.git.updateFromLive(rootPath)
if (!update.ok && update.conflicted) {
  setConflictFiles(update.files)   // drives the escalation modal (Part 2)
  return                           // do NOT push
}

// Push to GitHub (existing code) ...
```

A clean update (`ok: true`, `updated` either value) proceeds to push exactly as today; the PR is now based on the latest Live Version.

## Part 2 — Conflict escalation

When `updateFromLive` returns `conflicted`, `handleDoPublish` sets state that opens a calm modal instead of pushing. Reuse the existing modal component/styling used elsewhere in `SystemOverview` (same visual language as the publish modal), not a toast.

**Copy:**

> **The Live Version changed while you were working**
>
> Someone published edits that overlap yours in **`<file>`** *(list each conflicted file)*. Your draft is safe and unchanged — nothing was lost.
>
> To finish publishing, **contact your team lead** and they'll help merge the two versions.
>
> `[ Got it ]`

Properties:
- **No git vocabulary** — "overlap," "the Live Version," "your team lead." Never "conflict markers," "HEAD," "rebase," "merge."
- **Truthful safety** — the merge was already aborted, so the working tree is exactly as the user left it.
- **Dismiss-only.** Publishing stays blocked for this attempt. The user can keep editing and try again later (e.g., after the team lead resolves it upstream).
- The file list comes straight from `update.files`.

## Part 3 — Awareness banner

### New GitHub query — `fileWatchers`

Add to `app/src/main/github.ts` (uses the existing `gh`, `ownerRepo`, `listPRs`, `prFiles` helpers):

```ts
export type FileWatcher = { number: number; author: string; title: string; branch: string }

// Open PRs by someone else that already touch `relPath`. Excludes the caller's current branch.
export async function fileWatchers(repoPath: string, relPath: string): Promise<FileWatcher[]> {
  const currentBranch = (await simpleGit(repoPath).status()).current
  const prs = await listPRs(repoPath)                       // open PRs, already shaped
  const others = prs.filter(p => p.headRefName !== currentBranch)

  const hits: FileWatcher[] = []
  for (const p of others) {
    const files = await prFiles(repoPath, p.number)
    if (files.includes(relPath)) {
      hits.push({
        number: p.number,
        author: await resolveUserName(repoPath, p.author.login),
        title: p.title,
        branch: p.headRefName,
      })
    }
  }
  return hits
}

// Display name for a login, falling back to the login. Cached per login for the process lifetime.
const nameCache = new Map<string, string>()
async function resolveUserName(repoPath: string, login: string): Promise<string> {
  if (nameCache.has(login)) return nameCache.get(login)!
  let name = login
  try {
    const u = await gh(`/users/${login}`) as { name: string | null }
    if (u.name) name = u.name
  } catch { /* fall back to login */ }
  nameCache.set(login, name)
  return name
}
```

Notes:
- `relPath` must match GitHub's `filename` format (repo-root-relative, forward slashes). The caller passes the file's path relative to the vault root.
- Errors (offline, token expired, rate limit) must **not** break file opening — the IPC handler returns `[]` on any thrown error, and the banner simply doesn't show. This is enhancement-only.

### IPC wiring

- `app/src/preload/index.ts`: add `fileWatchers: (repoPath, relPath) => ipcRenderer.invoke('git:fileWatchers', repoPath, relPath)` and its type.
- `app/src/main/index.ts`: `ipcMain.handle('git:fileWatchers', async (_e, repoPath, relPath) => { try { return await fileWatchers(repoPath, relPath) } catch { return [] } })`.

### The banner in the renderer

In the file editor/viewer component (the same one that renders the existing external-edit banner):
- On file open **and** on `window` `focus`, call `git.fileWatchers(rootPath, relPathOfOpenFile)`.
- Cache results per `(repo, relPath)` for the session so re-opening is instant; the focus handler refreshes the cache for the currently open file.
- If the result is non-empty and not dismissed, render a soft amber banner above the document:
  - One watcher: `👀 **<name>** also has edits to this file in review ("<title>"). Coordinate before publishing so your changes don't clash.`
  - Multiple: `👀 **<name>** and **<n> others** also have edits to this file in review. Coordinate before publishing.`
- Dismissible for the session (a small ✕). Dismissal is per-file.
- Never blocks editing or publishing.

**Honest limitation (documented, not a bug):** the banner only sees *submitted* drafts (open PRs). Someone typing in an unpublished local draft is invisible until they submit. Part 1 remains the guarantee that catches such an overlap at publish time.

## Error handling summary

| Situation | Behavior |
|---|---|
| Offline / no remote during update | `updateFromLive` returns `{ok:true, updated:false}` → publish proceeds against local base (same as today) |
| Real overlap at publish | `{ok:false, conflicted:true, files}` → merge aborted, draft safe, escalation modal, no push |
| `fileWatchers` API error (offline, token, rate limit) | handler returns `[]`, banner silently absent — file still opens |
| `resolveUserName` fails for a login | falls back to showing the login |

## Testing

**Automated (runnable here):**
- `updateFromLive` over a temp git repo:
  - new commits on base, no overlap → `{ok:true, updated:true}` and they're merged into the draft.
  - base unchanged / already up to date → `{ok:true, updated:false}`.
  - overlapping edit to the same lines → `{ok:false, conflicted:true, files:[...]}` **and** `git status` is clean afterward (merge aborted) and the draft's file content is byte-identical to before the call (the safety guarantee).
- `fileWatchers` with `listPRs`/`prFiles`/`gh` mocked:
  - a file present in another PR → returned; the current branch's own PR → excluded; zero open PRs → `[]`; the same file in two PRs → both returned; author display name resolved and cached (second lookup makes no second API call); `gh('/users/..')` returning `name:null` → falls back to login.
- Publish-flow branch logic in `SystemOverview` (component test): `conflicted` result → modal shown, `git.publish` **not** called; clean result → proceeds to push.

**Manual (Kristi):** two drafts touching the same file, one already submitted as a PR → open the file in the other draft and confirm the amber banner names the author; then publish and confirm the calm escalation modal, and that the draft's contents are intact afterward.

## Affected files (indicative)

- **New:** `app/src/main/collision.test.ts` (or colocated `draftOps.test.ts` / `github.test.ts` per existing test layout).
- **Modify:**
  - `app/src/main/draftOps.ts` — add `updateFromLive` + `UpdateFromLiveResult`.
  - `app/src/main/github.ts` — add `fileWatchers`, `FileWatcher`, `resolveUserName`.
  - `app/src/main/index.ts` — register `git:updateFromLive` and `git:fileWatchers` handlers.
  - `app/src/preload/index.ts` (+ renderer git-api types) — expose both.
  - `app/src/renderer/pages/SystemOverview.tsx` — call `updateFromLive` in `handleDoPublish`; conflict state + escalation modal.
  - the file editor/viewer component — awareness banner (fetch on open + window focus, session cache, dismiss).

## Success criteria

1. Publishing a draft first brings it up to date with the Live Version; a clean update pushes a conflict-free PR with no user-visible change.
2. A true overlap **blocks the push**, shows a calm, git-jargon-free modal pointing to the team lead, and leaves the draft's working tree provably unchanged.
3. Opening a file that another open PR touches shows a soft, non-blocking banner naming the other author (display name, else login), refreshed on window focus and dismissible.
4. Every failure mode (offline, expired token, rate limit) degrades silently — file opening and editing never break, and publishing still works against the local base.
5. Tests/build stay green; the app still runs in dev.
