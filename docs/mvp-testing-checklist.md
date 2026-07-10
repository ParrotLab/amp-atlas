# MVP Manual Testing Checklist

Run this end-to-end pass once all MVP workstreams are built, before cutting the first real signed release. Automated tests (`npm test`) already cover the pure/unit logic — this list is the human/UI/integration behavior that only a real run in `npm run dev` (and, for the last section, the packaged `.dmg`) can confirm.

Check items off as they pass. Note the date/build tested: ____________

Sections are in build order. Each maps to a merged PR + its spec in `docs/superpowers/specs/`.

---

## 1. Content integrity & degraded mode (PR #1)

- [ ] **Frontmatter survives editing** — Open a file with frontmatter (incl. keys *not* shown in the Properties panel), edit the body, save → all frontmatter is intact on disk, including the hidden keys.
- [ ] **Properties panel writes correct YAML** — Edit a playbook's Status/Owner/etc. in the Properties panel → correct YAML is written back to disk.
- [ ] **Minimal git diff** — A normal body edit produces a small, sensible git diff (no wholesale reformatting / no reordering of unrelated lines).
- [ ] **Markdown round-trips** — Edit a file containing tables, task lists, and code blocks; save and reopen → nothing is corrupted or dropped.
- [ ] **Local-only mode (no git)** — Connect a non-git folder → app enters Local-only mode with a clear notice; browsing/editing works; GitHub controls are greyed and explain themselves; nothing crashes.
- [ ] **No `gh`/degraded mode** — With GitHub unavailable, the app still opens, browses, and edits; GitHub-dependent controls are disabled with a legible reason.

## 2. Draft lifecycle & work-loss safety (PR #3)

- [ ] **Switch-with-unsaved always prompts** — With unsaved edits in a draft, switching drafts always shows Save-or-Discard — **never** silently stashes.
- [ ] **Navigating systems is safe** — Moving between systems never prompts and never loses on-disk edits.
- [ ] **New Draft starts fresh** — New Draft always starts from a freshly-pulled Live Version (or local main + a note when offline), never from another draft.
- [ ] **Archive is recoverable** — Archiving a draft keeps it recoverable; Unarchive restores it. Only a *merged* draft is ever deleted.
- [ ] **Only your drafts show** — The draft list shows only drafts you created, opened, or adopted — never the repo's full branch list.
- [ ] **Add existing work** — A branch created outside the app (local, or on GitHub) can be adopted and worked in as a Draft.
- [ ] **Move changes into a draft** — With uncommitted edits on the Live Version, "move changes into a draft" carries the work into a new Draft and leaves the Live Version clean (no lost work).
- [ ] **Plain-language status** — The status line reads in plain language and never shows the word "branch."

## 3. External-edit sync — live view (PR #4)

- [ ] **External edit reflects automatically** — Edit a file **outside the app** (Claude/Obsidian/manual) → the open file, the file tree, and git status all update with no user action.
- [ ] **Tree refresh is non-destructive** — The tree updates without collapsing expanded folders or losing the current selection.
- [ ] **Self-writes are silent** — The app's own autosave never triggers a reload or a nudge.
- [ ] **In-app edit + on-disk change** — Editing in-app while the same file changes on disk shows one neutral "updated" nudge; **Keep editing** never loses what you typed; **Reload** pulls in the disk version.
- [ ] **Deleted open file** — Deleting the currently open file is handled gracefully (tab closes, clear message) — no crash.

## 4. Content creation — files, folders, scaffolds (PR #5)

- [ ] **Scaffold new system types** — On a Draft, "+ New" → New Playbook / Project / Sub-system each open a name modal with a live slug preview and scaffold the correct files from the templates.
- [ ] **Plain file/folder CRUD** — Create a plain file/folder, rename, move (both drag-and-drop **and** "Move to…"), and delete (with confirm) — all inside the allowed (non-top-level) locations.
- [ ] **Copy path** — "Copy path" puts the system-relative path on the clipboard.
- [ ] **Canonical sections + materialize** — The four canonical sections always appear (even in a repo missing them); creating into a missing folder materializes it on disk; no `.gitkeep` files are left behind.
- [ ] **Live Version gating** — On the Live Version, create/move/rename/delete are disabled with a "create a draft" nudge.
- [ ] **Templates are editable** — Editing files in `app/templates/` changes what scaffolds produce.
- [ ] **Real templates scaffold correctly** — Creating a new Playbook / Project / Sub-system produces the real templates (playbook SKILL.md with Purpose/Trigger/Inputs/Workflow/Outputs/Behavior Notes; project pitch.md + braindump.md; sub-system README.md with Mission/Where We Fit/What We Own/Roles/Core Processes). Guidance blockquotes render in the editor and survive a save.
- [ ] **Playbook Properties fields** — Opening a scaffolded playbook's Properties panel shows **name, description, system, sub-system, status**, and Status is a dropdown of the grades (Not Yet Graded / A / B / C / F / Future).

## 5. GitHub OAuth onboarding + REST (PR #6)

- [ ] **First-run device flow** — First run with no token shows the Connect screen; clicking through the device flow (code → approve in browser) signs in and shows "Connected as @you".
- [ ] **Publish without gh** — With no `gh` installed anywhere, publishing works (push + PR).
- [ ] **Inbox + review without gh** — The Inbox lists PRs and a full review round-trip works (diff + approve / request-changes) via the token/REST.
- [ ] **Reviewer picker is real** — The reviewer picker in the publish modal lists real repo collaborators (no hardcoded names).
- [ ] **Sign out / revoked token** — Signing out (or a revoked token) drops to the soft reconnect state; local editing still works; reconnecting restores GitHub actions.

## 6. Collision prevention (PR #8)

- [ ] **Awareness banner appears** — Create two drafts that edit the **same** file. Publish one as a PR. Open that file in the *other* draft → a soft amber banner names the PR's author ("… also has edits to this file in review").
- [ ] **Banner refreshes on window focus** — With the file open, switch away from the app and back → the banner re-fetches (appears/updates without reopening the file).
- [ ] **Banner shows display name** — The banner shows the author's GitHub display name (falls back to their login if they have no name set).
- [ ] **Banner is dismissible & non-blocking** — Dismiss it; editing and publishing still work normally.
- [ ] **Clean update auto-merges** — With two drafts editing *different parts* of the same file, publish the second → it succeeds (the draft is silently brought up to date with the Live Version first, no conflict).
- [ ] **Real overlap escalates calmly** — With two drafts editing the *same lines*, publish the second → the calm ConflictModal appears ("The Live Version changed while you were working… contact your team lead"). **No git jargon shown.**
- [ ] **Draft is safe after a conflict** — After that modal, confirm the draft's contents are exactly as left, and nothing was pushed. Dismiss ("Got it") and keep working; retry publish later succeeds once the upstream overlap is resolved.
- [ ] **Offline degrades gracefully** — With no network, opening a file (banner silently absent) and publishing (proceeds against local base) both still work.

---

## 7. Safety / support surface

- [ ] **Retry on failed publish** — Disconnect the network and publish a draft → a toast offers **Retry** and does not auto-vanish. Reconnect, click Retry → it publishes. The failure is recorded in the log.
- [ ] **Copy logs** — Settings → Diagnostics → **Copy logs** → paste elsewhere to confirm recent log text landed on the clipboard.
- [ ] **Reveal log file** — Settings → Diagnostics → **Reveal log file** → Finder opens the folder containing the log.
- [ ] **Report a problem** — Settings → Diagnostics → **Report a problem** → logs are copied and (until the Airtable URL is set) a toast says "Logs copied — paste them to your team lead." Once the URL is configured, it opens the form.
- [ ] **Re-sync a clean system** — Settings → **Re-sync** on a system with no unpublished work → strong-warning confirm → after confirming, the system matches the Live Version.
- [ ] **Re-sync with unpublished work** — Make an unpublished edit in a system, then **Re-sync** → the three-way modal appears. **Keep editing** and **Publish first** both leave the work intact; **Discard & re-sync** (after the strong-warning confirm) resets the system to the Live Version.

---

## 8. Offline capability state

Toggle connectivity with DevTools → Network → Offline, or turn wifi off.

- [ ] **Offline pill appears** — Go offline → a subtle "You're offline" pill shows in the app shell (persists while offline).
- [ ] **Local work keeps working** — While offline: open files, edit, **Save**, create a file/folder, and create/switch a **draft** all work normally.
- [ ] **GitHub actions grey out** — While offline: **Publish** and **Submit for review** are disabled; clicking shows *"You're offline — keep editing; publishing and review need a connection."*
- [ ] **Review submit blocked** — On a Review page while offline, Approve / Request Changes are disabled with the offline hint.
- [ ] **Inbox offline line** — The Inbox shows *"You're offline — your inbox will refresh when you reconnect."* instead of a spinner.
- [ ] **Reconnect restores everything** — Go back online → the pill vanishes, GitHub actions re-enable, and the Inbox repopulates, all with **no restart**.
- [ ] **Distinct from signed-out** — The offline message ("keep editing…") is different from the signed-out message ("reconnect in Settings").

---

## 9. Packaging, signing & auto-update (PR #7) — release-time

These need a real signed build + distribution, so they run at release time on Kristi's Mac, not in `npm run dev`. Some were already validated during the packaging workstream (sign → notarize → publish succeeded); re-confirm end-to-end before shipping.

- [ ] **Signed, notarized release builds** — `npm run release` produces a signed + notarized `.dmg` (+ `.zip` + `latest-mac.yml`) and publishes a GitHub Release to `ParrotLab/amp-atlas-releases`.
- [ ] **Clean install** — Installing the `.dmg` gives a double-click app with **no Gatekeeper warning** and the correct AMP Atlas icon.
- [ ] **Auto-update** — Cutting a higher version and releasing again causes the installed app to auto-update (prompt to restart), with **no repo access needed by the user**.

---

<!-- Add sections here as each remaining MVP workstream lands (safety/support surface, offline capability state, real templates, etc.) -->
