# Design: Draft Lifecycle & Work-Loss Safety

**Date:** 2026-07-07
**Status:** Approved (pending written-spec review)
**Workstream:** MVP #3 (the "trust core") — see [`docs/mvp-planning.md`](../../mvp-planning.md) §7 and the roadmap.
**Branch:** `feat/draft-lifecycle-safety`

## Background

AMP Atlas hides git behind non-technical vocabulary (Draft / Save / Publish / Live Version). The single biggest product problem (Hannah's story, `mvp-planning.md` §1) is that the *mental model* is invisible: users don't grasp that their work lives in a local draft, that they can keep working while it's in review, or how a draft becomes the Live Version. Today's draft handling also has real hazards:

- **Silent auto-stash on draft switch** (`main/index.ts` `git:switchBranch`) — invisible, fragile; a failed stash-pop hides work.
- **Force-delete on archive** (`git:deleteBranch` uses `git branch -D`) — unrecoverable.
- **New Draft branches from the *current* branch** (`git:createDraft`), not a fresh Live Version — a stale-base conflict risk.
- **Every git branch is shown** — a freshly-cloned repo would surface hundreds of unrelated branches, which is confusing.
- **No path for the state a user already has** before adopting the app (existing branches; uncommitted edits sitting on main).

This workstream makes drafts **ephemeral, safe, and legible**, and meets users where they already are.

## Goals / non-goals

**Goals:** the value of git (versions, safe/reversible drafts) without the headache; hard-to-lose-work by construction; a legible lifecycle; onboarding flows for pre-existing state. All git vocabulary stays hidden.

**Non-goals (this workstream):** OAuth/auth, packaging, file-watching/external-edit sync (its own workstream — though it interacts, see below), content-creation templates, collision-prevention banners, conflict resolution UI. Those are separate MVP workstreams.

## Vocabulary (user-facing ↔ internal)

| User sees | Internally |
|---|---|
| Draft | a git branch (registered in the app) |
| Live Version | `main` (or `master`) |
| Save | commit |
| Publish / Submit for review | push + PR |
| Archive a draft | mark `archived` in the registry; keep the local branch |
| Add existing work… | adopt an existing local/remote branch into the registry |
| Move changes into a draft | `git checkout -b` carrying the dirty working tree |

The word "branch" never appears in the UI.

---

## 1. Draft registry (`draftStore`, new)

**Decision:** an app-owned, per-user, per-machine registry in `localStorage` (approach A; git-based/tracked-file rejected because "which drafts I've opened/archived" is inherently personal — consistent with per-user vaults, `mvp-planning.md` §5).

**Shape** — one registry per system, keyed by system id:

```
// localStorage key: "amp-drafts-v1"
type DraftState = 'active' | 'archived'
interface DraftEntry {
  branch: string        // git branch name, e.g. "draft/onboarding-revamp"
  title: string         // humanized display name, e.g. "Onboarding Revamp"
  state: DraftState
  createdAt: string     // ISO
  lastOpenedAt: string  // ISO
}
// stored: Record<systemId, Record<branchName, DraftEntry>>
```

**Rules:**
- **Only registry drafts appear in the app.** Pre-existing repo branches are ignored until explicitly adopted. No more "hundreds of old branches."
- Active drafts show under **"Your Drafts"**; archived drafts under a separate collapsed **"Archived"** section (unarchive to restore).
- The registry stores *metadata only* — the actual work lives in git. The registry decides *visibility and state*, never holds content.

**Module:** `src/renderer/utils/draftStore.ts` — pure functions (`getDrafts(systemId)`, `registerDraft`, `setDraftState`, `touchDraft`, `removeDraft`, `listActive`, `listArchived`), unit-tested.

---

## 2. Lifecycle handlers (git layer changes in `main/index.ts`)

### New Draft — always from a fresh Live Version
Replaces branch-from-current-HEAD. Sequence (after the caller resolves any unsaved edits, §3):
1. `checkout main` (or master).
2. `pull --ff-only` the Live Version — **skipped when offline** (branch from local main, with a note).
3. create the branch, register it `active`.

Enforces "**branch from the Live Version only, never from another draft**" (`mvp-planning.md` §7). New IPC contract: `git:createDraft(repoPath, draftName)` returns `{ ok, branch, pulled: boolean }` (`pulled=false` ⇒ offline/no-remote, surfaced softly).

### Switch draft — no more silent stash
Replaces the auto-stash logic. The **main process no longer stashes**. Instead the *renderer* enforces the rule (§3): if there are unsaved edits, prompt Save-or-Discard **before** calling switch. `git:switchBranch` becomes a plain `checkout` (assumes a clean-enough tree; returns an error the UI shows if checkout is blocked). Registry `touchDraft` on open.

### Archive a draft — keep it, don't delete
Replaces `git branch -D`. **Archiving does not touch git** — it sets the registry entry to `archived` (the local branch stays intact, fully recoverable via **Unarchive**). Works offline (no push, no delete). If the archived draft was **never submitted for review** (no upstream / never pushed), show a soft note: *"This draft only exists on this computer."* New/renamed IPC: none required for archive itself (pure registry op); an **Unarchive** simply flips state back to `active`.

### Merged auto-retire — distinct from archive
Unchanged in spirit (`git:checkMerged` path). When a draft's PR merges: switch to Live Version, **delete** the local branch (its work is safely in the Live Version), `removeDraft` from the registry, and toast: *"This draft was published and archived. You're now on the Live Version."* This is the only place a branch is deleted.

### Discard changes
Keep existing `git:discard` (revert uncommitted). Reword the confirm to plain language: *"Discard all edits since your last save? This can't be undone."*

---

## 3. The Save-or-Discard prompt (renderer)

**Trigger:** only when **switching drafts within a system** (a branch switch) **and** the working tree is dirty (`!isClean`). **Not** triggered by navigating between systems — autosave already persisted those edits to that repo's disk, and they'll be there on return (Hannah's happy path, `mvp-planning.md` §2, confirmed 2026-07-07).

**Behavior:** a modal — *"You have unsaved edits in this draft. Save them before switching, or discard?"* — with **Save** (commit, then switch), **Discard** (revert, then switch), **Cancel**. Replaces the silent stash entirely.

**Applies to any action that leaves a *dirty draft* for somewhere else:** Switch draft, New Draft, and **Add existing work** (all are branch switches). **Exempt: "Move changes into a draft" (Flow 2)** — it starts from a dirty *Live Version* and intentionally *carries* those changes into the new draft, which *is* the resolution, so it must not prompt Save/Discard.

---

## 4. Onboarding flows for pre-existing state

### Flow 1 — "Add existing work…" (adopt an existing branch)
For users who already have branches (a new user who cloned a repo often has only remote ones). In the draft dropdown, an **"Add existing work…"** action lists branches **not** in the registry — **both local and remote (`origin/*`)**. Picking one:
- if remote-only, create a local tracking branch (`checkout -b <name> origin/<name>`);
- otherwise `checkout` it;
- register it `active`; it now appears as a Draft.

New IPC: `git:listAdoptableBranches(repoPath)` → `{ ok, branches: {name, isRemoteOnly}[] }` (excludes main/master; caller filters out already-registered). Adoption reuses `git:switchBranch` + registry `registerDraft`. **"branch" never appears in the label** — it's "existing work."

### Flow 2 — "Move changes into a draft" (edits made on the Live Version outside the app)
When the app detects the user is on the **Live Version with uncommitted edits** (made by Claude/Obsidian/manually), surface a clear action: *"You have unsaved changes on the Live Version — move them into a draft to keep working."* → ask for a draft name → `git checkout -b draft/<slug>` (**the dirty working tree carries over** to the new draft) → register `active` → the Live Version is left clean.

New IPC: `git:createDraftFromChanges(repoPath, draftName)` → `{ ok, branch }` (a `checkout -b` that intentionally does *not* stash/clean, so changes follow). Detection uses the existing 3s git-status poll: `isMain && !isClean` ⇒ show the prompt/affordance.

---

## 5. Legible status (StatusBar)

A persistent, plain-language status wherever a draft is active:

> **Draft: Onboarding Revamp · 2 unsaved edits · saved 5 min ago · In review by Rachel**

Composed from existing signals: draft title (registry), unsaved-edit count (`gitModified/gitNew`), last-saved relative time (last commit time — new lightweight read), and review state (`prStatus`). On the Live Version it reads **"Live Version — read only"**, plus the Flow-2 affordance when dirty. No new backend beyond a "last commit time" read.

---

## 6. Error handling

- All new IPC returns the uniform `{ ok, ... } | { ok:false, error }` shape; the renderer surfaces failures via the existing **toast**.
- Offline: New Draft branches from local main with a soft note; Move-changes and Archive work fully offline; Publish/review remain gated by the capability state (existing degraded-mode work).
- A `checkout` blocked by an unexpectedly dirty tree returns an error the UI shows rather than forcing.

## 7. Testing

- **Pure, unit-tested (Vitest):** `draftStore` (register/setState/touch/remove, active vs archived filtering, per-system isolation), draft-name slugification, and the "which state am I in" derivations (dirty-on-main ⇒ Flow 2; dirty + switch ⇒ prompt).
- **Git handlers:** where practical, tested against a temp git repo (new-draft-from-fresh-main, switch-without-stash, adopt-remote, move-changes-carries-tree, archive-keeps-branch, merged-retire-deletes). Otherwise verified manually against a real system.
- Success is verifiable, not asserted.

## Affected files (indicative)

- **New:** `src/renderer/utils/draftStore.ts` (+ tests); a Save-or-Discard modal component; small UI for "Add existing work…" and "Move changes into a draft".
- **Modify:** `src/main/index.ts` (`git:createDraft` fresh-from-main; `git:switchBranch` no-stash; new `git:createDraftFromChanges`, `git:listAdoptableBranches`; remove force-delete from the archive path, keep it only on merged-retire), `src/preload/index.ts` + `env.d.ts` (new IPC types), `src/renderer/components/StatusBar.tsx` (registry-driven draft lists, archived section, adopt/move affordances, legible status), `src/renderer/pages/SystemOverview.tsx` (registry wiring, prompt orchestration, Flow-2 detection).

## Success criteria

1. Switching drafts with unsaved edits always prompts Save-or-Discard — **never** silently stashes; navigating between systems never prompts and never loses on-disk edits.
2. New Draft always starts from a freshly-pulled Live Version (or local main + note when offline), never from another draft.
3. Archiving a draft keeps it recoverable (Unarchive restores it); only a *merged* draft is ever deleted.
4. The app shows only drafts the user created, opened, or adopted — never the repo's full branch list.
5. A user can **add existing work** (a branch made outside the app, local or on GitHub) and work in it as a Draft.
6. A user with **uncommitted edits on the Live Version** can move them into a Draft with no lost work, leaving the Live Version clean.
7. The status line reads in plain language and never shows the word "branch."
8. Vitest covers `draftStore` and the state derivations; git-handler behaviors verified.
