# Re-request Review via "Publish Changes" — Implementation Plan (Part 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let an author who has an open PR re-publish edits and send the work back to reviewers — the Publish modal becomes "Publish Changes" (editable description + reviewer re-request), which returns the PR to the reviewer's "Needs your review" queue.

**Architecture:** A new `updatePR` capability (PATCH title/body + POST requested_reviewers) is called by `handleDoPublish` when a PR already exists (instead of `createPR`). The Publish modal switches to update mode when a PR exists. The inbox classifier treats any PR with pending requested reviewers as "In review", so re-requesting flips the author's badge and re-surfaces it to the reviewer.

**Tech Stack:** React/TypeScript (renderer), GitHub REST (main), Vitest.

## Global Constraints

- No emoji; design tokens; plain language (Publish Changes, Request review, In review). Code style: no semicolons, single quotes, 2-space indent.
- SystemOverview.tsx is now clean (author committed WIP) — safe to edit.

## File Structure

**Modify:** `app/src/main/github.ts` (add `updatePR`, add `body` to `prStatus`); `app/src/main/index.ts` (handler); `app/src/preload/index.ts` (bridge); `app/src/renderer/env.d.ts` (types); `app/src/renderer/components/PublishModal.tsx` (update mode); `app/src/renderer/pages/SystemOverview.tsx` (prStatus fields + handleDoPublish + modal props); `app/src/renderer/utils/inboxClassify.ts` + test (pending-reviewers rule).

**Test command (from `app/`):** `npx vitest run <path>` · **Scoped typecheck:** `npx tsc --noEmit 2>&1 | grep -E '<file>'`

---

## Task 1: `updatePR` capability + `body` on `prStatus`

- [ ] **Step 1: github.ts — add `updatePR` and add `body` to `prStatus`**

Append `updatePR` to `app/src/main/github.ts`:

```ts
export async function updatePR(repoPath: string, num: number, title: string, body: string, reviewers: string[]) {
  const { owner, repo } = await ownerRepo(repoPath)
  await gh(`/repos/${owner}/${repo}/pulls/${num}`, { method: 'PATCH', body: JSON.stringify({ title, body: body || '' }) })
  if (reviewers.length) {
    try { await gh(`/repos/${owner}/${repo}/pulls/${num}/requested_reviewers`, { method: 'POST', body: JSON.stringify({ reviewers }) }) } catch { /* best-effort */ }
  }
}
```

In `prStatus`, extend the list cast with `body` and return it:

```ts
  const list = await gh(`/repos/${owner}/${repo}/pulls?head=${owner}:${branch}&state=all`) as Array<{ number: number; title: string; state: string; merged_at: string | null; html_url: string; body: string | null }>
  const p = list[0]
  if (!p) return { hasPR: false }
  const state = p.merged_at ? 'MERGED' : p.state.toUpperCase()
  return { hasPR: true, pr: { number: p.number, title: p.title, url: p.html_url, state, reviewDecision: await reviewDecision(owner, repo, p.number), body: p.body || '' } }
```

- [ ] **Step 2: index.ts — handler**

After `git:latestReview`:

```ts
ipcMain.handle('git:updatePR', async (_event, repoPath: string, num: number, title: string, body: string, reviewers: string[]) => {
  try { await github.updatePR(repoPath, num, title, body, reviewers); return { ok: true } }
  catch (error) { logError('updatePR', error); return { ok: false, error: String(error) } }
})
```

- [ ] **Step 3: preload — bridge** (near `latestReview`):

```ts
    updatePR: (repoPath: string, prNumber: number, title: string, body: string, reviewers: string[]) => ipcRenderer.invoke('git:updatePR', repoPath, prNumber, title, body, reviewers),
```

- [ ] **Step 4: env.d.ts — types.** Add `updatePR` (near `latestReview`) and add `body` to the `prStatus` pr shape:

```ts
    updatePR: (repoPath: string, prNumber: number, title: string, body: string, reviewers: string[]) => Promise<{ ok: boolean; error?: string }>
```
And change the `prStatus` return type's `pr` object to include `body: string`:
```ts
    prStatus: (repoPath: string) => Promise<{ ok: boolean; hasPR: boolean; pr?: { number: number; title: string; url: string; state: string; reviewDecision: string | null; body: string } }>
```

- [ ] **Step 5: Verify + commit**

Run: `cd app && npx tsc --noEmit 2>&1 | grep -E 'github\.ts|index\.ts|preload|env\.d\.ts' || echo "(clean)"`
```bash
git add app/src/main/github.ts app/src/main/index.ts app/src/preload/index.ts app/src/renderer/env.d.ts
git commit -m "feat(review): add updatePR (update body + re-request reviewers) and body on prStatus"
```

---

## Task 2: Classifier — pending reviewers read as "In review"

- [ ] **Step 1: Add failing tests** to `app/src/renderer/utils/__tests__/inboxClassify.test.ts` (before the closing `})`):

```ts
  it('my PR with a pending requested reviewer is In review even if changes were requested', () => {
    expect(classifyInboxPR(pr({ author: { login: me }, reviewDecision: 'CHANGES_REQUESTED', requestedReviewers: ['rachel'] }), me))
      .toEqual({ tab: 'drafts', action: 'view', badge: 'inreview' })
  })
  it('my fresh PR out for review is In review', () => {
    expect(classifyInboxPR(pr({ author: { login: me }, requestedReviewers: ['rachel'] }), me))
      .toEqual({ tab: 'drafts', action: 'view', badge: 'inreview' })
  })
```

- [ ] **Step 2: Run — expect the CHANGES_REQUESTED one to fail**

Run: `cd app && npx vitest run src/renderer/utils/__tests__/inboxClassify.test.ts`
Expected: FAIL (the pending+changes case currently returns make-edits).

- [ ] **Step 3: Update `classifyInboxPR`** in `app/src/renderer/utils/inboxClassify.ts` — add the pending-reviewers rule first inside the `mine` branch:

```ts
export function classifyInboxPR(pr: ClassifiablePR, login: string): InboxClassification {
  const mine = pr.author.login === login
  const pending = (pr.requestedReviewers ?? [])
  if (mine) {
    if (pending.length > 0) return { tab: 'drafts', action: 'view', badge: 'inreview' }
    if (pr.reviewDecision === 'APPROVED') return { tab: 'publish', action: 'publish', badge: 'approved' }
    if (pr.reviewDecision === 'CHANGES_REQUESTED') return { tab: 'drafts', action: 'make-edits', badge: 'changes' }
    return { tab: 'drafts', action: 'view', badge: 'inreview' }
  }
  if (pending.includes(login)) return { tab: 'review', action: 'review', badge: null }
  return { tab: null, action: 'view', badge: null }
}
```

- [ ] **Step 4: Run — all pass**

Run: `cd app && npx vitest run src/renderer/utils/__tests__/inboxClassify.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/renderer/utils/inboxClassify.ts app/src/renderer/utils/__tests__/inboxClassify.test.ts
git commit -m "feat(inbox): a PR with pending requested reviewers reads as In review"
```

---

## Task 3: PublishModal — "Publish Changes" update mode

- [ ] **Step 1: Add props + update-mode behavior** to `app/src/renderer/components/PublishModal.tsx`.

Add to `PublishModalProps`:
```ts
  hasPR?: boolean
  existingTitle?: string
  existingBody?: string
```
Destructure them in the component signature (with defaults `hasPR = false`).

In the `useEffect` open-reset, pre-fill from the existing PR when updating:
```ts
      setTitle(hasPR ? (existingTitle || draftName || '') : (draftName || ''))
      setDescription(hasPR ? (existingBody || '') : '')
```
(Add `hasPR`, `existingTitle`, `existingBody` to that effect's dependency array.)

Change the modal `title`/`subtitle` and the submit button label to reflect update mode:
```tsx
      title={hasPR ? 'Publish Changes' : 'Publish Your Changes'}
      subtitle={hasPR ? 'Update your description and send it back for review.' : 'Share your work with the team and request a review.'}
```
```tsx
          <Button variant="primary" disabled={!title.trim() || status === 'publishing'} onClick={handlePublish}>
            {status === 'publishing' ? 'Publishing…' : hasPR ? 'Publish Changes' : 'Publish & Request Review'}
          </Button>
```
And the done-state subtitle:
```tsx
          <div className="publish-subtitle">
            {hasPR ? 'Your changes are in.' : 'Your changes are now visible to the team.'}
            {selectedReviewers.length > 0 && ` ${selectedReviewers.join(' and ')} will be notified.`}
          </div>
```

- [ ] **Step 2: Verify + commit**

Run: `cd app && npx tsc --noEmit 2>&1 | grep -E 'PublishModal' || echo "(clean)"`
```bash
git add app/src/renderer/components/PublishModal.tsx
git commit -m "feat(publish): Publish Changes mode when a PR already exists"
```

---

## Task 4: SystemOverview — wire update + re-request

- [ ] **Step 1: Extend `prStatus` state** in `app/src/renderer/pages/SystemOverview.tsx`.

Change the state type (currently `{ hasPR: boolean; state?: string; reviewDecision?: string | null }`) to include number/title/body:
```ts
  const [prStatus, setPrStatus] = useState<{ hasPR: boolean; number?: number; title?: string; body?: string; state?: string; reviewDecision?: string | null }>({ hasPR: false })
```
Update the setter in the `prStatus` fetch effect:
```ts
        setPrStatus({
          hasPR: result.hasPR,
          number: result.pr?.number,
          title: result.pr?.title,
          body: result.pr?.body,
          state: result.pr?.state,
          reviewDecision: result.pr?.reviewDecision
        })
```

- [ ] **Step 2: Update `handleDoPublish`** — replace the `createPR` block with create-or-update:

```ts
    if (!isMainBranch) {
      if (prStatus.hasPR && prStatus.number) {
        const upd = await window.api.git.updatePR(rootPath, prStatus.number, title, description, reviewers)
        if (!upd.ok) console.warn('PR update failed:', upd.error)
      } else {
        const prResult = await window.api.git.createPR(rootPath, title, description, reviewers)
        if (prResult.ok && prResult.url) console.log('PR created:', prResult.url)
        else if (!prResult.ok && !prResult.alreadyExists) console.warn('PR creation failed:', prResult.error)
      }
    }
```

- [ ] **Step 3: Pass update-mode props to `PublishModal`**:

```tsx
      <PublishModal
        isOpen={showPublish}
        onClose={() => setShowPublish(false)}
        onPublish={handleDoPublish}
        draftName={humanize(branch)}
        modifiedCount={gitModified.size}
        newCount={gitNew.size}
        repoPath={rootPath}
        hasPR={prStatus.hasPR}
        existingTitle={prStatus.title}
        existingBody={prStatus.body}
      />
```

- [ ] **Step 4: Verify + commit**

Run: `cd app && npx tsc --noEmit 2>&1 | grep -E 'SystemOverview' || echo "(clean)"`
```bash
git add app/src/renderer/pages/SystemOverview.tsx
git commit -m "feat(publish): update existing PR + re-request reviewers on Publish Changes"
```

---

## Task 5: Verify end-to-end + polish

- [ ] **Step 1: Full check** — `cd app && npx tsc --noEmit 2>&1 | grep -E 'github|index\.ts|preload|env\.d\.ts|PublishModal|SystemOverview|inboxClassify|Inbox' || echo "(clean)"; npx vitest run`. Expected: `(clean)`; all tests pass. (Restart the dev app — main/preload changed.)
- [ ] **Step 2: Manual flow** — as reviewer, request changes on a PR → it leaves your inbox. As author, open that draft → "Changes requested" → Make Edits → save → the modal reads **Publish Changes**, description pre-filled → pick the reviewer → Publish Changes. Confirm: the author's badge flips to **In review**, and the PR returns to the reviewer's **Needs your review**.
- [ ] **Step 3: Commit any polish fixes.**

## Self-Review (completed)

**Spec coverage:** "Publish Changes" label + editable description + re-request reviewers (T3, T4) ✓; returns to reviewer queue via re-requested reviewers (T1 POST + T2 classifier) ✓; author badge reflects re-review (T2) ✓; update instead of create when PR exists (T4) ✓.
**Placeholder scan:** none. **Type consistency:** `updatePR` signature matches across github/index/preload/env/SystemOverview; `prStatus.body`/`number`/`title` added consistently; classifier `pending` rule matches tests.
