# Design: Offline Capability State

**Date:** 2026-07-09
**Status:** Approved (pending written-spec review)
**Workstream:** MVP #9 — see [`docs/mvp-planning.md`](../../mvp-planning.md) §6 ("Offline — treat as a capability state, not a lockdown") and the roadmap.
**Branch:** `feat/offline-capability`

## Background

The app already models per-system capability as `caps = { isGitRepo, connected }`, and greys GitHub controls when either is false. But `connected` only means "a token is present" — it stays true when the network is down, so today an offline user can click **Publish** and hit a confusing failure.

Offline should be a **capability state, not a lockdown** (`mvp-planning.md` §6): local editing and Save keep working (disk + local git); only the GitHub-requiring actions grey out, with a calm explanation. This adds a third, global signal — `online` — layered on top of the existing gate, plus a discoverable indicator so disabled buttons never read as a bug.

This is the last scoped MVP feature. It reuses the degraded-mode pattern already built; no new git or network machinery.

## Decisions (all confirmed)

- **Detection:** the browser's `navigator.onLine` plus the window `online`/`offline` events — instant, event-driven, no polling. It detects a dropped network interface. The "connected to wifi but GitHub unreachable" case isn't caught by this signal, but a failed action still surfaces the **Retry** toast from the safety/support workstream, so that case degrades fine.
- **Indicator:** a subtle persistent **"You're offline"** pill in the app shell whenever offline, plus GitHub buttons greyed with the offline message. Discoverable, not surprising.
- **Message (locked copy):** *"You're offline — keep editing; publishing and review need a connection."*
- **Distinct from signed-out:** offline says "keep editing, it'll come back"; signed-out/revoked still says "reconnect in Settings." Offline never tells the user to reconnect a token that's already valid.
- **What stays live offline:** open, edit, Save, create/rename/move/delete, new draft, switch draft — everything local. Only GitHub actions gate.

---

## 1. Detection — `useOnline` hook

**New file `app/src/renderer/hooks/useOnline.ts`:**

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

## 2. The capability gate — pure helper

**New file `app/src/renderer/utils/capabilities.ts`** so the gate is one testable expression, not duplicated inline:

```ts
export interface Caps { isGitRepo: boolean; connected: boolean }

/** GitHub actions (publish, review, fetch collaborators) require a git repo, a token, AND a live connection. */
export function githubActionsAvailable(caps: Caps, online: boolean): boolean {
  return caps.isGitRepo && caps.connected && online
}
```

## 3. Global offline pill — `AppLayout`

**Modify `app/src/renderer/layouts/AppLayout.tsx`:** call `useOnline()` and render a pill when offline, above the `<Outlet />` (in the shell so it shows on every page):

```tsx
const online = useOnline()
// ...
<main className="app-main">
  {!online && (
    <div className="offline-pill" role="status">
      <span className="offline-dot" /> You're offline
    </div>
  )}
  <Outlet />
</main>
```

Styling (`AppLayout.css`): a small, muted amber pill, unobtrusive but always visible while offline; the `offline-dot` is a filled circle. It vanishes automatically when `online` flips back.

## 4. Gating GitHub actions

**System view (`SystemOverview.tsx` + `StatusBar`):** the StatusBar already greys **Publish** / **Submit for review** via `canUseGitHub`. Fold `online` in and make the message offline-aware:

```tsx
const online = useOnline()
// ...
canUseGitHub={githubActionsAvailable(caps, online)}
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

Local controls (Save/Discard/New draft/switch) are untouched — they already gate only on `canUseGit`/`isGitRepo`, never on `online`.

**Review page (`Review.tsx`):** disable the Approve / Request-changes submit when offline, with the offline message. The user can still read a PR already loaded; they just can't submit until reconnected. Add `const online = useOnline()` and guard `handleSubmitReview` (early return + toast) plus a disabled visual on the submit control.

**Inbox (`Inbox.tsx`):** when offline, show a calm line instead of a spinner or error, since the PR list can't load:

```tsx
const online = useOnline()
// in render, before the loading/empty branches:
{!online && <div className="inbox-empty">You're offline — your inbox will refresh when you reconnect.</div>}
{online && loading && <div className="inbox-empty">Loading...</div>}
{online && !loading && filteredPRs.length === 0 && <div className="inbox-empty">No open reviews right now.</div>}
```

The fetch effect should also skip (or no-op) while offline so it doesn't spin on a doomed request; when `online` flips true it re-runs and populates.

**PublishModal:** already opens only from the gated StatusBar button, so it's covered. Its reviewer-collaborators fetch failing offline degrades quietly to an empty list and never blocks — no change needed beyond what already exists.

## Error handling summary

| Situation | Behavior |
|---|---|
| Network drops mid-session | `online` flips false via the `offline` event → pill appears, GitHub buttons grey, no restart needed |
| User clicks a greyed GitHub action | offline message toast (the locked copy) |
| Network returns | `online` flips true → pill vanishes, GitHub actions re-enable, Inbox refetches |
| Online but GitHub unreachable (captive portal, GitHub down) | `navigator.onLine` is true, so the action is attempted; on failure the existing **Retry** toast handles it |

## Testing

**Automated (runnable here):**
- `githubActionsAvailable` (pure): true only when `isGitRepo && connected && online`; false if any one is missing (four+ cases). This is the core gating logic, DOM-free.

**Manual (Kristi, in dev):**
- Toggle the network off → the offline pill appears; **Publish** and **Submit for review** grey out and show the offline message; editing and **Save** still work; a new draft still creates; Inbox shows the offline line.
- Toggle the network back on → the pill vanishes and GitHub actions re-enable with no restart; Inbox repopulates.
- Confirm offline copy ("keep editing…") is distinct from the signed-out copy ("reconnect in Settings").

*(No React Testing Library in the project, so the hook/UI is verified manually; the pure gate is unit-tested.)*

## Affected files (indicative)

- **New:** `app/src/renderer/hooks/useOnline.ts`, `app/src/renderer/utils/capabilities.ts`, `app/src/renderer/utils/__tests__/capabilities.test.ts`.
- **Modify:** `app/src/renderer/layouts/AppLayout.tsx` (+ `AppLayout.css`) — offline pill; `app/src/renderer/pages/SystemOverview.tsx` — `useOnline` + `githubActionsAvailable` gate + offline-aware message; `app/src/renderer/pages/Review.tsx` — gate submit offline; `app/src/renderer/pages/Inbox.tsx` (+ css if needed) — offline empty-state + skip fetch offline.

## Success criteria

1. When offline, local editing, Save, and draft/file operations keep working exactly as online.
2. When offline, all GitHub actions (publish, submit review) are visibly disabled and explain themselves with the offline message — never a raw failure.
3. A persistent, subtle "You're offline" pill shows in the shell while offline and disappears when connectivity returns, with no restart.
4. Offline messaging is distinct from signed-out messaging.
5. `githubActionsAvailable` is unit-tested; tests/build stay green and the app runs in dev.
