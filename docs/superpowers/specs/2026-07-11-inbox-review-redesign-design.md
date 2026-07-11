# Inbox + Review Experience Redesign — Design Spec

**Date:** 2026-07-11
**Branch:** `feat/ui-improvements`
**Status:** Approved in brainstorming; ready for implementation plan

## Problem

The Inbox is a flat, cross-system list of open PRs with vague filters (All / To
Review / My Drafts) and no clear primary action — you can't tell what you're
supposed to *do*. The review/approval flow behind it is also undefined: it's
unclear what "approved" means, who publishes, and how an author revises a draft
that's already in review. The visuals predate the new design language.

## Goals

- **A clear action queue.** The Inbox tells you exactly what to do next, and each
  item has one obvious action.
- **A defined, opinionated review model** in plain language (no git jargon),
  simple enough for non-technical users, that matches how the team actually works.
- **A role-aware review page** — one screen that adapts to whether you're the
  reviewer or the author.
- **Warm, on-brand visuals** consistent with the redesigned dashboard (soft cards,
  tinted system chips, real `Badge` variants, cream surfaces).

## The review/approval model (the spine)

> **Draft → Request review (1+ people) → Approve / Request changes → Publish.**

- **Approve = sign-off**, not merge. It means "this is ready." A separate,
  deliberate **Publish** (merge + delete branch) is done by the author (or anyone
  with the button). Approve and Publish are distinct steps.
- **"Ready" = at least one approval and no outstanding "changes requested."**
- **Don't build a permission engine.** The app provides clean happy-path actions;
  hard rules (require an outside approval, block self-merge, dismiss stale
  approvals) are deferred to **GitHub branch protection**. If a protected action
  is blocked, surface a friendly message rather than reimplementing the rule.
- **Request review from one person by default; allow more.** Don't require all to
  approve; don't hard-block self-review in-app.
- **PRs merged/closed outside the app** simply drop off the Inbox (only open PRs
  are shown). A "Published / Done" history view is **v2**.
- **GitHub link is a quiet escape hatch** — "View on GitHub" lives in a ⋯ overflow
  menu on rows and on the review page, for technical users only.

## Inbox design

A **tabbed action queue**. Three mutually-exclusive tabs, each a count and a
single action:

| Tab | Contains | Row action |
| --- | --- | --- |
| **Needs your review** | Open PRs where review is requested from you (and not authored by you) | **Review** |
| **Ready to publish** | Your PRs that are approved | **Publish** (green) |
| **Your drafts** | Your PRs that are in review or have changes requested | **Make Edits** (changes requested) / **View** (in review) |

- **Default tab:** Needs your review (matches the sidebar Inbox count).
- **"Ready to publish" tab** uses a green active state to tie it to Publish; its
  count draws the eye when non-zero (this replaces the earlier green-dot idea).
- **Row anatomy:** system-tinted chip + system icon · title · plain-language meta
  (author · system · N files · time) · status Badge (where relevant) · primary
  action button · **⋯ overflow on the far right of every row**.
- **Overflow (⋯) menu:** always "View on GitHub"; for in-review drafts also
  "Make edits".
- **Status Badges** (real `Badge` component): `Approved` (success), `Changes
  requested` (warning), `In review` (neutral).
- **Row actions by state:**
  - Needs your review → `Review` + ⋯
  - Ready to publish → `Approved` badge · green `Publish` + ⋯
  - Changes requested → `Make Edits` (violet primary) + ⋯
  - In review → `View` (ghost, read-only) + ⋯ (with "Make edits")
- **Empty states** per tab (plain language): e.g. Needs your review → "You're all
  caught up — no reviews waiting on you."; Ready to publish → "Nothing to publish
  right now."; Your drafts → "No drafts in progress."
- **Offline** keeps the existing behavior: don't fetch; show "You're offline — your
  inbox will refresh when you reconnect."
- **Sidebar** Inbox nav keeps its count badge = "needs your review" count.
- Old All / To Review / My Drafts filters are **removed** (tabs replace them).

## Review page (role-aware)

One page (`/review/:systemId/:number`) that both **Review** and **View** open;
controls adapt to the viewer's relationship to the PR.

**Shared structure (top to bottom):**
- Back link → Inbox.
- **Header card:** system-tinted chip + icon, title, meta (author · system · N
  files · time), a status Badge, and ⋯ (View on GitHub).
- **Optional Description** section: shows the PR body if present; **hidden
  entirely when empty**. (Capturing a body at publish time is a *separate
  follow-up spec* — until that ships, this is always hidden.)
- **Files changed** — an accordion; one file expanded at a time. Each expanded
  file has a plain-language toggle: **"Updated version"** (rendered final doc via
  the existing TipTap read-only render) / **"What changed"** (the diff).

**Reviewer mode** (someone else's PR, review requested from you):
- Each file row has a **"Mark reviewed"** toggle (kept as a gentle sign-off nudge).
- **Sticky action bar** (always in reach): optional note textarea + **Request
  changes** and **Approve** buttons.
- **Explicit intent** (replaces today's implicit "a comment means request
  changes"): Approve is available with an *optional* note; **Request changes
  requires a note**. Approve shows progress `(N/total)` until all files are marked
  reviewed.
- On submit → existing `reviewPR(repoPath, prNum, action, note)`; success state
  returns to Inbox.

**Author mode** (your own PR — read-only):
- **No** "Mark reviewed", **no** approve/request-changes controls. Files show a
  small "Read-only" marker; toggles still work for reading.
- **Reviewer feedback callout** near the top when changes were requested — shows
  the reviewer's name + note so the author knows what to fix.
- **Sticky action bar adapts to state:**
  - Changes requested → **Make edits** (violet) + note "then it goes back to
    {reviewer} for another look."
  - Approved → **Make edits** + green **Publish**.
  - In review → **Make edits** (waiting on the reviewer).
- **Make edits** switches to that draft's branch and opens it in the editor (reuses
  the existing draft-editing flow); adding edits updates the PR.

## Actions & the data/capabilities they need

Most of the review page reuses existing IPC (`prDiff`, `prFileDiff`,
`prFileContent`, `reviewPR`, `switchBranch`). The genuinely *new* pieces — scope
these explicitly in the plan:

1. **Role + tab classification.** `listPRs` must also return **`requested_reviewers`**
   (logins) and the PR **`body`**. With the current user's login (`useProfile().login`):
   - authored by me + approved → *Ready to publish*
   - authored by me + (in review | changes requested) → *Your drafts*
   - review requested from me + not mine → *Needs your review*
   - anything else (open PRs I'm not involved in) → not shown.
   `requested_reviewers` is already available from the GitHub list endpoint
   (`reviewRequestCount` uses it); add it to the `listPRs` mapping.
2. **Publish = merge PR + delete branch.** New capability: a main-process
   "merge PR by number, then delete the head branch" (GitHub `PUT /pulls/{n}/merge`
   + branch delete), exposed via preload as e.g. `git.mergePR(repoPath, number)`.
   Today's `git.publish` only *pushes* the branch — it does **not** merge. On a
   protected-branch rejection, return a friendly error the UI can show.
3. **Reviewer feedback for author mode.** Fetch the latest review's state + body
   (GitHub `GET /pulls/{n}/reviews`) so the author sees *what* was requested. New
   github helper + IPC (e.g. `git.latestReview(repoPath, number)`).
4. **"View on GitHub"** uses the PR `url` already returned by `listPRs`
   (open via the existing external-link mechanism).

Status/label mapping stays plain-language and reuses `reviewVariant`/`reviewLabel`
where possible: `In review` (neutral), `Changes requested` (warning), `Approved`
(success).

## Design-system & accessibility alignment

- Reuse the dashboard's visual language: `softTint(primaryColor(gradient))` chips,
  the real `Badge` component, tokens from `styles/tokens.css`, no emoji (SVG icons
  from `SystemIcons.tsx`).
- Compositor-only hover transitions (~120–150ms); honor `prefers-reduced-motion`,
  `prefers-contrast`.
- Sticky action bar must stay reachable without trapping focus; buttons have clear
  disabled/enabled reasons (titles) as today.
- Plain language throughout: Review, Approve, Request changes, Make edits, Publish,
  Updated version, What changed — never "PR", "merge", "branch" in user-facing copy.

## Files touched (and WIP isolation)

Parallel structural work continues on this branch. Confirm none of the target
files are mid-edit before touching them; do **not** edit the current WIP set.

**Edit / create (verify clean at implementation time):**
- `app/src/renderer/pages/Inbox.tsx` + `Inbox.css` — tabbed action queue.
- `app/src/renderer/pages/Review.tsx` + `Review.css` — role-aware review page.
- New small components as the plan sees fit (e.g. `InboxRow`, `InboxTabs`,
  a review action bar) to keep files focused.
- `app/src/main/github.ts` + `app/src/main/index.ts` + `app/src/preload/index.ts`
  — add `requested_reviewers`/`body` to `listPRs`, plus `mergePR` and
  `latestReview` handlers/bridges.
- `app/src/renderer/env.d.ts` — types for the new `window.api.git` methods.

**Read-only dependency:** `SystemIcons.tsx` (import icons only).

## Testing

- Unit (Vitest): pure classifier that maps a PR + current login →
  `{ tab, action }` (the core taxonomy); label/variant mapping.
- Manual/visual: all three tabs with items in every state; reviewer flow
  (mark reviewed → approve; request changes with note); author flow (changes
  requested feedback → make edits; approved → publish); empty + offline states.

## Non-goals / follow-ups

- **Capturing a PR body/description at publish time** — a separate follow-up spec
  (the review page only *displays* a body here, hidden when absent).
- **"Published / Done" history view** — v2.
- **Deep two-pane code-review UI** — the accordion + Updated/Changes toggle stays.
- **Building our own review-requirement/permission enforcement** — deferred to
  GitHub branch protection.

## Open questions

- Exact "merge method" for Publish (merge commit vs squash) — pick a sensible
  default during planning; likely squash + delete branch for a clean history.
- Whether "Make edits" should warn when a PR is already approved (edits may
  dismiss the approval under branch protection) — small confirmation copy, decide
  in the plan.
