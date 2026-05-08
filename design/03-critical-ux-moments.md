# AMP UP — Critical UX Moments

## What This Document Is

These are the 5 make-or-break moments where our git abstraction gets tested hardest. If we nail these, the product works. If we get any of them wrong, the illusion breaks and Rose goes back to Claude Desktop.

Each moment is written as a scenario from a specific persona's perspective.

---

## Moment 1: "I Was Editing and Someone Else Changed the Same File"

**Persona:** Rose
**Scenario:** Rose is editing the onboarding playbook. She hasn't published yet. Meanwhile, the AI employee also updated the onboarding playbook and its review request was approved and merged by Rachel. The Current Version has changed underneath Rose.

**What happens technically:** Rose's local branch is now behind main. When she tries to publish her draft, there will be a conflict or at minimum a divergence.

**What Rose should experience:**

When Rose next syncs (or when AMP UP detects the change via file watching):

```
┌────────────────────────────────────────────────┐
│  💡 Updates Available                          │
│                                                │
│  The Current Version was updated while you     │
│  were editing. The AI Employee's changes to    │
│  reference templates were approved.            │
│                                                │
│  Your draft isn't affected yet — you can       │
│  keep editing. When you're ready, update       │
│  your draft to include the latest changes.     │
│                                                │
│  [See What Changed]   [Update Draft]   [Later] │
└────────────────────────────────────────────────┘
```

**If no conflict:** "Update Draft" rebases silently. Rose sees "Draft updated" and continues working. She never knows a rebase happened.

**If conflict (same lines edited):**

```
┌────────────────────────────────────────────────┐
│  ⚠ Edit Conflict in 1 file                    │
│                                                │
│  Both you and the AI Employee edited the       │
│  same section of playbook.md. Choose which     │
│  version to keep.                              │
│                                                │
│  📄 playbook.md                    [Resolve]   │
│                                                │
│  💡 Don't worry — your work is safe.           │
│     Nothing has been lost.                     │
└────────────────────────────────────────────────┘
```

**Critical design decisions:**
- **"Don't worry — your work is safe"** must appear prominently. Rose's biggest fear is losing her work.
- **Never use the word "conflict" alone.** Always "Edit Conflict" — describes the situation, not a system error.
- **The resolution view must show the content, not code.** Side-by-side rendered markdown, not raw text with `<<<<<<<` markers.
- **"Later" must be a real option.** Rose can dismiss this and keep working. It's not blocking.
- **Explain WHO changed what.** "The AI Employee's changes" — context about what happened, not just "main diverged."

**What could go wrong:**
- If the notification feels like an error, Rose will panic
- If the conflict resolution looks like a merge tool, she'll give up
- If she loses any of her edits, trust is permanently broken

---

## Moment 2: "I Accidentally Started Editing the Current Version"

**Persona:** Rose
**Scenario:** Rose opens a system and starts editing a file. She never created a draft — she's typing directly on the Current Version (main branch). She doesn't know what a draft is or why she'd need one.

**What should happen:**

The moment Rose makes her first keystroke on a file while on the Current Version:

```
┌────────────────────────────────────────────────┐
│  Create a Draft to save your edits             │
│                                                │
│  To keep your changes organized and safe,      │
│  we'll create a draft for you. Think of it     │
│  as your own working copy — it won't affect    │
│  anyone else until you're ready.               │
│                                                │
│  Draft name:                                   │
│  ┌──────────────────────────────────────┐      │
│  │ Rose's edits — May 5                 │      │
│  └──────────────────────────────────────┘      │
│                                                │
│             [Create Draft & Continue]           │
└────────────────────────────────────────────────┘
```

**Critical design decisions:**
- **Auto-generate a sensible draft name.** "[Name]'s edits — [Date]" as default. She can change it or accept it.
- **One button, not two.** Don't offer "Edit Current Version directly" as an option for Rose. That path leads to force-pushes and tears.
- **Her edits are NOT lost.** Whatever she typed before the modal appeared is preserved. The draft is created with her changes intact.
- **This only happens once per session.** If she's already on a draft, she never sees this.
- **Explain the concept in one sentence.** "Think of it as your own working copy" — that's the entire mental model.

**For Kristi/Rachel (admin option):** A setting to allow direct Current Version editing. They understand the implications. Rose never sees this option.

**What could go wrong:**
- If the modal appears BEFORE she types (preemptive), it's confusing — she doesn't know why she's being asked
- If her typed characters are lost when the draft is created, trust is broken
- If the explanation is too long or technical, she'll just click through without understanding

---

## Moment 3: "I Have Edits in One Draft and Need to Switch to Another"

**Persona:** Kristi
**Scenario:** Kristi is editing the Learning System's CLAUDE.md file on her "skills-refactor" draft. She gets a Slack message from Rachel asking her to look at something in her "workspace-restructure" draft. She needs to switch.

**What should happen:**

Kristi clicks the Draft selector in the toolbar:

```
┌──────────────────────────────────────────┐
│  Switch Draft                        ▾   │
│  ──────────────────────────────────────  │
│  ● Current Version              synced  │
│  ──────────────────────────────────────  │
│  ○ Skills refactor         ● editing    │
│  ○ Workspace restructure   3 saves      │
│  ○ Fix onboarding docs     published    │
│  ──────────────────────────────────────  │
│  + New Draft                             │
└──────────────────────────────────────────┘
```

She sees her current draft ("Skills refactor") has an orange "editing" indicator — meaning she has unsaved edits.

She clicks "Workspace restructure."

**What happens:**
1. AMP UP silently stashes her unsaved CLAUDE.md changes
2. Switches to the "workspace-restructure" branch
3. File tree updates to show that branch's state
4. If "workspace-restructure" had stashed changes from before, they're restored

**What Kristi sees:**
A brief, non-intrusive transition:
```
│  Switching to "Workspace restructure"...        │
│  ✓ Your edits to "Skills refactor" are saved    │
```

The whole thing takes under 2 seconds.

**When she switches back to "Skills refactor":**
Her unsaved CLAUDE.md edits are exactly where she left them. Cursor position restored. Scroll position restored. It's like switching tabs.

**Critical design decisions:**
- **Never ask "Do you want to save first?"** That's a decision burden. Just stash automatically.
- **Show the stash status AFTER switching.** "Your edits are saved" — reassurance, not a question.
- **Restore everything.** Not just file content — cursor position, scroll position, open tabs. It should feel like switching between browser tabs, not reloading an app.
- **The orange "editing" indicator** on the draft selector tells her at a glance which drafts have unsaved work.

**What could go wrong:**
- If the stash fails silently and edits are lost → catastrophic trust failure
- If switching takes more than 2-3 seconds → feels broken compared to terminal `git stash && git checkout`
- If she has to dismiss a "save your work?" dialog every time → she'll avoid switching and manage everything in terminal

---

## Moment 4: "My Team Has Been Active and I Need to Catch Up"

**Persona:** Rachel
**Scenario:** Rachel was heads-down in her own system yesterday. She opens AMP UP this morning to check on the Learning System. Kristi published a workspace restructure, Rose submitted her first review request for a playbook draft, and Hannah created a new project folder.

**What Rachel should see on launch:**

The dashboard has a notification indicator on the Learning System card:

```
┌─────────────┐
│ ✦ Learning  │
│   System    │
│             │
│ 🟣 1 review │
│ 3 updates   │
└─────────────┘
```

She clicks in. The Activity tab shows:

```
┌────────────────────────────────────────────────┐
│  NEEDS YOUR REVIEW                             │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │  Rose: "Onboarding playbook first draft" │  │
│  │  Submitted yesterday · 1 new file        │  │
│  │                              [Review →]  │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  RECENTLY PUBLISHED                            │
│  ┌──────────────────────────────────────────┐  │
│  │  ✓ Kristi: "Restructure reference docs"  │  │
│  │    Published yesterday · 7 files moved   │  │
│  │                                          │  │
│  │  ✓ Hannah: "New project: Q2 webinar"     │  │
│  │    Published yesterday · 4 new files     │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  OPEN DRAFTS                                   │
│  ┌──────────────────────────────────────────┐  │
│  │  Rose: "Onboarding playbook" · In Review │  │
│  │  Kristi: "Skills refactor" · Editing     │  │
│  │  Your drafts: none                       │  │
│  └──────────────────────────────────────────┘  │
└────────────────────────────────────────────────┘
```

**Critical design decisions:**
- **Morning briefing feel.** Rachel should open AMP UP and immediately know what happened. This is her "inbox" — what needs her attention, what's been done, what's in progress.
- **People-first, not files-first.** Show WHO did WHAT, not just a list of changed files. "Rose submitted her first review request" is meaningful; "1 pending PR" is not.
- **One-click to start reviewing.** "Review →" takes her directly to the diff view for Rose's playbook.
- **Celebrate activity.** Showing "Recently Published" signals that the system is working — people are using it, content is being created and shared. This builds Rachel's confidence that adoption is happening.
- **Open Drafts give visibility.** Rachel can see that the team is active and what's in progress, without hovering over anyone.

**The review flow itself:**
- Rachel clicks "Review →"
- Sees the file(s) Rose changed/created
- Reads the playbook Rose wrote — rendered as clean formatted content, not raw diff
- Options: Approve (merges to Current Version) / Request Changes (sends back with a note)
- If she approves: "Published to Current Version. Rose will be notified."

**Why this moment matters for adoption:**
This is where Rachel sees that Rose IS USING THE SYSTEM. Rose — who bounced off Obsidian and GitHub — created a playbook, submitted it for review, and it's waiting for Rachel's approval. The framework is working. Humans are collaborating through version-controlled content without needing to learn git.

**What could go wrong:**
- If she doesn't see the reviews until she navigates to the Activity tab, she might miss them. Needs a banner or badge that's visible from the file editor view too.
- If the review flow requires her to go to GitHub, friction increases 10x. The full review should happen in-app.
- If the activity feed is empty because nobody is using the system yet, it'll feel dead. Consider showing setup activity ("System created," "Files synced") to make it feel alive from day one.

**Future (Phase 5+):** AI employee activity will appear here alongside human activity — "AI Employee submitted 'Draft Q2 blog posts'" — but that's an amplification of the human collaboration patterns established here, not the starting point.

---

## Moment 5: "I Published My Draft but It Broke Something"

**Persona:** Kristi
**Scenario:** Kristi published a draft that reorganized the reference folder structure. After publishing, she realizes she accidentally moved a file that other playbooks link to, breaking internal links. She needs to undo this.

**What she can do:**

Option A — **Fix forward** (preferred path):
1. Create a new draft: "Fix reference links"
2. Move the file back or update the links
3. Save, Publish, Submit for Review (or publish directly if she has admin permissions)

This is the same workflow as any other change. No special "undo" mechanism needed.

Option B — **View what changed** (investigation):
She goes to the Activity tab → "Recently Published" → clicks her merge:

```
┌────────────────────────────────────────────────┐
│  Published: "Reorganize reference folders"     │
│  By: Kristi · 15 minutes ago                   │
│                                                │
│  7 files moved, 2 files modified               │
│                                                │
│  📄 reference/guides/style-guide.md  → Moved   │
│  📄 reference/guides/tone.md        → Moved    │
│  ...                                           │
│                                                │
│                          [Create Fix Draft]     │
└────────────────────────────────────────────────┘
```

"Create Fix Draft" creates a new draft pre-loaded with awareness of what was changed — so she can reverse or correct specific changes.

**What we intentionally DON'T offer:**
- No "revert" button that reverses the entire merge. Too dangerous and hard to understand.
- No `git revert` or `git reset` commands. These create confusing states.
- No "undo publish." Once it's published, it's published. Fix it by moving forward.

**Critical design decisions:**
- **Fix forward, always.** This is the opinionated stance. Reverting is a git-expert operation that creates confusing history. Creating a new draft to fix the issue is clearer and auditable.
- **Make investigation easy.** She should be able to see exactly what her publish changed so she knows what to fix.
- **"Create Fix Draft" is a convenience.** Pre-names the draft, links it to the original publish — reduces friction for the correction workflow.
- **Future: deep link validation.** AMP UP could eventually warn about broken internal links BEFORE publishing. But that's Phase 4+.

**What could go wrong:**
- If Kristi can't see what her publish changed, she can't figure out what to fix
- If the only way to undo is to contact someone with GitHub admin access, trust in the tool breaks
- If "fixing forward" requires 10 steps, she'll just fix it in terminal (which is fine — AMP UP will detect the changes)

---

## Summary: The 5 Moments and What They Teach Us

| Moment | Persona | Core Tension | Design Response |
|--------|---------|-------------|-----------------|
| **Concurrent edits** | Rose | "Did I lose my work?" | Reassurance-first messaging, non-blocking notifications, safe conflict resolution |
| **Editing without a draft** | Rose | "I don't know what a draft is" | Auto-create draft on first edit, one-click, preserve keystrokes |
| **Switching drafts** | Kristi | "Will my work survive the switch?" | Silent stash/restore, tab-like switching speed, visual indicators |
| **Team activity catch-up** | Rachel | "What happened while I was away?" | Morning briefing UX, people-first activity feed, one-click review |
| **Published a mistake** | Kristi | "How do I undo this?" | Fix forward, investigation tools, no dangerous revert buttons |

### Cross-cutting principles from all 5 moments:

1. **"Your work is safe" must be the constant message.** Every scary moment should immediately reassure.
2. **Never block the user.** Notifications and conflicts are non-blocking. The user chooses when to deal with them.
3. **Explain what happened, not what went wrong.** "The AI Employee updated templates" not "main diverged from HEAD."
4. **One-click actions for common responses.** Update Draft, Approve, Create Fix Draft — always one click.
5. **Preserve everything silently.** Cursor position, scroll state, unsaved edits, draft context — the app remembers so the user doesn't have to.
