# Design: Content Creation (files, folders, scaffolds)

**Date:** 2026-07-08
**Status:** Approved (pending written-spec review)
**Workstream:** MVP #5 — see [`docs/mvp-planning.md`](../../mvp-planning.md) §2 & §6 and the roadmap.
**Branch:** `feat/content-creation`

## Background

Users must be able to do **real work** in AMP Atlas, not only review Claude's output (`mvp-planning.md` §1–§2). Today the app only *opens* existing files — there's no create, move, rename, or delete, and no templates. This workstream adds Obsidian-grade file/folder operations plus opinionated **scaffolds** (New Playbook / New Project / New Sub-system) whose starter templates live as **editable files in the repo**.

## Goals / non-goals

**Goals:** create files & folders, move (drag-and-drop + a "Move to…" picker), rename, delete (with confirm), and one-click scaffolds from editable templates. Keep the structure **opinionated and constrained** so users don't make organizational decisions.

**Non-goals (this workstream):** wikilinks, content search improvements, multi-select operations, undo beyond git's Discard, OAuth, packaging.

## Constraints & decisions

- **Editing is gated to a Draft.** Create/move/rename/delete change files; the Live Version is read-only. These actions are available **only when on a Draft**; on the Live Version they're disabled with a gentle "create a draft to make changes" nudge (reuses the existing capability/gating pattern).
- **Top-level folders are static & canonical:** `readmes/`, `reference/`, `work/`, `.claude/`. Users cannot create/move/delete them; new folders only go **inside** existing folders (2nd level and deeper).
- Names are **slugified and validated** (lowercase, dashes, no collisions, no illegal characters).

---

## 1. Templates (editable, in the repo)

**Location:** `app/templates/` — plain markdown files you edit directly:
- `templates/playbook/SKILL.md`
- `templates/project/pitch.md`, `templates/project/braindump.md`
- `templates/sub-system/README.md`

**Bundling:** a one-file manifest `src/renderer/utils/templates.ts` imports each via Vite `?raw` and maps it to a scaffold type. (Chosen over copying into packaged resources or inlining strings: keeps them as real editable files *and* bundles reliably.)

**Tokens:** templates support `{{name}}` (the name the user typed) and `{{date}}` (ISO date). Substitution is a plain string replace. Seeded with sensible defaults for Kristi to replace with the real templates.

## 2. Scaffold engine (pure, tested)

`src/renderer/utils/scaffold.ts`:

```
type ScaffoldType = 'playbook' | 'project' | 'sub-system'
interface ScaffoldFile { path: string; content: string }   // path is system-relative
function slugify(name: string): string                       // "My Q3 Plan" -> "my-q3-plan"
function scaffoldFor(type: ScaffoldType, name: string, date: string): { folder: string; files: ScaffoldFile[] }
```

Opinionated placement baked in:
- **playbook** → `.claude/skills/<slug>/SKILL.md`
- **project** → `work/<slug>/pitch.md` + `work/<slug>/braindump.md`
- **sub-system** → `reference/<slug>/README.md`

`scaffoldFor` renders each template (token substitution) and returns system-relative paths; the caller prefixes the system root and writes.

## 3. Filesystem operations (main + preload)

New IPC in `src/main/index.ts` (uniform `{ ok, ... }` shape):
- `fs:mkdir(path)` — recursive (`mkdir -p`).
- `fs:createFile(path, content)` — **errors if the path already exists** (never clobbers); creates parent dirs first.
- `fs:move(from, to)` — `rename`; covers move *and* rename. Errors if `to` exists.
- `fs:delete(path)` — recursive remove (files and folders).

Exposed on `window.api.fs` with matching `env.d.ts` types. Tested against temp dirs.

## 4. Create / name modal

A single reusable **`NewItemModal`**: a name field with a **live slug + target-path preview** beneath it (type "My Q3 Plan" → *"will create `work/my-q3-plan/`"*), and Create/Cancel. Used by the scaffolds (target folder is fixed by type) and by context-menu New file/New folder (target folder is the clicked folder). Validates non-empty and no collision before enabling Create.

## 5. Tree UI

- **"+ New" menu** in the file-tree header (well-designed, prominent): **New Playbook**, **New Project**, **New Sub-system** — the three scaffolds, each with a fixed location. Each opens the `NewItemModal` (§4). Generic New file/folder is *not* here (it needs a target); it lives in the context menu.
- **Right-click context menu** on a tree item: **New file here**, **New folder here** (target = the clicked folder, or its parent for a file), **Rename**, **Move to…**, **Copy path**, **Delete**.
  - *Move to…* → a folder picker (list of valid destination folders).
  - *Copy path* → copies the **system-relative** path (e.g. `work/onboarding/pitch.md`), Obsidian-style, to the clipboard.
  - *Delete* → confirm dialog first.
- **Drag-and-drop:** drag a file/folder onto a folder to move it (respects placement rules; can't move a top-level canonical folder).

## 6. Canonical sections always visible; lazy folder creation

The tree **always renders the four canonical top-level sections** — Playbooks (`.claude/skills`), Readmes (`readmes/`), Reference (`reference/`), Work (`work/`) — **even if the folder doesn't exist on disk yet**. A missing/empty section shows a quiet empty state ("Nothing here yet").

Folders are **materialized lazily**: creating the first file into a missing canonical (or nested) folder runs `mkdir -p` as part of the create. This avoids empty-folder `.gitkeep` hacks (git can't track empty dirs) and gives a consistent, opinionated tree regardless of the repo's current state. Instructions (root `README.md`/`CLAUDE.md`) continue to show as today.

## 7. Placement & validation rules (constrain by design)

- Top-level canonical folders cannot be created, moved, renamed, or deleted.
- New Folder only inside an existing folder (2nd level+).
- Move/drag rejects moving *into* a file or making a folder its own descendant, and rejects moving a top-level canonical folder.
- Names slugify to `[a-z0-9-]`; empty or colliding names are blocked in the modal with a clear message.
- All ops are no-ops (disabled) on the Live Version.

## 8. Error handling

- Every op returns `{ ok, error? }`; failures surface via the existing toast.
- Collisions (`createFile`/`move` target exists) return a friendly "already exists" message; the UI ideally prevents them earlier via the modal's collision check.
- The file watcher (existing) reflects the new/moved/deleted files automatically — no manual tree poking needed beyond the local optimistic refresh.

## 9. Testing

- **Pure/unit (Vitest):** `slugify` (spaces/punctuation/case, leading-trailing), `scaffoldFor` (correct paths + token substitution for all three types), and the placement/validation predicates (is-top-level, is-valid-destination).
- **Integration (temp dirs):** `fs:mkdir`/`createFile` (creates parents; errors on existing), `fs:move` (rename + move; errors if target exists), `fs:delete` (file and recursive folder).
- **Manual:** the modals, context menu, drag-and-drop, Copy path, empty-section states, and draft-gating verified against a real system.

## Affected files (indicative)

- **New:** `app/templates/**` (editable md); `src/renderer/utils/templates.ts` (manifest); `src/renderer/utils/scaffold.ts` (+ tests); `src/renderer/components/NewItemModal.tsx` (+ css); `src/renderer/components/TreeContextMenu.tsx` (+ css); `src/main/__tests__/fsops.test.ts`.
- **Modify:** `src/main/index.ts` (`fs:mkdir`/`createFile`/`move`/`delete`), `src/preload/index.ts` + `src/renderer/env.d.ts` (new fs methods), `src/renderer/components/FileTree.tsx` (canonical sections always visible, empty states, context menu, drag-and-drop, "+ New" header), `src/renderer/pages/SystemOverview.tsx` (wire create/move/delete handlers, draft-gating, modal state).

## Success criteria

1. On a Draft, a user can create a **New Playbook / Project / Sub-system** from the "+ New" menu; each opens a name modal with a live slug preview and scaffolds the correct files from the editable templates.
2. A user can create a plain file/folder, rename, move (both drag-and-drop and "Move to…"), and delete (with confirm) — all inside the allowed (non-top-level) locations.
3. **Copy path** puts the system-relative path on the clipboard.
4. The four canonical sections always appear (even in a repo missing them); creating into a missing folder materializes it on disk; no `.gitkeep` files.
5. On the Live Version, create/move/rename/delete are disabled with a "create a draft" nudge.
6. Templates live in `app/templates/` and editing them changes what scaffolds produce.
7. Vitest covers `slugify`, `scaffoldFor`, the placement predicates, and the fs ops.
