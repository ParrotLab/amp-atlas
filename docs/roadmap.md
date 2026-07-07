# AMP Atlas — Feature Roadmap

> **Naming:** The product is being renamed **AMP UP → AMP Atlas**. This is a *documentation-only* rename for now — the repo, app identifiers, and code stay as-is until a later dedicated rename pass.

**Date:** 2026-07-07
**Companion doc:** [`mvp-planning.md`](./mvp-planning.md) — the decision worksheet this roadmap is derived from.

This roadmap has three horizons: **MVP** (what we ship to the internal leadership team now), **v2** (next, once MVP lands), and **Future** (aspirational / directional). Items are grouped by area; see `mvp-planning.md` for the reasoning behind each decision.

---

## MVP

The goal: replace **Obsidian + GitHub Desktop** for the internal leadership team (4–6 users, macOS) — the value of git (versions, drafts, safe/reversible changes) without the headache, with actions **constrained by design** so failure modes are unlikely.

### Onboarding & auth
- First-run **GitHub connection required** via **OAuth device flow** (single Parrot-Labs OAuth App; public `client_id`, no server, no user-created app).
- Token stored in Electron `safeStorage`.
- **Manually add a system**: pick an already-cloned repo folder → verify GitHub remote + access → reject (with a clear alert) if not connected.
- **Per-user vaults** — each user chooses their own systems (no shared config).

### Editor & content
- Markdown-native editing *(shipped — PR #1)*.
- Opinionated top-level folders: `readmes/`, `reference/`, `work/`, `.claude/` (static; users create folders 2nd-level and deeper only).
- **Obsidian-grade file/folder create + move.**
- **Scaffolds with shipped templates:** New **Playbook** (`.claude/skills/<name>/SKILL.md`), New **Project** (`work/<name>/` with `pitch.md` + `braindump.md`), New **Sub-system** (`reference/<name>/`).
- Schema-driven **playbook** frontmatter with Draft/Active/Archived status *(shipped — PR #1)*, plus an **optional `sub-system` field**.
- **Sub-systems:** an organizing grouping within a system; playbooks can belong to one via the optional `sub-system` field. *Possible:* organize skills by sub-system (grouping mechanics TBD at build time).
- Files outside the structure are not loaded into the viewer.

### Draft / version lifecycle
- Branch **from the Live Version only**; **fresh-pull on create**.
- Save → Submit for review → Update → Publish, with **persistent plain-language status**.
- **Save-or-Discard prompt on switch** (replaces silent auto-stash).
- **Merged drafts auto-retire** with a friendly note; **backup-before-archive** for unpublished drafts (never an unrecoverable delete).

### Review
- Submit + tag reviewer; reviewer list **derived from repo collaborators via the GitHub API**.
- Review others: **approve / request-changes / PR-level comment**; **cannot edit another user's branch**.
- **≥1 non-author approval required** to publish.

### Sync, safety & support
- **File-watch → IDE-like live reflection** of external edits (Claude, Obsidian, `git pull`); prompt on external-change-vs-unsaved-edit.
- **Collision prevention:** soft awareness banner (API), update-before-publish, human-escalation on true conflict (never expose git markers).
- **Offline = capability state:** local edit/save works; GitHub actions grey out.
- **Recovery:** Retry + **Re-sync-from-GitHub** (Settings-only, warned).
- **Diagnostics** panel (`electron-log`; Copy / Reveal logs) for screenshare debugging; **Report-a-problem** → Airtable form.

### Packaging & distribution
- Signed + notarized **macOS** build (Apple Developer account in hand).
- **Auto-update** via a **private releases repo** + read-only embedded token; initial `.dmg` handed to each user.

---

## v2 (next, after MVP lands)

- **Local-only / not-connected first-run mode** (use the app before connecting GitHub).
- **Clone-a-system from a GitHub link** (remove the "clone in GitHub Desktop first" step).
- **New-repo scaffolding** — create a brand-new system/repo with the AMP structure from inside the app.
- **Wikilinks / file-linking** between docs (the editor is already built to accommodate this).
- **Line-level review comments** (MVP is PR-level comments only).
- **Windows** support.
- Richer **conflict resolution** UI (MVP escalates true conflicts to a human) — build only if collisions prove frequent.
- Additional **file types / schemas** beyond playbook as needs emerge.

---

## Future (aspirational / directional)

- **Open-source** the app (revisit auth `client_id` handling and public releases at that point).
- **In-app AI chat / Claude cowork** integrated directly into the UI (MVP keeps Claude work external).
- **Shareable / team config** and org-level onboarding (if the per-user-vault model starts to strain at larger scale).
- **Impact / usage analytics** to show adoption and where users get stuck.
- Broader rollout beyond the leadership team; roles/permissions if needed.
- Deeper GitHub integration (e.g. migrating PR ops fully to the REST API and dropping the `gh` dependency — OAuth is the on-ramp).
- Mobile / read-only companion (directional only).

---

*This roadmap is a living document — horizons shift as MVP feedback comes in. MVP scope is locked; v2 and Future are directional and re-prioritized as we learn.*
