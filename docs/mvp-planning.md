# AMP Atlas — MVP Planning Worksheet

> **Naming:** The product is being renamed **AMP Atlas → AMP Atlas**. This is a *documentation-only* rename for now — the repo, app identifiers, and code are unchanged until a later dedicated pass.

**Date:** 2026-07-03 (answers captured through 2026-07-07)
**Status:** Worked through — decisions locked; see the derived MVP scope + build sequence at the bottom
**Purpose:** Surface the real decisions that define "MVP for our users." This is a *thinking* document, not a spec. Each section gives context, the questions you need to answer, options with trade-offs, and my recommendation where I have one. Answer inline (or in a call) and we'll turn the resolved decisions into specs → plans → implementation, one area at a time.

**How to read this:** Sections are ordered roughly by how much they gate everything else. §1–§3 (users, core loop, distribution) should be answered first — they change the shape of §4–§9. Anything marked 🔴 is a hard blocker for shipping to non-technical users; 🟡 is important but can be a fast-follow.

---

## 1. Users & scope — who is the MVP actually for?

**Why it matters:** "Internal team" can mean 4 people who tolerate rough edges or 40 people who churn the first time something confuses them. Every downstream decision (how much hand-holding onboarding needs, how bulletproof error handling must be) keys off this.

**Questions to answer:**
- Who are the **first 3–5 real users** by name/role? What's their actual technical comfort (never used git? used GitHub web UI? command line — never)?
- How many total users at MVP, and what's the growth expectation over the following quarter?
- What do these people do **today** instead — where do the playbooks/docs live right now (Obsidian? Notion? Google Docs? raw GitHub)? What's painful about that?
- Is there a **pilot group** who'll tolerate rough edges, distinct from the broader rollout?
- What's the **one job** a user must be able to finish in the MVP for it to be "worth it" to them? (e.g. "edit a playbook and get it reviewed & published without touching git")

**My take:** Name the pilot group explicitly and design the MVP for *them* — 3–5 people you can sit with. Everything gets easier when "the user" is concrete.

**Answers (2026-07-06):**
- **First users (4):**
  - *Rachel Woods* (CEO) — very technical, heavy git user.
  - *Kristin Downs* (me) — technical.
  - *Rose* — very non-technical; just now grasping what a "repo" is; introduced to GitHub via the **Desktop app**; no concept of git itself.
  - *Hannah* — slightly more; understands file listings in GitHub app/web; loosely grasps "pulling" the live version; no concept of git.
- **MVP size:** internal only, **4–6 users** = leadership team + helping roles beneath (AI Training Guides, Course Coordinator) who are more **viewers** than doers. Goal: ship to internal team as a **replacement for Obsidian + the GitHub Desktop app** (which non-technical folks avoid because it's "scary").
- **Today / the pain:** Everything lives in GitHub. Rachel & Kristi use it constantly to collaborate. Rose & Hannah feel they can't "work within the system" — it feels complicated and they're afraid of breaking something. **Defining story:** Hannah made her first PR and then didn't know how to keep working, because she didn't understand that (a) a PR is a request for review, (b) her work still lives on her computer, and (c) she can *either* keep editing it *or* wait for it to merge and continue from the new live version. That mental-model gap is actively inhibiting the non-technical leaders. **Q3 goal:** get the whole leadership team working close to Rachel/Kristi's level.
- **Pilot group:** the leadership team. Will tolerate rough edges, but **not** unclear UI or bugs. Strong preference for **simple over flexible/cutting-edge** — would rather have a few things that clearly work than lots of power they don't use.
- **The core jobs (the MVP loop):**
  1. Set up their account / **connect a system** (mental model: like creating a new vault in Obsidian).
  2. **View/edit Claude's work** inside the app and **save or discard** changes.
  3. **Submit their work for review** by the team.
  4. **Review someone else's** work.
  5. **Work on multiple projects at once** in the same system.

**Design north-star (derived):** Give users **the value of git — versioning the system, working in drafts/"versions," making changes safely and reversibly — without any of the GitHub headache.** Two pillars:
1. **Make the hidden model legible & unscary.** Users should intuitively grasp that their draft lives locally, that they can keep working while it's in review, and that they can continue from the new live version once it merges. (Hannah's confusion is the canonical failure this must fix.)
2. **Constrain by design.** Deliberately narrow the set of actions a user can take so that dangerous states — merge conflicts, detached HEAD, lost work — become *unlikely by construction*, not just recoverable. Simplicity and guardrails beat flexibility for this audience.

---

## 2. The core loop — what's the minimum that delivers value?

**Why it matters:** We have a working end-to-end loop already (edit → draft → save → publish → review → merge). MVP is about deciding which parts of that loop are *load-bearing* vs. which are polish, and what's missing entirely.

**Questions to answer:**
- Walk the **happy path** you want a user to complete unaided. Where does it start (open app? click a link?) and end (published? merged? notified)?
- **Creating** content: today the app opens existing files but there's no "New file" flow. Do users need to **create** playbooks/docs in-app for MVP, or only edit existing ones? If create — from a template? which templates?
- **Folders/organization:** who decides where a new file goes? Do users navigate the file tree freely, or do we constrain them to certain folders per system?
- Is **review always required**, or can some users publish directly to the Live Version? Who can approve?
- What's **explicitly out** of the MVP loop that you've seen requested? (naming these prevents scope creep)

**My take:** The riskiest gap is probably content *creation* + templates — editing existing files is solved, but a real workflow usually needs "make a new playbook from a template." Worth deciding early because it touches the editor, file tree, and frontmatter schema.

**Answers (2026-07-06):**
- **Happy path (Hannah, unaided):** Opens app → lands on the **system she was last working in** → sees her live draft with **unsaved edits** flagged → reviews them → **Save** → **Submit for review**, tagging **Rachel** → switches to a **different system** to start a **different project** while waiting → **creates a new draft** there → makes edits but **doesn't save yet** (still working) → remembers something for Rachel's review → jumps back to the first system, opens the **in-review draft**, makes the change, and **updates the review** (Rachel now sees the latest files) → returns to the second system, sees unsaved edits, **saves** → closes the app for the day.
  - **Implication:** the MVP must gracefully support **multiple systems open/active and multiple drafts in flight at once**, plus **updating an existing in-review draft** with new changes. This concurrency is core, not edge.
- **Content creation — IN scope, must feel Obsidian-grade:** create new docs, **move files between folders, create folders**. Users must feel they can do *real work* here, not only review Claude's output. **Templates** for "New Playbook" / "New Project" that follow our repo-structure conventions are wanted for ease of use.
- **Folder structure — "constrain by design":** Top-level folders are **static for MVP** — `readmes/`, `reference/`, `work/`, and `.claude/`. Users may **only create folders from the second level down**; no new top-level folders competing with those. (Revisit if users chafe.)
- **Review gating:** Review is **always required** for MVP. Rachel & Kristi can use **GitHub directly** as a power-user workaround (the app only pulls state, so that's fine). **Anyone can approve**, but the UI must require **at least one approval by someone other than the creator** before a draft can merge/publish.
- **Explicitly OUT of v1:**
  - Creating a **new system** / scaffolding a new repo (internal users already have all their systems).
  - **AI chat** built into the UI.
  - Users creating **instruction files** (README / CLAUDE files) themselves.

**Open consideration:** §1's job #5 ("multiple projects at once in the *same* system") plus this happy path means users need **more than one draft per system** *and* multiple systems — with minimal manual "switching/stashing" friction. Worth confirming how "switch between drafts" should feel so it never risks losing the unsaved work she deliberately left un-saved.

---

## 3. Distribution & packaging 🔴 — how do users get and update the app?

**Why it matters:** Right now the app only runs via `npm run dev`. Non-technical users need a double-click installer. This is a hard blocker and has real prerequisites (developer accounts, signing certs) with lead time.

**Questions to answer:**
- **Platforms:** Mac only? Windows too? Mix? (Changes signing/testing burden significantly.)
- **Apple:** Do we have (or can we get) an **Apple Developer account** ($99/yr) for signing + notarization? Without it, macOS Gatekeeper shows scary warnings. Who owns that account?
- **Windows:** If Windows is in scope, do we have a **code-signing certificate**? (These are pricier/slower to obtain — EV certs can take weeks.)
- **Updates:** How should users get new versions? Auto-update (recommended — they never think about it) vs. "download the new one." Auto-update needs a release host.
- **Release hosting:** GitHub Releases is the natural fit (repo's already there). Public or private releases? If private, updater auth gets more complex.
- **Cadence:** How often do you expect to ship updates during the pilot? (Informs how much auto-update infra is worth it now.)

**My take:** macOS-first with an Apple Developer account + auto-update via GitHub Releases is the cleanest path and matches the personal build notes already on file. Windows doubles the work — defer unless a pilot user needs it. **Action for you:** confirm who can create/own the Apple Developer account; that's the longest-lead item.

**Answers (2026-07-06):**
- **Platforms:** **macOS only.** Entire pilot group is on Mac; assume no other platforms for now.
- **Apple Developer account:** ✅ Kristi already has one → macOS signing + notarization is unblocked (this was the longest-lead item — cleared).
- **Windows:** out of scope.
- **Updates:** **auto-update** desired.
- **Release hosting:** *pending decision* — where the `.dmg` + update metadata live so the updater can fetch new versions. Options on the table:
  - **(a) Private repo Releases + scoped token in the app** — stays fully private; standard `electron-updater` setup *(recommended for an internal tool)*.
  - **(b) Dedicated public "releases" repo** (binaries only, no source) — zero-auth updater; signed `.dmg` is technically public but useless without GitHub auth + systems.
  - **(c) Cloud bucket (S3/R2)** generic feed — more infra than 4–6 users need.
  - **✅ Decision: (a) private releases repo + read-only embedded token; hand the *initial* `.dmg` to each of the 6 users directly (Slack/Drive), auto-updates from there.**
    - Rationale: keeps **source private** (the pre-open-source constraint) — a public releases repo (b) would effectively publish the `.dmg`, which is unpackable source. Auto-update stays zero-friction for users. The only token is dev-side, **read-only scoped to the releases repo**, and only ever on the 6 internal machines we control.
    - Note: an embedded token is extractable (Electron `app.asar` isn't encryption), so keep it least-privilege. If we get security-strict later, swap to a tiny **update-proxy server** that holds the token so the app ships no secret. Overkill for 6 users now.
    - Reminder: when we open-source later, revisit — (b) becomes fine and simpler.

---

## 4. GitHub auth & onboarding 🔴 — the "Connect to GitHub" wizard

**Why it matters:** You chose to keep `gh` as the auth path, with an onboarding flow that installs + authenticates it. This is the single most complex UX for a non-technical user, and it's a blocker for the publish/review half of the app. (Capability detection + the placeholder entry already exist from the last PR — this is the real wizard behind it.)

**Questions to answer:**
- Is **`gh` still the right call**, knowing users must install a CLI? The alternatives:
  - **(a) Bundle/guide `gh`** — the app checks for `gh`, and if missing, walks the user through installing it (or bundles the binary) and running `gh auth login`. Keeps your current backend as-is.
  - **(b) GitHub OAuth device flow in-app** — user clicks "Connect," gets a code, approves in browser; app stores a token (Electron `safeStorage`). No CLI install. More work up front, but *far* friendlier and the token also lets us drop `gh` entirely later.
- If we keep `gh`: are you comfortable **bundling the `gh` binary** with the app (removes the install step but adds size/maintenance), or guiding an install?
- **Org access & SSO:** Are the repos under a GitHub **org with SSO**? That changes the auth dance (users must authorize the token for the org). Have you hit this?
- **Permissions:** What scopes does the token actually need (repo read/write, PR create/review)? Least-privilege matters if this spreads.
- **Token storage:** Confirm `safeStorage`/keychain is acceptable for storing credentials on user machines.
- **First-run:** Should GitHub connection be **required at first launch**, or can users work in local-only mode and connect later? (We built local-only mode, so "later" is possible.)

**My take:** I'd seriously weigh **(b) OAuth device flow** over bundling `gh`. "Click Connect → approve in browser → done" is dramatically better for non-technical users than any CLI-install wizard, avoids shipping/maintaining a binary, and it's the same token you'd want for the eventual REST-API backend. The catch is org SSO — if your repos are behind SSO, that needs testing either way. **This is the biggest fork in the MVP; worth deciding first among §4 items.**

**Answers (2026-07-06):**
- **Auth approach — ✅ (b) OAuth device flow** via a **single Parrot-Labs-owned OAuth App** (not a GitHub App). Reversed from an initial "(a) guide `gh`" lean once the mechanics were clear.
  - **Why the reversal:** the "we'd have to maintain a GitHub App / users would create their own" fear doesn't apply to device flow.
    - **OAuth App vs GitHub App:** we want an **OAuth App** ("act as the user"), not a GitHub App (installable bot w/ fine-grained perms).
    - **Device flow needs only a public `client_id` — no client secret, no server.** Register one OAuth App under Parrot Labs (~2 min: name, icon, tick "Enable Device Flow"); ship the `client_id` in the app. It's **not secret** (safe to open-source). Flow: app → GitHub (code) → user approves in browser → app gets a token. **No backend to host.** "Maintenance" = the registration existing. This is exactly how the `gh` CLI works (it ships its own baked-in client_id) — (b) is that model minus the CLI.
    - **Open-source:** users create nothing (just click Connect). Forkers reuse our `client_id` (consent screen reads "Parrot Labs") or set their own via config/env — one documented line, zero burden on us.
  - **Token storage:** Electron `safeStorage` (keychain-backed).
  - **Day-to-day git is already hidden** (draft/save/publish/review are the whole app); OAuth removes the *only* remaining exposed moment (`gh` install/auth) — no terminal ever.
  - **Backend implication:** the OAuth user token also lets us migrate PR ops off the `gh` CLI to the GitHub REST API later (drops the `gh` dependency entirely). Not required for MVP, but (b) is the on-ramp.
- **Org & SSO:** Repos under the **Parrot Labs org**; **SSO is NOT enabled** (confirmed 2026-07-06 — SAML SSO shows as a GitHub Enterprise upsell; org-wide 2FA not required). So no SSO authorization step. **One-time check:** Org Settings → *Third-party access* → "OAuth app access restrictions" — if ON, an owner approves the app once (not per-user).
- **First launch:** **GitHub connection required on first run** for MVP. Local-only mode deferred to **v2**.
- **Initial repo:** **"already cloned" is the MVP assumption** — coherent with the stack, since Rose/Hannah already use **GitHub Desktop** (onboarding = "clone in GitHub Desktop → connect that folder in AMP Atlas"). **Clone-from-GitHub-link is a v2 requirement.**

---

## 5. Team config & shared systems 🟡 — how do teammates get the same setup?

**Why it matters:** The list of "systems" (which repos, names, colors) lives in each user's `localStorage`. That means every new teammate configures everything by hand, and there's no shared source of truth. For a *team* tool, this is a real gap.

**Questions to answer:**
- When a new teammate installs the app, how should they get the **list of systems** — auto-discovered, shipped as defaults, pulled from a shared config file in a repo, or entered manually?
- Do all users see the **same systems**, or do different people work in different subsets?
- Where should shared config live — a **dedicated config repo**, a file in each system's repo, or a small hosted config? (No-DB constraint favors a git-backed config file.)
- **Reviewer mapping:** publishing needs to map display names → GitHub usernames (currently hardcoded). Where does the team roster live, and who maintains it?
- Do users need to **clone repos** themselves first, or should the app offer to clone a system from a GitHub URL? (Big UX difference — "paste a link" vs. "go clone this in Terminal.")

**My take:** A **git-backed team config** (a small JSON/YAML file in a known repo the app reads on launch) fits the local-first, no-DB philosophy and makes onboarding a teammate ≈ "sign in and you see the same systems." Pairing that with an in-app "clone from GitHub URL" flow would remove the last CLI step. Reviewer roster can live in the same config file.

**Answers (2026-07-06):** *(This supersedes the "shared config file" take above — the API + per-user-vaults model removes most config.)*
- **Getting systems — manual, per-user (like Obsidian vaults).** On first install, the user **manually selects their systems** (already-cloned repo folders). The connect flow **verifies the folder is connected to GitHub**; if there's **no GitHub connection, show an alert and refuse to add it** (tell the user to contact support — Kristi, for now).
- **Same for everyone? No — per-user subsets.** Different people work on different systems, so **each user chooses their own** (vault model). ⇒ **No shared systems config needed;** per-user `localStorage` for the systems list is now *correct by design*, not a stopgap.
- **Files outside our structure:** if a connected repo has files outside the opinionated structure (`readmes/`, `reference/`, `work/`, `.claude/`), **just don't load them into the viewer** (v1 opinionated choice — revisit if it breaks real workflows).
- **Reviewer roster — derived from the GitHub API, not config.** Using the user's OAuth token, fetch **repo collaborators** (`GET /repos/{owner}/{repo}/collaborators`, names via `GET /users/{login}`) to populate the reviewer picker with real usernames. **Kills the hardcoded reviewer-mapping stopgap** and is inherently open-source-friendly (each user/fork gets their own repos' collaborators).
- **OAuth scope:** **OAuth App + `repo` scope** for MVP (broad but simplest; gives repo list + collaborators + push/PR). Per-repo granular selection would require a **GitHub App** — revisit only if broad scope feels heavy at open-source time. Org-owned private repos become reachable once an org owner approves the app (the §4 "OAuth app access restrictions" one-time check).
- **Per-machine folder linking:** yes — each user's local clone path is stored locally per machine; only the *paths* are per-machine, and since systems are per-user anyway, everything about systems lives locally.

---

## 6. Content model & conventions 🟡 — opinionated structure

**Why it matters:** You want this opinionated so users don't make organizational decisions. We shipped a `playbook` schema (SKILL.md); MVP likely needs a small, deliberate set of types and conventions.

**Questions to answer:**
- What **file types** exist beyond `playbook`? (e.g. process doc, meeting note, reference?) For each: what frontmatter fields, and how is the type detected (explicit `type:` vs. folder/name convention)?
- Should there be **templates** for creating each type (ties to §2)?
- What's the **status vocabulary** — we defaulted to Draft/Active/Archived. Is that right, and is it the same across types?
- **Wikilinks / file-linking:** you flagged this as important-later. Is it MVP or fast-follow? (We built the editor to accommodate it, but it's real work.)
- Any **required conventions** you want enforced (naming, required fields before publish, folder placement)?

**My take:** Keep the type set small for MVP (playbook + maybe one more), lock the status vocabulary, and treat wikilinks as the first fast-follow after MVP unless a user's core loop depends on cross-linking.

**Answers (2026-07-06; sub-system update from PR #2 review):**
- **File types (recognized):**
  - **Playbook** — a *skill folder* under `.claude/skills/<name>/` with a `SKILL.md` (already built: `type:`/`SKILL.md` detection + Draft/Active/Archived status). **Add an *optional* `sub-system` frontmatter field** (which sub-system, if any, the playbook belongs to).
  - **Instructions** — `README.md` and `CLAUDE.md` markdown files. Recognized type, but **not user-creatable in v1** (§2); editable as normal markdown.
  - **Plain markdown** — any other `.md` inside the top-level folders; no special schema.
- **"New" actions scaffold folders + starter templates, shipped in the app** (the opinionated core of §6):
  - **New Playbook** → `.claude/skills/<name>/SKILL.md` (from template).
  - **New Project** → `work/<project-name>/` containing `pitch.md` + `braindump.md` (from templates).
  - **New Sub-system** → a new sub-system folder under `reference/` (with its starter doc[s]). *(Renamed from "Domain" per PR #2 review.)*
  - Decision: **do the structured templates** (not just a bare "new folder" button) — Kristi will provide the actual template file contents at build time. *(Placeholder: template bodies TBD.)*
- **Sub-systems (from PR #2 review):** a **sub-system** is an organizing grouping within a system. Playbooks carry an **optional `sub-system` field**; **possibly organize skills by sub-system** (grouping playbooks under the sub-system they belong to, if any). Exact folder placement / grouping mechanics = a detail to lock at build time.
- **Status vocabulary:** **playbooks only** → Draft / Active / Archived. **No status field on other types** for now.
- **Wikilinks / file-linking:** **NOT MVP** — candidate for **v2**.
- **Enforced conventions:** **loose for v1.** In-app *creation/editing* is guided/opinionated (templates + fixed top-level folders), but users can still edit files *outside* the app and those changes flow through the branch/commit normally. Don't restrict that yet.
- ✅ **Top-level folder names confirmed:** exactly `readmes/`, `reference/` (singular), `work/`, `.claude/`.

---

## 7. Collaboration & conflict handling 🔴 — what happens when two people touch the same thing?

**Why it matters:** Git's merge/conflict model is exactly the developer complexity this app hides. For non-technical users, a merge conflict is a dead end unless we handle it. This is a genuine "will it break trust" risk.

**Questions to answer:**
- How likely is it that **two people edit the same file** in overlapping drafts? (Frequency changes how much this matters for MVP.)
- What should happen on a **conflict** — block it, auto-resolve last-write-wins, or a simplified "someone else changed this, here are both versions" UI?
- The app auto-**stashes** on branch switch and force-deletes branches on archive — are there scenarios where a user could **lose work**? Do we need a safety net (e.g. never hard-delete unpublished drafts without a clear warning + recovery)?
- What happens when someone edits a file **outside the app** (in Obsidian, or the repo changes on GitHub)? (Memory note: you wanted real-time detection of external git changes — is that MVP?)
- **Offline:** do users need to work offline and sync later, or is connectivity assumed?

**My take:** Two things I'd treat as MVP-critical here: (1) a real **conflict experience** that never dead-ends a user, even if it's just "your teammate published changes — save yours as a new draft," and (2) **no silent work loss** — the archive/discard/stash paths need obvious warnings and ideally recoverability. These are trust-makers or trust-breakers.

**Answers (2026-07-07) — all locked:**

**Collision prevention (prevention > resolution):**
- **Branch only from the Live Version, never from another draft.**
- **A user cannot open/edit another user's draft.**
- **Drafts always start fresh** — creating a draft auto-pulls the latest Live Version first (stale base is the #1 conflict cause).
- **Soft awareness (API-powered):** when opening/editing a file, check open drafts/PRs touching it and show a *non-blocking* banner ("⚠️ Hannah has a draft in review that edits this file"). Visibility, not locking.
- **Update-before-publish:** at publish, bring the draft up to date with the latest Live Version and check edits still apply — conflicts surface here, in a calm moment, not as a scary GitHub merge failure.
- **True conflict (rare):** never expose git conflict markers. **Block publish** with a plain message — *"The Live Version changed in a way that overlaps your edits. Your draft is safe — contact Kristi to help merge."* Human-escalation for MVP; a 2-way merge UI is post-MVP *only if* collisions become frequent.

**Draft lifecycle — drafts are ephemeral, safe, legible:**
- Mental model: *a Draft is a temporary workspace that exists only to become a published version; the Live Version is where work lives long-term.*
- Stages (user language): **Editing** (unsaved, on your computer) → **Save** (restore point / commit) → **Submit for review** (push + PR, tag reviewer) → **In review / Update** (keep adding) → **Published** (merged into Live Version; draft auto-retires).
- **Persistent plain-language status** wherever a draft is active, e.g. *"Draft: Onboarding Revamp · 2 unsaved edits · saved 5 min ago · in review by Rachel"* + a one-line explainer.

**Work-loss safety (hard-to-lose-work by construction):**
- **Continuous autosave to disk** (already built) — never lose typing.
- **Switching drafts/systems with unsaved edits → explicit "Save or Discard?" prompt**, *replacing today's silent auto-stash* (the invisible work-loss trap). Leaving work unsaved is still allowed; the state is just made visible.
- **Merged drafts auto-retire** with a friendly note — *"This draft was published and archived. You're now on the Live Version."* (Directly fixes Hannah's confusion.)
- **Archiving an *unpublished* draft:** strong explicit warning **and back it up to GitHub before removing it locally** — never an unrecoverable delete. Replaces today's `git branch -D` force-delete.

**External edits (IDE-like) — MVP:**
- **Watch the system folder;** reflect external changes (Claude, Obsidian, `git pull`) automatically — refresh tree + reload open file.
- **Rule:** if the user has **unsaved edits** in a file that changed on disk, don't clobber — prompt *"This file changed on disk. Reload and lose your edits, or keep yours?"* If the editor is clean, reload silently.
- (New work: today the app polls git status every 3s but doesn't watch files or reload the editor.)

**Offline — treat as a capability state, not a lockdown:**
- Keep **local editing + Save working offline** (just disk + local git). **Grey out only the GitHub actions** (submit/review/publish, fetch collaborators) with *"You're offline — keep editing; publishing and review need a connection."* Reuses the degraded-mode pattern already built; full view-only lockdown was rejected as more work and less useful.

---

## 8. Errors, recovery & support 🟡 — when git does something weird

**Why it matters:** Even with vocabulary hidden, git operations fail (auth expired, network down, detached state). A non-technical user can't read a git error. We added toasts, but MVP needs a coherent recovery story.

**Questions to answer:**
- When an operation fails, what's the **recovery path** a user can take without you? (Retry button? "Contact support"? Auto-diagnose?)
- Do you want **basic telemetry / error logging** to a place you can see (so you can debug a user's problem remotely), and is that acceptable privacy-wise for internal use?
- Who is **"support"** during the pilot — is it you? Do we need an in-app "something went wrong, send Kristi the details" button?
- Should there be a **"reset this system"** escape hatch (re-clone / re-sync) for when a repo gets into a bad state?

**My take:** For a pilot, a lightweight "report a problem" button that bundles the last errors/log and the current git state (so you can diagnose) is worth more than elaborate self-recovery. Add a "re-sync from GitHub" escape hatch for stuck repos.

**Answers (2026-07-07) — locked:**
- **Recovery paths:** a **Retry** button and a **"Re-sync from GitHub"** button. Anything more technical → **escalate to Kristi** (honest MVP answer).
- **Report a problem:** a button that routes to a **form (Airtable)** where the user pastes an error report. Kristi creates the form at the end of the MVP build when needed. The button should **auto-copy recent logs to clipboard** so the user just pastes them in.
- **Logging / viewing:** use **`electron-log`** (auto-writes timestamped logs to a local file, cross-platform). Add a **Settings → Diagnostics** panel showing recent entries with **"Copy logs"** + **"Reveal log file"** buttons. Purpose: screenshare debugging (Kristi reads logs live). **No remote log access for MVP** — strictly local.
- **Escape hatch — "Re-sync this system from GitHub":** resets a broken local repo to match the Live Version. **Settings-only** (not a normal-flow button), with a **strong warning** before the user confirms, and the §7 work-loss safeguards (back up anything unpublished first).

---

## 9. Success criteria & timeline

**Why it matters:** "MVP" needs a finish line and a way to know it worked.

**Questions to answer:**
- What's the **target date** or window for the pilot?
- How will you **measure success**? (e.g. "3 pilot users each publish a reviewed playbook in week 1 without asking me for help.")
- What's the **rollback plan** if the pilot struggles — keep using the old tool in parallel?
- What would make you say "**not ready**" — the specific failure that stops a wider rollout?

**My take:** Pick one concrete behavioral success metric (a user completing the core loop unaided) and one hard "not-ready" tripwire (e.g. any silent data loss). Those two keep scope honest.

**Answers (2026-07-07) — locked:**
- **Target window:** ~**1 week** (aspirational / not-worried — soft deadline).
- **Success metric:** the whole **leadership team is onboarded** and, from the trainings Kristi provides, can do:
  - Set up your account / first system / **new system** *(= connect another existing repo as a vault — NOT scaffolding a new repo, which is §2 out-of-scope)*.
  - Use **Claude cowork** to work on a new project & view/edit it in AMP Atlas.
  - **Submit** your work for review.
  - **Review** someone else's work — **cannot edit their branch**; **request changes via comments** and **comment on the whole PR** *(review = approve / request-changes / PR-level comment; line-level editing of others' work is out for MVP)*.
  - **Work on multiple projects at once in the same system** (versions).
  - Understand the **AMP folder structure**.
- **Not-ready tripwires:** any **silent data loss**; anything that makes the app **unusable with Claude** or that **disrupts the current Obsidian workflow**.
- **Rollback:** none intended — **full switch** off Obsidian + GitHub Desktop is the goal.

---

## 10. Deferred from the last PR (parking lot)

Already scoped-out during the content-integrity work; slot these into the roadmap once §1–§4 are decided:
- GitHub OAuth onboarding wizard (→ §4)
- Packaging / installer / signing / auto-update (→ §3)
- Shareable team config (→ §5)
- Reviewer name→username mapping (→ §5)
- Wikilinks / file-linking (→ §6)

---

## MVP scope — derived from the answers (2026-07-07)

**In scope for MVP:**
- **Onboarding & auth:** first-run **OAuth device-flow** connect (required); **manually add a system** (pick a cloned folder → verify GitHub remote + access → reject if none); **per-user vaults**.
- **Editor & content:** markdown-native editing *(shipped in PR #1)*; opinionated **top-level folders** (`readmes/ reference/ work/ .claude/`); **Obsidian-grade file/folder create + move** (2nd-level and deeper only); **New Playbook / New Project / New Sub-system** scaffolds with shipped templates; schema-driven **playbook** frontmatter *(shipped; add optional `sub-system` field)*; hide files outside the structure.
- **Draft/version lifecycle:** branch **from Live Version only**, **fresh-pull on create**; Save → Submit → Update → Publish; **legible persistent status**; **Save-or-Discard prompt on switch** (replaces silent stash); **merged drafts auto-retire**; **backup-before-archive**.
- **Review:** submit + tag reviewer (**collaborators from the GitHub API**); review others (**approve / request-changes / PR-level comment**, **can't edit their branch**); **≥1 non-author approval** required to publish.
- **Sync & external edits:** **file-watch → IDE-like live reflection**; external-change vs. unsaved-edit prompt.
- **Collision prevention:** soft **awareness banner** (API); **update-before-publish**; **human-escalation** on true conflict (never expose git markers).
- **Safety & support:** §7 work-loss safeguards; **Retry** + **Re-sync-from-GitHub** (Settings-only, warned); **Diagnostics** panel (`electron-log`, Copy/Reveal logs); **Report-a-problem** → Airtable form.
- **Offline:** capability state — local edit/save works, GitHub actions grey out.
- **Packaging:** signed + notarized **macOS** build; **auto-update via private releases repo** + read-only embedded token; hand the initial `.dmg` to each user.

**Deferred (v2 / out):** new-repo scaffolding · clone-from-GitHub-link · local-only first run · wikilinks/file-linking · line-level review comments · shared team config (not needed — per-user vaults) · Windows · in-app AI chat · user-created instruction (README/CLAUDE) files.

## Suggested build sequence

Each becomes its own **spec → plan → build** cycle (same flow as the content-integrity PR). Ordered by lead time + dependencies:

1. **Packaging + auto-update pipeline** — longest lead (signing/notarization/releases repo); start early, can run in parallel.
2. **OAuth device-flow auth + first-run onboarding** — gates the whole GitHub half; also unlocks API-driven reviewers/repo lists.
3. **Draft lifecycle + work-loss safety** — the trust core (fresh-from-main branching, Save-or-Discard on switch, backup-before-archive, legible status, merged auto-retire).
4. **File-watch / IDE-like external-edit sync.**
5. **Content creation** — folder/file create + move, New Playbook/Project/Sub-system templates.
6. **Review polish** — API-driven reviewers, ≥1-non-author-approval gate, PR comments.
7. **Collision prevention** — soft-awareness banner, update-before-publish, conflict escalation.
8. **Safety/support surface** — Diagnostics panel, Retry/Re-sync, Report-a-problem.
9. **Offline capability state.**

**Immediate next step:** turn this worksheet into the first spec — likely **(1) packaging/auto-update** (longest lead) and **(2) OAuth onboarding** (unblocks the most), which can proceed in parallel.
