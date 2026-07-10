# AMP Atlas — User Documentation Plan

_Design / spec for the first pass of end-user documentation (SOPs, guides, training)._
_Created 2026-07-10._

---

## Goal

Produce a coherent library of user-facing guides that teach a **non-technical AMP
team member** how to work in AMP Atlas: set up, understand the folder structure and
the operating model behind it, cowork with Claude, and run the full
**Draft → Review → Publish** collaboration cycle.

These docs will be **drafted as clean markdown** and **pasted into an external wiki /
Notion site**. They can lean slightly longer and more visual than in-app help
(search and screenshots work well there), but every doc stays task-focused and
skimmable.

> **Product name:** referred to throughout as **AMP Atlas**. (The repo/README still
> says "AMP UP"; treat "AMP Atlas" as the current product name for all user docs.)

---

## Audience

- Non-technical AMP team members (domain experts, project planners, reviewers).
- They are **not** developers. They have never used git, and never should have to.
- Some are comfortable with tools like Notion/Obsidian; none should need the terminal.
- This is a different audience from the internal Week-1 IMPL training (which is
  semi-technical and teaches the same operating model *through* git + Obsidian +
  Claude Code). These docs teach the **same concepts with zero plumbing.**

---

## Writing principles (apply to every doc)

1. **No git vocabulary, ever.** Never say branch, commit, push, merge, pull request,
   PR, repo, or `main`. AMP Atlas uses GitHub's power for versioning and review
   *underneath*, but that surface never leaks to the user.
2. **AMP Atlas concepts are first-class**, not friendly masks over git. The glossary
   defines them on their own terms; it does **not** "translate to git."
3. **Framing:** AMP Atlas is the calm way to run your team's knowledge **Systems** —
   it replaces the **Obsidian + GitHub** combo, keeping their power (versioned,
   reviewable, one source of truth) without their developer surface. **Do not** use a
   "Google Docs" analogy.
4. **Canonical vocabulary** (use consistently):
   - **System** — a domain workspace (e.g. Learning System, Delivery System). The
     "vault equivalent." Owns exactly one business function.
   - **Sub-system** — a division inside a System.
   - **Project** — a scoped body of work inside a System (`work/projects/`).
   - **Playbook** — a repeatable process a person or Claude can run (`.claude/skills/`).
   - **Live Version** — the published, approved, shared source of truth for a System.
   - **Draft** — an in-progress version that diverges from the Live Version. All edits
     happen in Drafts; nobody edits the Live Version directly.
   - **Publish** — send an approved Draft to become the new Live Version.
   - **Review** — the approval conversation on a Draft before it can be published.
   - **Reference** vs. **Work** — canonical/approved material vs. in-flight/draft
     material (the most important organizational split in a System).
5. **Every doc** ends with a "you should now be able to…" success check and links to
   the next logical doc. Concept docs cross-link (glossary ↔ operating model ↔ folder
   structure ↔ workflow docs).
6. **Tone:** warm, plain-language, confident. Reassure often (nothing is lost; the
   Live Version is safe). Reflect the AMP brand voice.

---

## Source material (anchor the concepts, then strip the plumbing)

The internal Week-1 System Orientation training is the conceptual backbone. Located at:
`~/Documents/Parrot/github/leadership_system/work/projects/impl-training-project/week-1-system-orientation/`

- **Lesson 1 — The Why:** the operating model. Durable shared knowledge; humans + AI
  read the *same* canonical source; nothing ships without review; one canonical
  version per business function; the three layers (Source / Workspace / Governance).
  → Anchors **"Why we work this way"** + **Welcome**. Retell the *essence* only; drop
  the RAG / knowledge-graph / context-engineering industry deep-dive.
- **Lesson 2 — The Repo Structure:** the "shape is a promise" idea; `reference/`
  (canonical) vs `work/` (in-flight); playbooks; the consistent System shape.
  → Anchors **Intro to the AMP folder structure**.
- **Lesson 5 — Proposing a PR:** the review cycle. Provides two frameworks:
  - **The 3 Layers of Work — Structure → Substance → Style** (what kind of feedback
    the author is asking for; strict ordering). → **Submit for review** + **Review someone's work**.
  - **Comment labels — nitpick / blocking / question / praise.** → **Review someone's work**.
  Strip all git mechanics (branch/commit/push/PR) and retell as Draft/Publish/Review.

---

## Where the drafts live

Draft each guide as its own markdown file under **`docs/user-guides/`**, grouped by the
four sections below (e.g. `docs/user-guides/01-getting-started/welcome.md`). This keeps
them versioned with the app and easy to copy into Notion. Final home is the external
wiki; the repo copy is the working source.

---

## The library — 15 docs, four sections

### 📁 1. Getting Started

**1.1 Welcome / What is AMP Atlas** — _the orientation doc_
- What AMP Atlas is (the calm way to run your team's knowledge Systems; replaces
  Obsidian + GitHub).
- Who it's for and what you can do here.
- The one big idea, briefly: **Draft → Review → Publish** — every change is tracked,
  reviewed, and safe.
- What a System is, in one line (links to concepts).
- Where to go next.

**1.2 Set up your account & first System** _(SOP #1)_
- Install & open the app; prerequisites.
- Sign in / connect your account.
- Add an existing System vs. create a new one; name, icon, color.
- What a "System" is (the vault equivalent), one line + link.
- Success check: your System appears on the dashboard.

**1.3 A tour of the app**
- Dashboard (System cards, Jump Back In, recently edited).
- Sidebar & switching Systems; the file tree.
- Inbox (reviews waiting on you).
- The editor at a glance; the status bar.

### 📁 2. Core Concepts

**2.1 Why we work this way — the AMP operating model** _(anchored in Lesson 1)_
- Your team's knowledge lives as plain documents inside Systems.
- Humans and Claude read the **same** source — no "AI sees one thing, you see another."
- One **Live Version** per System is the shared source of truth; nothing becomes Live
  without **Review**. This is what keeps the knowledge trustworthy.
- Why this beats scattered docs (Notion + Slack + Google Docs + people's heads).
- Light, friendly; no industry/RAG deep-dive.

**2.2 Key words, translated** — _glossary_
- Defines AMP Atlas's own vocabulary as first-class concepts (see canonical list
  above): System, Sub-system, Project, Playbook, Draft, Live Version, Publish, Review,
  Reference vs. Work.
- No "= git branch" column. Short, scannable, links out to the deeper docs.

**2.3 Intro to the AMP folder structure** _(SOP #6; anchored in Lesson 2)_
- The "shape is a promise": every System looks the same, so you always know where
  things live.
- The hierarchy: System → Sub-systems → Projects → Playbooks.
- The key split: **Reference** (canonical, approved, trusted) vs. **Work** (in-flight,
  drafts, project artifacts). Why the split matters.
- Where things live, in friendly terms (Projects, Playbooks, Reference, long-form
  context). What not to touch.
- Annotated example tree.

### 📁 3. Everyday Workflows

**3.1 Editing basics**
- Create files/folders; open & edit a document.
- Editor essentials (the friendly formatting experience).
- The properties (frontmatter) drawer.
- Starting from a template; **Save** (keep working) vs. **Publish** (send for review).

**3.2 Coworking with Claude on a new project** _(SOP #2)_
- The concept: Claude drafts, you refine in AMP Atlas; Claude reads the same System
  files you do.
- Claude always works on a **Draft**, never the Live Version.
- Entry point A — Claude Code (in the terminal), pointed at your System.
- Entry point B — the Claude chat app (Desktop/web) connected to your System.
- Then open / view / refine the result in AMP Atlas. Handing off back and forth.
- Concept-level only — no CLI mechanics, no git.

**3.3 Submitting your work for review** _(SOP #3; uses the 3 Layers)_
- Finish and Save your Draft.
- Publish flow: the change summary vs. the Live Version, pick reviewer(s).
- **What feedback are you asking for?** Introduce the **3 Layers of Work —
  Structure → Substance → Style** so reviewers know where to focus.
- What happens after you submit; how you track its status.

**3.4 Reviewing someone else's work** _(SOP #4; uses 3 Layers + comment labels)_
- Find reviews in your Inbox; open the Review page.
- Read the change, file by file; the Final vs. Changes view; the "✓ Reviewed"
  check-off.
- **The rule: you can't edit someone else's Draft.** Feedback goes through **comments
  only.**
- Comment on the whole review, or on specific spots.
- The **3 Layers** (what to review) and the **comment labels** (nitpick / blocking /
  question / praise).
- **Approve** vs. **Request Changes.**

**3.5 Working on several projects at once** _(SOP #5 — "versions")_
- Why: parallel workstreams in one System = multiple Drafts at once.
- Create, name, and switch between Drafts.
- Starting a Draft **from another Draft** (to build on in-progress work) vs. from the
  Live Version (fresh start).
- Keeping them straight; publishing each independently.

**3.6 When the Live Version changes (updates & conflicts)**
- Why the Live Version moves under you (someone else published).
- "Updates available" → update your Draft.
- Guided resolution when your Draft and the Live Version disagree.
- Reassurance: nothing is lost.

### 📁 4. Reference

**4.1 Templates guide**
- Project: `braindump.md` (raw thoughts) and `pitch.md` (the case for the work) —
  when to use each.
- Playbook: `SKILL.md` — structure & when to write one.
- Sub-system: `README.md` — defining a sub-system.
- The `status` convention (draft / needs-review / approved) in plain terms.
- How to start from a template in-app.

**4.2 Troubleshooting & FAQ**
- Top confusions: "my change isn't live yet," "I can't edit this review," "what does
  'updates available' mean?", sign-in issues, "where did my Draft go after publishing?"

---

## Drafting order

Draft in reading order so cross-links resolve naturally and each builds on the last:

1. Welcome / What is AMP Atlas
2. Why we work this way (operating model)
3. Key words, translated (glossary)
4. Set up your account & first System
5. A tour of the app
6. Intro to the AMP folder structure
7. Editing basics
8. Coworking with Claude on a new project
9. Submitting your work for review
10. Reviewing someone else's work
11. Working on several projects at once
12. When the Live Version changes
13. Templates guide
14. Troubleshooting & FAQ

_(15 total including the Welcome/operating-model split — numbered here by draft order,
which merges the two intro docs into steps 1–2.)_

---

## Open items to confirm while drafting

- **Product name** — confirm "AMP Atlas" is final (repo still says "AMP UP").
- **Screenshots** — placeholders to be added; note which screens each doc needs.
- **Sign-in mechanics** — the exact account/sign-in flow (OAuth is a known stopgap in
  the README); write 1.2 against the intended end-state and flag anything not yet live.
- **3 Layers / comment labels in-app** — confirm how much of the Structure/Substance/
  Style framing and the nitpick/blocking/question/praise labels are surfaced in the
  AMP Atlas UI vs. taught as team convention.
