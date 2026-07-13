# AMP Atlas — First Experience Journey Map

## Focus: Rose's First 30 Minutes

Rose is the hardest persona to win. If the first experience works for her, it works for everyone. This journey map follows her from first launch through her first meaningful edit-save-publish cycle.

---

## Pre-conditions

- Kristi has already set up Rose's local machine: the workspace repos are cloned to a folder on her computer
- AMP Atlas is installed (Kristi sent her a download link)
- Rose has a GitHub account (Kristi helped her create one during onboarding)
- Rose needs to update a playbook she's been working on in Claude Desktop

---

## The Journey

### Stage 1: First Launch (Minutes 0-3)

**What happens:**
Rose double-clicks AMP Atlas for the first time.

**What she sees:**
```
┌────────────────────────────────────────────────┐
│                                                │
│         [AMP Logo]                             │
│                                                │
│    Welcome to AMP Atlas                           │
│                                                │
│    Your workspace for creating,                │
│    editing, and sharing content                 │
│    across your team's systems.                  │
│                                                │
│    Let's get you set up.                        │
│                                                │
│         [Get Started]                           │
│                                                │
└────────────────────────────────────────────────┘
```

**Step 1: Connect GitHub**
- "Connect your GitHub account so your work stays synced with your team."
- One button: [Connect with GitHub] → OAuth popup → done
- She doesn't need to understand WHY GitHub. The framing is "synced with your team."

**Step 2: Choose your Systems folder**
- "Where do your Systems live on this computer?"
- [Browse...] → she selects the folder Kristi told her to use
- AMP Atlas scans for git repos in that folder
- "Found 3 systems:" → shows Learning System, Marketing System, AI Operations

**Step 3: Done**
- "You're all set. Here are your Systems."
- Lands on the dashboard.

**Rose's feeling:** "That was easy. Three clicks and I'm in."

**Design risk:** If the GitHub OAuth flow feels "developer-y" or fails, she'll get stuck. The OAuth popup should be the ONLY screen she sees — no token entry, no SSH keys, no manual config.

---

### Stage 2: Dashboard — Seeing Her Systems (Minutes 3-5)

**What she sees:**
The dashboard with her System cards. Each card shows the system name, file count, and sync status.

```
┌─────────────────────────────────────────────────┐
│  AMP Atlas                                    ⚙️   │
│                                                 │
│  My Systems                                     │
│                                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌────────────┐│
│  │ ✦ Learning  │ │ ★ Marketing │ │ ⚙ AI Ops   ││
│  │   System    │ │   System    │ │   System   ││
│  │             │ │             │ │            ││
│  │ ● Synced    │ │ ● Synced    │ │ ● Synced   ││
│  │   47 files  │ │   23 files  │ │   112 files││
│  └─────────────┘ └─────────────┘ └────────────┘│
│                                                 │
│  + Add System                                   │
└─────────────────────────────────────────────────┘
```

**What she does:** Clicks "Learning System" — the one she works in most.

**Rose's feeling:** "Oh nice, this looks like a home screen. I can see my stuff." The cards are clean, branded, familiar. This feels like opening Notion and seeing her workspaces.

**Design risk:** If the cards show git information (branch names, commit hashes, "3 commits ahead"), she'll feel lost immediately. Keep it simple: name, status (Synced / Updates Available), file count.

---

### Stage 3: Inside a System — The File Tree (Minutes 5-8)

**What she sees:**
The main app layout. Dark sidebar with file tree. Light editor area.

First time entering a system, we show a brief orientation:

```
┌─────────────────────────────────────────────────┐
│  💡 Quick tip                                   │
│                                                 │
│  Your files are on the left. Click any file     │
│  to open it. Your edits are saved automatically │
│  to your computer.                              │
│                                                 │
│  When you're ready to share your changes with   │
│  the team, click "Save" then "Publish."         │
│                                                 │
│                              [Got it]           │
└─────────────────────────────────────────────────┘
```

She dismisses the tip. She sees the file tree.

**What she recognizes:**
- Folders she knows: `reference/`, `work/projects/`
- Files she's worked on before (she edited them via Claude Desktop)
- The structure matches what's on her computer in Finder

**What she does:** Clicks on `work/projects/onboarding-playbook/` → clicks `playbook.md`

**Rose's feeling:** "Okay, I see my files. This makes sense — it's like Finder but nicer."

**Design risk:** If hidden files show up (`.git/`, `.claude/`, `.DS_Store`), it'll look technical and scary. These must be hidden by default. The `.claude/skills/` folder IS visible but labeled cleanly — maybe as "Skills" or "Playbooks" in the sidebar.

---

### Stage 4: Editing a File (Minutes 8-15)

**What she sees:**
The file opens in the editor. It renders as rich text — headings are big, bullet lists look like bullet lists, bold is bold. It looks like a Google Doc, not a code file.

```
┌─────────────────────────────────────────────────┐
│  📄 playbook.md                                 │
│  work/projects/onboarding-playbook              │
│─────────────────────────────────────────────────│
│                                                 │
│  Onboarding Playbook                            │
│  ═══════════════════                            │
│                                                 │
│  Overview                                       │
│  ────────                                       │
│  This playbook guides new team members through  │
│  their first two weeks at AMP...                │
│                                                 │
│  Week 1 Checklist                               │
│  ────────────────                               │
│  • Set up development environment               │
│  • Complete security training                   │
│  • Meet with team leads                         │
│  • Review company playbooks                     │
│                                                 │
└─────────────────────────────────────────────────┘
```

**What she does:**
- Reads the content (looks familiar — she wrote some of this in Claude Desktop)
- Clicks into a paragraph and starts typing. A cursor appears. She edits.
- She adds a new bullet point to the checklist
- She fixes a typo in the overview

**What she notices:**
- The file name in the sidebar subtly changes color (yellow) — indicating it's been edited
- A small dot appears next to the filename
- The status bar says "Unsaved edits"

**Rose's feeling:** "This is just like editing a doc. I like this." She's not thinking about git, markdown, or file formats. She's just writing.

**Design risk:** If the editor shows raw markdown syntax (`## Heading`, `- bullet`, `**bold**`), it breaks the illusion. The WYSIWYG rendering must be excellent. She should never see a `#` unless she chooses a "source view" mode.

---

### Stage 5: The First Save (Minutes 15-18)

Rose has made her edits. She looks for how to save.

**What she sees:**
The status bar at the bottom:
```
│  ● 1 file edited                    [Save]  │
```

She clicks **Save**.

**What happens:**
A small, friendly modal:
```
┌────────────────────────────────────────────┐
│  Save your changes                         │
│                                            │
│  Add a note (optional):                    │
│  ┌──────────────────────────────────────┐  │
│  │ Updated onboarding checklist         │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  💡 Your changes are saved to your         │
│     computer. Click "Publish" when you're  │
│     ready to share with the team.          │
│                                            │
│                    [Cancel]  [Save]         │
└────────────────────────────────────────────┘
```

She types a quick note — or skips it (auto-generated: "Updated playbook.md"). Clicks Save.

**What she sees after saving:**
- Status bar updates: "Saved · Not yet published"
- The file color in sidebar stays yellow but gets a small checkmark or the dot changes
- A subtle confirmation: "Changes saved"

**Rose's feeling:** "Save with a note. That makes sense." She's done a git commit without knowing it.

**Design risk:** If we ask for too much (commit message format, file selection, branch name), she'll feel overwhelmed. The note must be OPTIONAL with a good auto-generated default. One text field, one button.

---

### Stage 6: The First Publish (Minutes 18-22)

Rose notices the status bar still says "Not yet published."

**What the status bar shows:**
```
│  ✓ Saved · Not yet published        [Publish]  │
```

She clicks **Publish**.

**What happens:**
Quick confirmation (no modal needed — just a brief progress indicator):
```
│  Publishing...                                  │
│  ✓ Published · Up to date                       │
```

**What she sees after publishing:**
- Status bar: "Published · Up to date" with a green dot
- The file's yellow color in the sidebar returns to normal (no more unsaved indicator)
- She did a git push without knowing it

**Rose's feeling:** "Cool, my team can see my changes now." Clean, simple, done.

**Design risk:** If publishing fails (network error, auth expired), the error message must be human-readable: "Couldn't publish — check your internet connection and try again." Never: "fatal: Authentication failed for 'https://github.com/...'"

---

### Stage 7: Seeing a Teammate's Work (Minutes 22-28)

Rose finishes her edits. She notices on the Activity tab (or a subtle banner) that Rachel published changes to the same system earlier today.

**What Rose sees:**
```
┌────────────────────────────────────────────────┐
│  📬 Recent activity in Learning System         │
│                                                │
│  Rachel published "Q2 strategy updates"        │
│  3 files changed · 2 hours ago      [View]     │
│                                                │
│  Kristi submitted a review request:            │
│  "Updated onboarding checklist"                │
│  1 file changed                     [Review]   │
└────────────────────────────────────────────────┘
```

**What she realizes:** Other people are working in this system too. Their changes are visible. The system is alive — it's not just a folder on her computer, it's a shared workspace with version history and accountability.

She clicks **Review** on Kristi's request.

**What she sees:**
A clean review view showing what changed:
```
┌────────────────────────────────────────────────┐
│  Review Request: "Updated onboarding checklist"│
│  By: Kristi · Submitted 1 hour ago             │
│  1 file changed                                │
│────────────────────────────────────────────────│
│                                                │
│  📄 reference/guides/onboarding.md  Modified   │
│                                                │
│  Click the file to see what changed.           │
│                                                │
│           [Request Changes]  [Approve]         │
└────────────────────────────────────────────────┘
```

She clicks the file, sees a simple diff:
- Left side: "Before" (current version)
- Right side: "After" (proposed changes)
- Changed lines highlighted

She reviews, everything looks good. Clicks **Approve**.

**What happens:**
- "Changes approved and published to the Current Version."
- The review request disappears from her queue
- The affected files are updated in her file tree

**Rose's feeling:** "I can see what everyone's working on, and I just reviewed Kristi's changes without leaving this app. This actually feels like we're collaborating." This is the moment she sees the value — not a folder of files, but a living team workspace where everyone's contributions are visible and organized.

**Design risk:** The diff view must be EXTREMELY simple. Not a GitHub-style unified diff with `+` and `-` lines. A side-by-side visual comparison with highlighted changes and plain English: "This section was added" / "This paragraph was changed."

---

### Stage 8: End of First Session (Minutes 28-30)

Rose closes AMP Atlas. She'll open it again tomorrow because she has another playbook to update.

**What she's thinking:**
- "That was actually nice to use"
- "I can see all my files, edit them like a doc, and share my work"
- "I can see what Rachel and Kristi are doing in this system too"
- "I reviewed Kristi's changes and approved them — I feel like part of the team"
- "I didn't have to ask Kristi for help once"

**Success criteria met:**
- [x] Zero configuration beyond onboarding
- [x] Edited a file without seeing markdown syntax
- [x] Saved and published without understanding git
- [x] Saw teammate activity and reviewed a colleague's changes
- [x] Never saw the words: git, branch, commit, merge, push, pull, repository

---

## Emotional Arc Summary

```
Minute:  0        3        5        8        15       18       22       28      30
         │        │        │        │        │        │        │        │       │
Feeling: Cautious Relieved Oriented Familiar Confident Satisfied Connected  Sold
         │        │        │        │        │        │        │        │       │
         "Another "That    "I see   "This is "I just  "Done,   "I can   "I'll
         tool..."  was      my       like a   edited   team     see what  use
                   easy"    files"   doc"     like     can see  everyone  this
                                             normal"  it now"  is doing" again"
```

---

## Key Design Requirements Surfaced

1. **Onboarding must be 3 steps or fewer.** Connect GitHub, select folder, done.
2. **The editor IS the product for Rose.** If it doesn't feel like Google Docs, nothing else matters.
3. **Save is one click + optional note.** No file selection, no branch creation, no formatting.
4. **Publish is one click with instant feedback.** No confirmation modal needed.
5. **Review requests must be proactive.** Notifications/badges that surface what needs attention.
6. **Diffs must be visual, not textual.** Side-by-side with highlighted blocks, not unified diff format.
7. **Error messages must be human.** "Couldn't publish — check your connection" not "git push failed."
8. **Hidden files must stay hidden.** `.git/`, `.DS_Store`, `.obsidian/` — invisible by default.
9. **First-time tips should orient, not teach.** "Your files are on the left, click to open" — not a tutorial.
10. **Seeing team activity is the "aha moment."** When Rose sees what Rachel published, reviews Kristi's changes, and realizes this is a living shared workspace — not just a folder — that's when she's sold. The value is human collaboration first; AI employee integration amplifies this later.
