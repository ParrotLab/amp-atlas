# Offline Capability State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Treat offline as a capability state — local editing/Save keep working, only GitHub actions grey out with a calm message, and a subtle "You're offline" pill shows in the shell.

**Architecture:** A `useOnline()` hook (navigator.onLine + online/offline events) is the single connectivity source of truth. A pure `githubActionsAvailable(caps, online)` helper folds `online` into the existing capability gate. The pill lives in `AppLayout`; the gate + offline-aware messages are wired into SystemOverview, Review, and Inbox.

**Tech Stack:** React 19, Vitest 4. No main-process or network changes.

**Spec:** [`docs/superpowers/specs/2026-07-09-offline-capability-state-design.md`](../specs/2026-07-09-offline-capability-state-design.md)

---

## File Structure

- **`app/src/renderer/hooks/useOnline.ts`** — connectivity hook.
- **`app/src/renderer/utils/capabilities.ts`** — pure `githubActionsAvailable`.
- **`app/src/renderer/utils/__tests__/capabilities.test.ts`** — its tests.
- **`app/src/renderer/layouts/AppLayout.tsx`** + **`AppLayout.css`** — offline pill.
- **`app/src/renderer/pages/SystemOverview.tsx`** — gate + offline-aware message.
- **`app/src/renderer/pages/Review.tsx`** — gate submit offline.
- **`app/src/renderer/pages/Inbox.tsx`** — offline empty-state + skip fetch offline.

All commands run from `app/`. Run one test file with `npx vitest run <path>`.

---

## Task 1: Capability gate helper (pure)

**Files:**
- Create: `app/src/renderer/utils/capabilities.ts`
- Test: `app/src/renderer/utils/__tests__/capabilities.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/src/renderer/utils/__tests__/capabilities.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { githubActionsAvailable } from '../capabilities'

describe('githubActionsAvailable', () => {
  it('true when git repo + connected + online', () => {
    expect(githubActionsAvailable({ isGitRepo: true, connected: true }, true)).toBe(true)
  })
  it('false when offline', () => {
    expect(githubActionsAvailable({ isGitRepo: true, connected: true }, false)).toBe(false)
  })
  it('false when not connected (no token)', () => {
    expect(githubActionsAvailable({ isGitRepo: true, connected: false }, true)).toBe(false)
  })
  it('false when not a git repo', () => {
    expect(githubActionsAvailable({ isGitRepo: false, connected: true }, true)).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/renderer/utils/__tests__/capabilities.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the helper**

Create `app/src/renderer/utils/capabilities.ts`:

```ts
export interface Caps { isGitRepo: boolean; connected: boolean }

/** GitHub actions (publish, review, fetch collaborators) require a git repo, a token, AND a live connection. */
export function githubActionsAvailable(caps: Caps, online: boolean): boolean {
  return caps.isGitRepo && caps.connected && online
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/renderer/utils/__tests__/capabilities.test.ts`
Expected: PASS (4 cases).

- [ ] **Step 5: Commit**

```bash
git add app/src/renderer/utils/capabilities.ts app/src/renderer/utils/__tests__/capabilities.test.ts
git commit -m "feat: githubActionsAvailable — pure capability+online gate"
```

---

## Task 2: `useOnline` hook

**Files:**
- Create: `app/src/renderer/hooks/useOnline.ts`

- [ ] **Step 1: Create the hook**

Create `app/src/renderer/hooks/useOnline.ts`:

```ts
import { useState, useEffect } from 'react'

/** Single source of truth for connectivity. Event-driven; no polling. */
export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no type errors (unused-until-wired is fine — it's exported).

- [ ] **Step 3: Commit**

```bash
git add app/src/renderer/hooks/useOnline.ts
git commit -m "feat: useOnline hook — navigator.onLine + online/offline events"
```

---

## Task 3: Global offline pill in AppLayout

**Files:**
- Modify: `app/src/renderer/layouts/AppLayout.tsx`, `app/src/renderer/layouts/AppLayout.css`

- [ ] **Step 1: Render the pill**

Replace the contents of `app/src/renderer/layouts/AppLayout.tsx` with:

```tsx
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { useOnline } from '../hooks/useOnline'
import './AppLayout.css'

export default function AppLayout() {
  const online = useOnline()
  return (
    <div className="app-layout">
      <div className="titlebar-drag-region" />
      <Sidebar />
      <main className="app-main">
        {!online && (
          <div className="offline-pill" role="status">
            <span className="offline-dot" /> You're offline
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Style the pill**

Append to `app/src/renderer/layouts/AppLayout.css`:

```css
.offline-pill {
  position: fixed; top: 12px; right: 16px; z-index: 900;
  display: inline-flex; align-items: center; gap: 7px;
  background: #fdf3e0; border: 1px solid #f2d9a8; color: #7a5a1e;
  border-radius: 999px; padding: 5px 12px; font-size: 12.5px; font-weight: 500;
  box-shadow: 0 2px 8px rgba(40, 20, 50, 0.08);
}
.offline-dot {
  width: 7px; height: 7px; border-radius: 50%; background: #d9822b; display: inline-block;
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add app/src/renderer/layouts/AppLayout.tsx app/src/renderer/layouts/AppLayout.css
git commit -m "feat: global 'You're offline' pill in the app shell"
```

---

## Task 4: Gate the System view (publish / submit)

**Files:**
- Modify: `app/src/renderer/pages/SystemOverview.tsx`

- [ ] **Step 1: Import the hook and helper**

In `app/src/renderer/pages/SystemOverview.tsx`, add near the other imports:

```tsx
import { useOnline } from '../hooks/useOnline'
import { githubActionsAvailable } from '../utils/capabilities'
```

- [ ] **Step 2: Read connectivity in the component**

Near the other hooks (e.g. right after the `caps` state around line 90), add:

```tsx
  const online = useOnline()
```

- [ ] **Step 3: Fold online into the gate and message**

Replace the existing StatusBar props:

```tsx
          canUseGitHub={caps.isGitRepo && caps.connected}
          onNeedGit={() => showToast("This folder isn't connected to version control.")}
          onNeedGitHub={() => showToast(caps.connected ? 'Connect a GitHub-backed system to publish and review.' : 'Reconnect to GitHub in Settings to publish and review.')}
```

with:

```tsx
          canUseGitHub={githubActionsAvailable(caps, online)}
          onNeedGit={() => showToast("This folder isn't connected to version control.")}
          onNeedGitHub={() =>
            showToast(
              !online
                ? "You're offline — keep editing; publishing and review need a connection."
                : caps.connected
                  ? 'Connect a GitHub-backed system to publish and review.'
                  : 'Reconnect to GitHub in Settings to publish and review.',
            )
          }
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/src/renderer/pages/SystemOverview.tsx
git commit -m "feat: gate publish/submit on connectivity with an offline-aware message"
```

---

## Task 5: Gate the Review submit

**Files:**
- Modify: `app/src/renderer/pages/Review.tsx`

- [ ] **Step 1: Import and read connectivity**

In `app/src/renderer/pages/Review.tsx`, add the import:

```tsx
import { useOnline } from '../hooks/useOnline'
```

Inside the component (with the other hooks/state), add:

```tsx
  const online = useOnline()
```

- [ ] **Step 2: Guard the submit handler**

In `handleSubmitReview`, add an offline early-return at the top:

```tsx
  const handleSubmitReview = async (reviewAction: 'approve' | 'request-changes') => {
    if (!repoPath) return
    if (!online) { alert("You're offline — keep editing; publishing and review need a connection."); return }
    setAction(reviewAction)
    setStatus('submitting')
    const result = await window.api.git.reviewPR(repoPath, prNum, reviewAction, comment)
    if (result.ok) { setStatus('done') } else { alert(`Couldn't submit review: ${result.error}`); setStatus('idle') }
  }
```

- [ ] **Step 3: Disable the submit buttons offline**

Update both submit buttons' `disabled` and `title` to include the offline state:

```tsx
                  <button
                    className={`review-action-btn request-changes ${intent === 'request-changes' ? 'primary' : ''}`}
                    onClick={() => handleSubmitReview('request-changes')}
                    disabled={!hasComment || status === 'submitting' || !online}
                    title={!online ? "You're offline — reconnect to submit" : !hasComment ? 'Add a note above describing what should change' : ''}
                  >
                    {status === 'submitting' && action === 'request-changes' ? 'Submitting...' : 'Request Changes'}
                  </button>
                  <button
                    className={`review-action-btn approve ${intent !== 'approve' ? 'ghost' : ''}`}
                    onClick={() => handleSubmitReview('approve')}
                    disabled={!allReviewed || status === 'submitting' || hasComment || !online}
                    title={!online ? "You're offline — reconnect to submit" : !allReviewed ? 'Mark all files as reviewed first' : hasComment ? 'Clear the comment to approve, or click Request Changes' : ''}
                  >
                    {status === 'submitting' && action === 'approve'
                      ? 'Approving...'
                      : allReviewed
                        ? '✓ Approve'
                        : `Approve (${reviewedFiles.size}/${files.length})`}
                  </button>
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/src/renderer/pages/Review.tsx
git commit -m "feat: disable review submit when offline with a clear message"
```

---

## Task 6: Inbox offline state

**Files:**
- Modify: `app/src/renderer/pages/Inbox.tsx`

- [ ] **Step 1: Import and read connectivity**

In `app/src/renderer/pages/Inbox.tsx`, add:

```tsx
import { useOnline } from '../hooks/useOnline'
```

Inside the component (with the other state), add:

```tsx
  const online = useOnline()
```

- [ ] **Step 2: Skip the fetch while offline**

In the `useEffect` that loads PRs, guard the fetch so it doesn't spin on a doomed request and re-runs when connectivity returns. Add `online` to the dependency array and an early bail:

```tsx
  useEffect(() => {
    if (!online) { setLoading(false); return }   // don't fetch offline; re-runs when back online
    // ...existing fetch body unchanged...
  }, [online /*, ...existing deps */])
```

Keep the existing dependencies in the array; just add `online` alongside them.

- [ ] **Step 3: Show the offline line in render**

Replace the existing loading/empty render lines:

```tsx
          {loading && <div className="inbox-empty">Loading...</div>}
          {!loading && filteredPRs.length === 0 && <div className="inbox-empty">No open reviews right now.</div>}
```

with:

```tsx
          {!online && <div className="inbox-empty">You're offline — your inbox will refresh when you reconnect.</div>}
          {online && loading && <div className="inbox-empty">Loading...</div>}
          {online && !loading && filteredPRs.length === 0 && <div className="inbox-empty">No open reviews right now.</div>}
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/src/renderer/pages/Inbox.tsx
git commit -m "feat: Inbox shows an offline state and skips fetching while offline"
```

---

## Task 7: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: all suites PASS, including the new `capabilities` cases.

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 3: Manual smoke (Kristi, in dev)**

Run: `npm run dev`, then (DevTools → Network → Offline, or turn off wifi):
- Go offline → the "You're offline" pill appears; **Publish** and **Submit for review** grey out and show the offline message; editing + **Save** still work; creating a new draft still works; Inbox shows the offline line.
- Go back online → the pill disappears and GitHub actions re-enable with no restart; Inbox repopulates.
- Confirm the offline copy ("keep editing…") differs from the signed-out copy ("reconnect in Settings").

- [ ] **Step 4: Add manual cases to the MVP testing checklist**

Add a "Offline capability state" section to `docs/mvp-testing-checklist.md` with the cases from Step 3. Commit it.

- [ ] **Step 5: Finish the branch**

Use the **superpowers:finishing-a-development-branch** skill to run tests, then push and open a PR.

---

## Self-Review Notes

- **Spec coverage:** §1 detection → Task 2. §2 gate helper → Task 1. §3 pill → Task 3. §4 gating (System/Review/Inbox) → Tasks 4/5/6. Testing → Tasks 1, 7.
- **Type consistency:** `githubActionsAvailable(caps, online)` and the `Caps` shape (`{ isGitRepo, connected }`) match the existing `caps` state in SystemOverview. `useOnline()` returns a boolean consumed identically in AppLayout, SystemOverview, Review, Inbox.
- **No RTL:** hook/pill/gating verified by build + manual smoke; the pure `githubActionsAvailable` carries the automated coverage.
- **No placeholders:** every step has complete code. Task 6 Step 2 preserves the existing effect body/deps and only adds `online`.
