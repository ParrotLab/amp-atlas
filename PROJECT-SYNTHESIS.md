# AMP Atlas — Project Synthesis

## What This Document Is

This is the single-source synthesis of three inputs:

1. **AMP Brand Identity** (MBjr Design, Feb 2026)
2. **The AI-First Operating Framework** (Kristin Downs, Mar 2026)
3. **Product requirements** from the initial brief

It captures what we're building, why, who it's for, and the design/UX direction — so we can move into planning, flows, and mockups from a shared foundation.

---

## 1. The Problem We're Solving

The AI-First Operating Framework defines a powerful system: humans plan work in structured GitHub-based "Workspaces," AI employees execute tasks autonomously, and everything is versioned, reviewable, and traceable through PRs.

**But the tools that power this system are hostile to most users:**

| Tool               | What It Does Well                                       | What It Does Poorly                                                                           |
| ------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **GitHub**         | Version control, branching, PRs, code review            | UI designed for developers. Non-technical users can't navigate repos, branches, or diffs.     |
| **Obsidian**       | Local-first markdown editing, file organization, search | No native git integration. No multi-user collaboration story. Requires vault setup knowledge. |
| **VS Code / IDEs** | Full file system + git integration                      | Designed for software engineers. Overwhelming for document editing.                           |

**The gap:** There is no tool that gives non-technical business users the ability to browse, edit, and manage markdown files in a local git-connected workspace with the simplicity of Google Docs or Notion.

**AMP Atlas fills that gap.**

---

## 2. What AMP Atlas Is

**AMP Atlas** is a locally-run desktop application that provides an Obsidian-like interface for managing markdown files within GitHub-connected workspaces — designed so that any non-technical team member can create, edit, organize, and collaborate on structured content.

### Core Concept in One Sentence

> A clean, Notion-like markdown editor that reads/writes local files and handles GitHub (commits, branches, PRs) behind a simple, human-friendly UI.

### What It Is NOT

- Not a web app (runs locally)
- Not a database-backed CMS (reads native files from disk)
- Not a code editor or IDE
- Not a replacement for GitHub (it's a layer on top)
- Not (initially) a general-purpose tool — it's built for the AMP team's internal workflow

---

## 3. Who It's For

### Primary Users: AMP Team Members

These are the people operating within the AI-First Operating Framework:

- **Domain experts** who define workspace content, write project pitches, create playbooks
- **Project planners** who scope work, break down tasks, create reference materials
- **Reviewers** who check AI-generated PRs and edit/merge content
- **AI Operations** (Kristi) who initializes workspaces, defines & maintains structure

### User Profile

- Comfortable with Google Docs, Notion, Slack
- NOT comfortable with: git CLI, terminal commands, branch management, merge conflicts
- Need to work in GitHub-backed repos without knowing they're "using git"
- Want to see their files, edit them, and have changes tracked automatically

---

## 4. The AMP Brand — Applied to Product

### Brand Personality for the App

The AMP brand identity establishes a personality: _"The friend who shows up Tuesday with highlighters and a plan."_

For AMP Atlas, this translates to:

- **Approachable, not intimidating** — git complexity hidden behind familiar patterns
- **Structured, not rigid** — clear organization that doesn't feel bureaucratic
- **Energetic, not overwhelming** — the violet/orange palette signals momentum without visual noise
- **Professional warmth** — cream backgrounds, editorial serif accents, generous spacing

### Design Language

| Element            | Treatment                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| **Color primary**  | Violet (#8B2BFF) — interactive elements, active states, brand accents                                |
| **Color accent**   | Orange (#FF7B00) — highlights, notifications, sparkle moments                                        |
| **Dark surfaces**  | Sidebar uses near-black (#1A1A1A) — anchors the left panel like VS Code/Obsidian                     |
| **Light surfaces** | Cream (#FAF0E6) or white — editor area feels like a document, not an app                             |
| **Headlines**      | PP Neue Montreal Bold — clear, modern, confident                                                     |
| **Accent text**    | PP Editorial New Italic — used sparingly for emphasis (tooltips, empty states, onboarding)           |
| **Body**           | PP Neue Montreal Regular — clean readability for editor content                                      |
| **Icons**          | Simple, 16-20px, consistent stroke weight. The AMP sparkle (4-point star) as a recurring brand motif |
| **Borders**        | Subtle. 1px, low contrast. Let content breathe.                                                      |
| **Corners**        | 8-12px radius on cards/modals, 4px on inputs, full-round on badges                                   |

---

## 5. Information Architecture

### The Mental Model

Users think in terms of **Systems** (which map to GitHub repos/workspaces):

```
AMP Atlas
├── My Systems (dashboard)
│   ├── Learning System
│   ├── Marketing System
│   └── AI Operations System
│
└── Inside a System:
    ├── File Browser (sidebar tree)
    ├── File Editor (center, Notion-like)
    ├── Search (global + within system)
    ├── Git Status (simplified: synced / changes / needs pull)
    └── Actions (commit, push, pull, new branch, create PR)
```

### Key Terminology Mapping

We abstract git/GitHub concepts into friendlier language:

| Technical Term | AMP Atlas Term                      | Why                                                    |
| -------------- | -------------------------------- | ------------------------------------------------------ |
| Repository     | **System**                       | Users think of domain workspaces, not repos            |
| `main` branch  | **Current Version**              | The single source of truth everyone works from         |
| Branch         | **Draft**                        | Non-technical users understand drafts                  |
| Clone / Pull   | **Sync** or **Get Latest**       | Familiar from cloud apps                               |
| Commit         | **Save** (local checkpoint)      | Lightweight — like autosave with a note                |
| Push           | **Publish**                      | Mirrors the Notion/CMS mental model                    |
| Pull Request   | **Review Request**               | Describes the action, not the mechanism                |
| Merge          | **Publish Draft** or **Approve** | What the reviewer/author actually does                 |
| Rebase         | **Update Draft**                 | "Get the latest changes into your draft"               |
| Merge Conflict | **Edit Conflict**                | Describes the problem, not the mechanism               |
| `git stash`    | Never exposed                    | App handles this silently when switching drafts        |
| `git reset`    | **Discard Edits**                | Only for unsaved local changes, with confirmation      |
| Commits ahead  | **"X saves not yet published"**  | Tells users what they have locally that others can't see |
| Commits behind | **"Updates available"**          | Tells users others have made changes they should get   |

---

## 6. Version & Draft Workflow Model

This is the opinionated workflow that governs how users interact with git through AMP Atlas. The goal: give users the power of git branching and version control while making the experience feel like working in Google Docs with a "draft → review → publish" cycle.

### 6.1 Core Concepts

**Current Version** = `main` branch. This is always the live, published, approved state of the System. Every user sees the same Current Version. It is the source of truth.

**Draft** = a branch. When a user wants to make changes, they create a Draft. A Draft is a private working copy that diverges from the Current Version. All edits happen inside Drafts — users should never edit the Current Version directly.

**Save** = a commit. A lightweight checkpoint within a Draft. Users can save as many times as they want. Saves are local until Published.

**Publish** = push. Sends local Saves to GitHub so others (and AI employees) can see them.

**Review Request** = pull request. When a Draft is ready, the user submits it for Review. Reviewers can Approve, Request Changes, or leave Comments.

**Publish Draft** = merge. Once approved, the Draft is merged into the Current Version and the Draft is closed.

### 6.2 The Standard Workflow (Happy Path)

```
Current Version (main)
  │
  ├── User creates "New Draft" ──→ Draft: q2-content-strategy
  │                                  │
  │                                  ├── Edit files
  │                                  ├── Save (commit)
  │                                  ├── Save (commit)
  │                                  ├── Publish (push)
  │                                  ├── Submit for Review (PR)
  │                                  │
  │                                  ├── Reviewer: "Approved" ✓
  │                                  │
  │◄── Publish Draft (merge) ────────┘
  │
  ▼ Current Version now includes those changes
```

**What the user experiences:**

1. User clicks **"New Draft"** — enters a short name (e.g. "Q2 content strategy"). AMP Atlas creates a git branch with a slugified name (`draft/q2-content-strategy`).
2. Toolbar shows: `Draft: Q2 Content Strategy` with a status indicator.
3. User edits files normally. Changes auto-save to disk.
4. When the user wants to checkpoint, they click **Save** — a small modal asks for an optional note (auto-generated if skipped). This creates a git commit.
5. When the user wants others to see their work, they click **Publish**. This pushes to GitHub.
6. When the draft is ready for review, user clicks **"Submit for Review"** — this creates a GitHub PR with a clean summary.
7. Review happens (in AMP Atlas or on GitHub). Once approved, user (or reviewer) clicks **"Publish Draft"** which merges to main.
8. Draft disappears. Current Version is updated.

### 6.3 Draft Status States

At any point, a Draft has a clear status shown in the toolbar:

| Status | What it means | Visual | User action |
| ------ | ------------- | ------ | ----------- |
| **Editing** | User has unsaved edits on disk | Orange dot | Save when ready |
| **Saved** | All edits committed locally, not yet published | Blue dot, "X saves not published" | Publish to share |
| **Published** | All saves pushed to GitHub | Green dot, "Up to date" | Continue editing or Submit for Review |
| **Updates Available** | Current Version has changed since this draft was created | Yellow dot, "Updates available" | Click "Update Draft" to pull in latest |
| **In Review** | Review Request submitted, awaiting feedback | Purple badge | Wait for reviewer |
| **Changes Requested** | Reviewer asked for edits | Orange badge | Make edits, Save, Publish, resubmit |
| **Approved** | Reviewer approved | Green badge | Click "Publish Draft" to merge |
| **Edit Conflict** | Draft conflicts with Current Version | Red dot | Resolve conflicts (guided) |

### 6.4 Handling "Updates Available" (Rebase)

When the Current Version changes while a user is working on a Draft (because someone else's draft was published, or an AI employee merged work), the user sees:

```
┌──────────────────────────────────────────────────┐
│  ⚠ Updates Available                             │
│                                                  │
│  The Current Version has been updated since you  │
│  started this draft. Update your draft to get    │
│  the latest changes.                             │
│                                                  │
│  [View What Changed]    [Update Draft]           │
└──────────────────────────────────────────────────┘
```

**"Update Draft"** performs a git rebase behind the scenes. If there are no conflicts, it's seamless. If there are conflicts, we enter the Edit Conflict flow (6.6).

**This is NOT blocking.** The user can keep working without updating. The notification is persistent but non-intrusive. However, they MUST update before they can Publish Draft (merge).

### 6.5 Drafts from Drafts (Branch from Branch)

This is an advanced case. It should be possible but gently discouraged for most users.

**When it makes sense:** A user is working on a large draft and wants to try an alternative approach without losing their current work. Or, two people need to collaborate on a draft before it goes to the Current Version.

**How it works:**

```
Current Version (main)
  │
  ├── Draft: Q2 Strategy
  │     │
  │     ├── Sub-draft: "Try alternate intro"
  │     │     ├── Edit, Save, Publish
  │     │     └── Publish Sub-draft → merges back into "Q2 Strategy"
  │     │
  │     └── Continue working on Q2 Strategy
  │
  │◄── Publish Draft ──┘
```

**UX treatment:**

- When a user is already on a Draft and clicks "New Draft", show a choice:
  ```
  ┌──────────────────────────────────────────────────┐
  │  Create New Draft                                │
  │                                                  │
  │  ○ From Current Version (recommended)            │
  │    Start fresh from the latest published version │
  │                                                  │
  │  ○ From this Draft: "Q2 Strategy"                │
  │    Branch off your current work-in-progress      │
  │    (advanced — your sub-draft will merge back    │
  │    into this draft, not the Current Version)     │
  │                                                  │
  │                          [Cancel]  [Create]      │
  └──────────────────────────────────────────────────┘
  ```

- Sub-drafts are visually indented under their parent in the Drafts panel.
- Sub-drafts can only be published back into their parent draft, not directly to Current Version. This keeps the hierarchy clean.

### 6.6 Edit Conflicts (Merge Conflicts)

When two drafts edit the same lines of the same file, we get an Edit Conflict. This is the scariest git concept for non-technical users, so we make it as guided as possible.

**When it happens:** User clicks "Publish Draft" or "Update Draft" and git finds conflicts.

**The experience:**

```
┌──────────────────────────────────────────────────┐
│  ⚠ Edit Conflict — 2 files need attention        │
│                                                  │
│  Someone else edited the same parts of these     │
│  files. Choose which version to keep for each.   │
│                                                  │
│  📄 work/projects/q2-strategy/pitch.md           │
│     [View & Resolve]                             │
│                                                  │
│  📄 reference/templates/brief.md                 │
│     [View & Resolve]                             │
│                                                  │
│                          [Cancel]  [I Need Help] │
└──────────────────────────────────────────────────┘
```

**Resolve view** — side-by-side comparison:

```
┌─────────────────────┬─────────────────────┐
│  Current Version    │  Your Draft         │
│                     │                     │
│  The goal is to     │  The goal is to     │
│  produce 2x output  │  produce 3x output  │ ← highlighted difference
│  by Q3.             │  by end of Q2.      │ ← highlighted difference
│                     │                     │
│  [Keep This]        │  [Keep This]        │
│                     │                     │
│              [Keep Both]                  │
└─────────────────────┴─────────────────────┘
```

**Options per conflict:**
- **Keep Current Version** — discard your change for this section
- **Keep Your Draft** — override with your version
- **Keep Both** — include both (user can then edit the merged result)
- **Edit Manually** — open inline editor to write a custom resolution

Once all conflicts are resolved → Save → continue with Publish Draft.

### 6.7 Discard Edits

Two levels of "undo" that we expose:

| Action | What it does | Git equivalent | Confirmation |
| ------ | ------------ | -------------- | ------------ |
| **Discard Unsaved Edits** | Reverts file(s) to the last Save | `git checkout -- <file>` | "Discard edits to pitch.md? You'll lose changes since your last save." |
| **Discard Draft** | Deletes the entire draft and all its saves | `git branch -D` | "Discard draft 'Q2 Strategy' and all 7 saves? This cannot be undone." (with 5-second delay on confirm button) |

**Discard Unsaved Edits** is available per-file (right-click in sidebar → "Discard edits") or for all files ("Discard all unsaved edits" in the Changes panel).

**Discard Draft** is available from the Drafts panel. It's a destructive action with strong confirmation UX.

We do NOT expose: `git reset`, `git revert`, hard resets, or any history rewriting. If a user needs to undo a Save that was already Published, they should make a new Save that reverses the change (or ask for help).

### 6.8 What We Intentionally Hide

| Git concept | Why we hide it | What happens instead |
| ----------- | -------------- | -------------------- |
| Commit hashes | Meaningless to non-technical users | Saves are identified by note + timestamp |
| `git log` / history | Overwhelming | "Draft History" shows saves as a simple timeline |
| Branch names | Users choose a draft name, we slugify it | Shown as readable name, never `draft/q2-content-strategy` |
| Staging area (`git add`) | Confusing two-step process | Save always includes all changed files (like `git add -A && git commit`) |
| Stash | Complex | App silently stashes/restores when switching drafts |
| Rebase vs merge | Theological debate | We always rebase drafts onto Current Version (cleaner history), presented as "Update Draft" |
| Force push | Dangerous | Never exposed. If a rebase requires force push, app handles it silently for the user's own draft |
| Detached HEAD | Terrifying | Prevented by the UI — users can only be on Current Version or a named Draft |
| `git reflog` | Recovery tool for experts | If users lose work, they contact AI Operations for recovery |

### 6.9 Draft Switching

Users may have multiple drafts in progress. Switching between them:

1. User clicks the Draft selector in the toolbar.
2. Dropdown shows: Current Version + all user's drafts with status.
3. User picks a different draft.
4. AMP Atlas silently stashes any unsaved edits, checks out the new draft, and restores any stashed edits on that draft.
5. File tree, editor, and status bar all update.

```
┌──────────────────────────────────────┐
│  Switch Draft                    ▾   │
│  ──────────────────────────────────  │
│  ● Current Version          synced  │
│  ──────────────────────────────────  │
│  ○ Q2 Content Strategy    3 saves   │
│  ○ Fix onboarding docs   published  │
│  ○ New playbook: sales   editing    │
│  ──────────────────────────────────  │
│  + New Draft                         │
└──────────────────────────────────────┘
```

---

## 7. Core User Flows

### Flow 1: First Launch / Onboarding

1. Welcome screen with AMP branding
2. Connect GitHub account (OAuth flow)
3. Select local folder(s) where Systems live (or clone existing)
4. Systems appear on dashboard

### Flow 2: Opening a System

1. From dashboard, click a System card
2. Sidebar loads file tree
3. Draft/version status shows in toolbar
4. Last-edited file opens in editor (or a landing/readme view)

### Flow 3: Editing a File

1. Click file in sidebar tree
2. Opens in Notion-like markdown editor (WYSIWYG or split view)
3. Typing is live — changes saved to local file automatically
4. Unsaved changes indicator in sidebar (orange dot)
5. User clicks **Save** when ready — optional note, or auto-generated
6. User clicks **Publish** to push saves to GitHub

Note: Users should almost always be working on a Draft, not the Current Version. If a user starts editing on the Current Version, prompt them to create a Draft first. (We may allow direct edits to Current Version for AI Operations / admin users as a setting.)

### Flow 4: Creating Content

1. Right-click in sidebar → "New File" or "New Folder"
2. Templates available (brain dump, project pitch, project plan, etc.)
3. File created in correct location on disk
4. Opens in editor immediately

Different flows depending on content type:
- **"New Project"** → creates a project folder in `/work/projects/` with template files (braindump.md, pitch.md, project-plan.md, working/, deliverables/)
- **"New Playbook"** → creates a skill folder in `/.claude/skills/` with SKILL.md template
- **"New File"** → blank markdown file in the selected location

### Flow 5: Reviewing Changes

1. "Changes" panel shows modified/new/deleted files in current draft
2. Click a file to see inline diff (what changed since last save)
3. One-click **Save** with auto-generated note
4. **Publish** sends saves to GitHub

### Flow 6: Draft Lifecycle

1. User clicks **"New Draft"** from toolbar
2. Names the draft (e.g. "Q2 content strategy")
3. Edits files, Saves, Publishes
4. When ready: **"Submit for Review"** creates a Review Request (PR)
5. Status updates: In Review → Changes Requested / Approved
6. Once approved: **"Publish Draft"** merges into Current Version
7. Draft closes. Current Version is updated.

### Flow 7: Search

1. Cmd+K opens command palette / global search
2. Search across all files in current System
3. Results show file name, path, and matching content preview
4. Click to navigate directly

### Flow 8: System Activity Overview (Near-term)

Each System needs an **Activity** or **Overview** tab/panel that surfaces the GitHub collaboration layer — what's happening across all drafts, reviews, and contributors. This is the "GitHub-but-friendly" view.

**What it shows:**

```
┌────────────────────────────────────────────────────────────────┐
│  Learning System — Activity                                    │
│                                                                │
│  YOUR WORK                                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Draft: Q2 Content Strategy          3 saves · Editing   │  │
│  │  Draft: Fix onboarding docs          Published · In Review│  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  NEEDS YOUR REVIEW                                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  🟣 AI Employee: "Update reference templates"            │  │
│  │     Submitted 2h ago · 4 files changed                   │  │
│  │     [Review]                                             │  │
│  │                                                          │  │
│  │  🟣 Lauren: "New sales playbook draft"                   │  │
│  │     Submitted yesterday · 1 new file                     │  │
│  │     [Review]                                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  RECENTLY PUBLISHED                                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ✓ "Weekly schedule update" by AI Employee    — 3h ago   │  │
│  │  ✓ "Project pitch: Q2 webinar" by Kristi      — 1d ago   │  │
│  │  ✓ "Fix typos in onboarding guide" by Lauren  — 2d ago   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ALL OPEN DRAFTS                                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Your drafts (2)                                         │  │
│  │  Lauren's drafts (1)                                     │  │
│  │  AI Employee drafts (0)                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

**Key sections:**
- **Your Work** — your open drafts with status (editing, published, in review, changes requested)
- **Needs Your Review** — review requests assigned to you, with one-click to open the review flow
- **Recently Published** — recent merges to Current Version (who did what, when)
- **All Open Drafts** — visibility into what everyone (including AI employees) is working on

**Scoping question:** Is this a tab within a System (sidebar: Files | Activity) or a panel/section in the sidebar itself? Probably a tab — keeps the sidebar focused on the file tree and puts the activity view in the main content area.

---

## 7. Application Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  ┌──────────┐  Tabs: File1.md | File2.md | +     Draft: Q2 Strategy ▾ │
│  │          │  ┌────────────────────────────────────────────────────│
│  │  SIDEBAR │  │                                                    │
│  │          │  │          EDITOR / CONTENT AREA                      │
│  │  AMP     │  │                                                    │
│  │  Logo    │  │    Markdown rendered as rich text                   │
│  │          │  │    (like Notion / Google Docs)                      │
│  │  Search  │  │                                                    │
│  │  ─────── │  │    Max width ~800px, centered                      │
│  │  📁 ref  │  │                                                    │
│  │  📁 work │  │                                                    │
│  │    📄 f1 │  │                                                    │
│  │    📄 f2 │  │                                                    │
│  │  📁 tools│  │                                                    │
│  │          │  │                                                    │
│  │  ─────── │  ├────────────────────────────────────────────────────│
│  │  Drafts  │  │  ● 3 files changed · 2 saves not published        │
│  │  Status  │  │  [Save]  [Publish]  [Submit for Review]            │
│  └──────────┘  └────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────┘
```

### Layout Principles

- **Sidebar (left, dark):** System name/logo, search, file tree, drafts list with status. Collapsible.
- **Tab bar (top):** Open files as tabs, plus Draft selector dropdown (switch between Current Version and Drafts).
- **Editor (center, light):** Notion-like rich text rendering of markdown. Generous padding, max-width for readability.
- **Status bar (bottom):** Draft status, change count, quick actions (Save, Publish, Submit for Review).
- **Command palette (overlay):** Cmd+K for search, navigation, and actions.

---

## 8. Technical Architecture (High Level)

```
┌───────────────────────────────────────────┐
│              Desktop Shell                │
│              (Electron)                   │
├───────────────────────────────────────────┤
│                                           │
│   Frontend (TypeScript + React)           │
│   ├── File browser / sidebar              │
│   ├── Markdown editor (TipTap, Milkdown,  │
│   │   or similar)                         │
│   ├── Command palette                     │
│   ├── Git status UI                       │
│   └── Settings / Onboarding              │
│                                           │
├───────────────────────────────────────────┤
│                                           │
│   Backend (Python)                        │
│   ├── File system watcher                 │
│   ├── Git operations (via GitPython       │
│   │   or subprocess)                      │
│   ├── GitHub API client                   │
│   │   (PRs, branches, auth)              │
│   ├── Search / indexing                   │
│   └── IPC bridge to frontend             │
│                                           │
├───────────────────────────────────────────┤
│                                           │
│   Local File System (the "database")      │
│   └── User's git repos / workspaces       │
│                                           │
└───────────────────────────────────────────┘
```

### Technology Recommendations

| Layer               | Recommendation                         | Rationale                                                                                |
| ------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Desktop shell**   | **Electron**                           | Familiar React ecosystem, cross-platform (Mac/Windows) support for future needs.         |
| **Frontend**        | **React + TypeScript**                 | Kristi knows it. Huge ecosystem for editor components.                                   |
| **Markdown editor** | **TipTap** or **Milkdown**             | Notion-like WYSIWYG experience. TipTap has the best extension ecosystem.                 |
| **Backend**         | **Python**                             | Per requirements. Handles file system ops, git, GitHub API.                              |
| **Git operations**  | **GitPython** or shell subprocess      | GitPython for programmatic access, subprocess for complex operations.                    |
| **GitHub API**      | **PyGithub** or direct REST            | PRs, branches, auth. OAuth for user connection.                                          |
| **IPC**             | **Electron IPC** or **local HTTP**     | Frontend ↔ backend communication.                                                        |
| **Search**          | **Fuse.js** (frontend) + file indexing | Fast fuzzy search across markdown content.                                               |

---

## 9. Design System Files Created

The following files are in `design-system/`:

| File             | Contents                                                                                                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tokens.css`     | CSS custom properties: colors (full AMP palette with semantic mapping), typography scale, spacing (4px base), border radius, shadows, transitions, layout constants, z-index, dark theme overrides |
| `typography.css` | Font-face declarations for PP Neue Montreal + PP Editorial New, heading styles, body text classes, editor-specific markdown typography                                                             |
| `components.css` | Button variants (primary/secondary/ghost/accent), inputs, sidebar/file tree, tabs, badges, git status indicators, toolbar, command palette, cards, toasts, modals                                  |

---

## 10. What's Next

### Product Roadmap

**Phase 1 — Foundation (MVP)**
1. Design System — Done (CSS tokens, typography, components)
2. UX Flows — Detail core flows with wireframe-level specificity
3. Page Mockups — Build out key screens using the design system
4. Interactive Prototype — Static HTML/CSS of the main views
5. Technical Spike — Prove out Electron + Python backend + file watching
6. MVP Build — File browser + markdown editor + local file read/write

**Phase 2 — Version Control**
7. Draft/Version system — create drafts, save, switch, discard
8. Publish flow — push to GitHub
9. File change indicators (IDE-style yellow/green/red)
10. Real-time detection of external git changes (terminal, AI employees)

**Phase 3 — Collaboration & Review**
11. System Activity Overview — your drafts, review requests, recent publishes, all open drafts (Section 7, Flow 8)
12. Review Request flow — submit for review, see status, approve/request changes
13. In-app review experience — diff view, comments, approve (vs. redirecting to GitHub)
14. Deep linking between documents

**Phase 4 — Content Structure & Templates**
15. Template system — New Project, New Playbook, New Skill flows with scaffolding
16. Frontmatter/properties editor — sidebar panel, uniform per workspace
17. Skill/CLAUDE.md-aware editing with syntax/structure support

**Phase 5 — AI Integration**
18. Inline AI editing / autocomplete (Notion AI / Cursor-like)
19. AI-generated save notes and review summaries
20. CRAFT cycle integration for playbook/skill documentation
21. Feedback capture and logging

**Phase 6 — Admin & Leadership Dashboard**
22. Cross-system overview — status of all Systems at a glance
23. User activity — who has been active, where, when, what they've published
24. AI employee activity — tasks completed, PRs created, review cycle times
25. Skill & workspace health — coverage, staleness, usage metrics
26. ROI metrics — human time saved, task throughput, PR cycle time, token usage (from AI-First Operating Framework Section X)
27. Accountability — review completion rates, open draft age, blocked items

### Resolved Decisions

- **Electron** for desktop shell (familiar React ecosystem, cross-platform)
- **TipTap** for markdown editor (best Notion-like WYSIWYG)
- **Git exposure** — fully opinionated Draft/Version model defined in Section 6. No raw git concepts exposed. Power users use terminal; app detects external git changes in real-time.
- **Merge conflicts** — guided "Edit Conflict" resolution flow with side-by-side comparison (Section 6.6)

### Open Questions for Discussion

1. **AI integration in the editor?** — Given this is an "AI-native operating system," should the editor have inline AI assistance (like Notion AI or Cursor)? Or is that a later phase?
2. **Template system** — The framework defines project structure (brain dump → pitch → plan → tasks). Should AMP Atlas enforce this with templates, or keep it flexible?
3. **Direct edits to Current Version?** — Should we ever allow users to edit/save directly on the Current Version (main) without creating a Draft? Or should Drafts be mandatory? (Possible: allow for AI Operations/admin role only.)
4. **Review in-app vs GitHub?** — Should the full PR review experience (approve, request changes, comment) live inside AMP Atlas, or do reviewers go to GitHub? Hybrid?

## Other Requirements/Ideas

All items below are captured in the phased roadmap above. Keeping this list as the raw brainstorm for reference.

- Ability to "deep link" to other docs (and follow those links) → Phase 3
- Ensure the ability to edit "frontmatter" (properties) on documents (i.e. like a sidebar or something; and also making it 'uniform' per workspace?) → Phase 4
- Ability to edit skills, reference files, claude files, etc. (with native grading, etc.) → Phase 4
- System Activity Overview — open drafts, review requests, recent publishes → Phase 3
- Admin/Leadership Dashboard — cross-system status, user activity, AI employee metrics, ROI → Phase 6
- Future: native claude editing (and or auto-complete) inside the app → Phase 5
- Future: feedback capture and tracking with logging, etc. → Phase 5
- Future: add native "CRAFT" cycles into playbook/skill documentation → Phase 5
