# Design: AMP UP Content-Integrity & Degraded-Mode Fixes

**Date:** 2026-06-26
**Status:** Approved (pending written-spec review)
**Scope:** Fix the issues found in the repo review. Targets correctness/data-integrity and graceful degradation. Does **not** include packaging, OAuth onboarding, or shareable team config (those are MVP planning).

---

## Background

AMP UP is a functional alpha: an Electron + React 19 + TipTap 3 desktop app that puts an Obsidian-like markdown editor on top of real GitHub repos, hiding git vocabulary behind Draft / Save / Publish / Live Version. A full review surfaced several issues. The two most serious **silently corrupt user content**.

### Root cause shared by the data-loss bugs

The editor does not treat *markdown-on-disk as the source of truth*. It converts markdown → HTML (`markdown-it`), edits HTML in TipTap, converts back to markdown (`turndown`), and writes only the document **body**. Consequences:

1. **Frontmatter is destroyed on edit.** `FileViewer` strips the `---...---` block on load (`FileViewer.tsx:130-133`) and the autosave writes back only the body. Any file with YAML frontmatter loses it the moment it is edited. The Properties panel is read-only and never writes frontmatter back.
2. **Lossy markdown round-trip.** Every edit re-serializes through `markdown-it` → HTML → `turndown`, which reformats markdown and would drop any syntax the HTML pipeline doesn't model (wikilinks, callouts, etc.), producing noisy git diffs.

Every fix below restores the invariant: **the markdown file on disk is the truth; the editor reads and writes markdown directly; nothing outside the edited region is rewritten.**

---

## Hard constraints (from the user)

- **Files must remain plain markdown on the filesystem.** This is what the team teaches and trains on. Non-negotiable.
- **Mostly plain markdown today**, with full editability. **Wikilinks / file-linking matter later** — design must stay compatible, but they are not built now.
- When GitHub isn't available, the app should still **work like Obsidian** (local editing), with GitHub controls gracefully disabled.

---

## In scope

1. Markdown round-trip via TipTap's official markdown extension.
2. Frontmatter preservation + opinionated, schema-driven Properties (editable).
3. `gh` resolution + capability detection + degraded modes (local-only / git-not-connected / full).
4. Failure path for connecting a folder that isn't a git repository.
5. Minimal, consistent error surfacing for high-stakes actions.
6. Unit tests (Vitest) for the pure logic the above introduces.

## Explicitly deferred to MVP planning

`gh`-auth onboarding **walkthrough wizard** • packaging / installer / signing / auto-update • portable & shareable team config • reviewer name→GitHub-username mapping • wikilinks/file-linking implementation.

---

## 1. Markdown round-trip

**Decision: adopt the official `@tiptap/extension-markdown` (TipTap ≥ 3.7; app is on 3.23.1).**

- The editor parses markdown in (`setContent(md, { contentType: 'markdown' })`) and serializes markdown out (`editor.getMarkdown()`) natively — no HTML middleman.
- Remove `markdown-it` and `turndown` and the `utils/markdown.ts` + `utils/htmlToMarkdown.ts` HTML hop.
- Apply the same markdown path in **`Review.tsx`** (Final view) so editor and review share one serialization.
- Custom tokenizers are the future seam for wikilinks — no wikilink code now, but the architecture admits it.

**Fidelity verification (must pass before claiming done):** round-trip tests for the node types currently enabled in StarterKit + extensions — headings, bold/italic/strike, links, bullet/ordered lists, task lists, tables, code blocks, blockquotes, horizontal rules. A node that doesn't round-trip cleanly is a finding to resolve, not ignore.

**Non-markdown files** (e.g. opening a `.ts` file) keep today's behavior: shown as a read-only code block, not run through the markdown serializer.

---

## 2. Frontmatter preservation + schema-driven Properties

### 2a. Preservation (kills the data-loss bug)

- Parse and serialize with **`gray-matter`** (already a dependency, currently unused): `matter(raw)` → `{ data, content }` on load; `matter.stringify(body, data)` on save.
- The editor only ever sees `content` (the body). The full `data` object is held in component state.
- **Single writer.** Both the editor autosave **and** Properties edits funnel through one `composeFile(data, body)` path so they cannot clobber each other. This requires lifting frontmatter ownership to where the file writer lives (a small `useFileDocument`-style ownership change spanning `FileViewer` and `SystemOverview`; `PropertiesPanel` becomes a controlled component that bubbles edits up).
- **Unknown keys are retained.** Frontmatter keys not in the active schema are hidden in the UI but written back untouched. Schema fields absent from the file render as empty.

### 2b. Type detection

1. Explicit `type:` frontmatter field wins (e.g. `type: playbook`).
2. Fallback: a file named `SKILL.md` located under a `.claude/skills/` path ⇒ `playbook`.
3. No recognized type ⇒ no editable schema fields (Properties shows the empty state); file stays plain markdown.

### 2c. Schema registry

A declarative map in a new `frontmatterSchemas.ts`:

```
type → ordered [ { key, label, widget, options? } ]
widget ∈ { text, select, tags }
```

Seed schema:

| type | fields |
|------|--------|
| `playbook` | `name` (text), `description` (text), `process` (text), `status` (select) |

`status` options are a fixed, opinionated set defined in the registry (e.g. Draft / Active / Archived — exact values confirmed during implementation). Adding a new type later is one registry entry; the Properties UI is schema-driven and needs no per-type code.

### 2d. Properties panel behavior

- Renders only the active schema's fields, as editable widgets, in schema order.
- Edits write back through `composeFile` (debounced, same as body autosave).
- Empty state when the file has no recognized type.

---

## 3. `gh` resolution, capability detection & degraded modes

### 3a. Resolver

Replace the hardcoded `/opt/homebrew/bin/gh` (8 call sites in `main/index.ts`) with a resolver that locates `gh` once (PATH + common install locations), caches the result, and exposes whether `gh` is available and authenticated (`gh auth status`). Missing/unauthed returns a **structured** result the renderer can act on, never a silent failure.

### 3b. Capabilities (computed per system, on load + on refresh)

- `isGitRepo` — `simple-git().checkIsRepo()`
- `ghAvailable` — resolver found the binary
- `ghAuthed` — `gh auth status` succeeds

### 3c. Three modes

| Mode | Condition | Works | Disabled (greyed) |
|------|-----------|-------|-------------------|
| **Local-only** | `!isGitRepo` | File tree, open, edit, autosave to disk | All git/GitHub controls. Click → "This folder isn't connected to version control." |
| **Git, not connected to GitHub** | `isGitRepo && !ghAuthed` | Editing + local drafts: Save, New Draft, Switch, Discard | Publish, Inbox, Review. Click → "Connect to GitHub in Settings to publish and review." |
| **Full** | `isGitRepo && ghAuthed` | Everything | — |

- Greyed controls are visibly disabled with a tooltip, and clicking them surfaces the message above and points to **Settings → Connect to GitHub**.
- The link's destination is a **placeholder** Settings entry now. The actual install-and-authenticate **walkthrough wizard** is MVP planning. The degraded UX, detection, and messaging are built now.
- Local-only is the literal "just Obsidian" experience: editing and frontmatter all work without any git.

### 3d. Not-a-git-repo failure path

When a user connects a folder (Settings or the System "Select Folder" empty state), detect `!isGitRepo` and:
- Still connect the folder and allow local editing (Local-only mode), **and**
- Show a clear, non-blocking notice explaining it isn't under version control and that publishing/review need a git repo connected to GitHub.

No crash, no silent partial failure.

---

## 4. Error surfacing

Introduce **one** lightweight, consistent mechanism (a small toast/banner) and wire the high-stakes paths to it: Publish, Save, Switch draft, Review submit, Connect folder. Replaces today's `alert()` / `console.warn` on those paths. Deliberately minimal — not a notification framework.

---

## 5. Testing

Add **Vitest** (no test runner exists today). Cover the pure, high-risk logic this work introduces:

- Frontmatter parse → edit → serialize, including **unknown-key retention** and empty-schema-field handling.
- Markdown round-trip fidelity across the enabled node types (§1).
- Type detection (explicit `type:` and `SKILL.md`-under-`.claude/skills` fallback, and the no-type case).
- `gh` path/capability resolver (available/unavailable/unauthed branches).

These tests are what make "the data-loss bugs are fixed" a verifiable claim rather than an assertion.

---

## Affected files (indicative, not exhaustive)

- `app/src/main/index.ts` — `gh` resolver + capability checks; structured errors.
- `app/src/preload/index.ts` — expose capability + resolver results.
- `app/src/renderer/components/FileViewer.tsx` — markdown-native editor; frontmatter split/compose; single writer.
- `app/src/renderer/components/PropertiesPanel.tsx` — schema-driven, editable, controlled.
- `app/src/renderer/components/StatusBar.tsx` — capability-aware enabled/disabled controls + messages.
- `app/src/renderer/pages/SystemOverview.tsx` — frontmatter state ownership; capability wiring.
- `app/src/renderer/pages/Review.tsx` — shared markdown path.
- `app/src/renderer/pages/Settings.tsx` — connect-folder failure path; "Connect to GitHub" placeholder entry.
- **New:** `app/src/renderer/utils/frontmatterSchemas.ts`, frontmatter compose/parse util, `gh`/capability util, toast component, Vitest config + test files.
- **Removed:** `utils/markdown.ts`, `utils/htmlToMarkdown.ts`, deps `markdown-it`, `turndown`, `@types/turndown`.

---

## Success criteria

1. Editing a file with frontmatter and saving leaves all frontmatter intact, including keys not shown in the Properties UI.
2. Editing a `playbook`'s Status/Owner/etc. in the Properties panel writes correct YAML back to disk.
3. A normal edit produces a minimal, sensible git diff (no wholesale reformatting).
4. With `gh` absent, the app opens, browses, and edits a local folder; GitHub controls are greyed and explain themselves; nothing crashes.
5. Connecting a non-git folder enters Local-only mode with a clear notice.
6. Vitest suite passes and covers the four areas in §5.
