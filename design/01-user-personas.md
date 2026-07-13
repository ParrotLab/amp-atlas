# AMP Atlas — User Personas

## Why These Personas Exist

These are based on the real humans who will use AMP Atlas. Every design decision should be tested against: "Would Rose understand this? Would Kristi feel slowed down by this? Would Rachel trust this enough to use it daily?"

---

## Persona 1: Rose / Hannah — "The Domain Expert"

**Role:** Manager + IC hybrid. Creates playbooks, runs projects, writes documentation.
**Technical comfort:** Low-to-moderate. Comfortable with Google Docs, Notion, Slack, Claude Desktop.
**Git experience:** None. Tried GitHub Desktop — found file editing confusing. Tried Obsidian — liked the concept but plugins were finnicky, hidden `.claude` files caused friction, and it felt like "one more tool to configure."

### What she does today
- Uses Claude Desktop to draft content and work on playbooks
- Views and edits files using native macOS file viewers
- Avoids GitHub entirely — doesn't understand branches, commits, or PRs
- Receives finished work from Kristi or Rachel and reviews it in whatever format they send

### What she needs
- To see her system's files in a clean, organized view — like opening a Notion workspace
- To edit markdown files without thinking about markdown syntax
- To save her work and know it's safe, versioned, and shareable
- To understand when someone (or an AI employee) has made changes she should look at
- To submit her work for review without learning git

### Her emotional arc with current tools
```
Excitement          "Oh cool, we're          "Wait, I need to        "I'll just use
about AI   →→→→     organizing everything" →→  install plugins and  →→  Claude Desktop
                                               learn GitHub?"          and skip this"
```

### What would make her love AMP Atlas
- Opens it, sees her Systems, clicks one, sees files she recognizes
- Clicks a file, it looks like a Google Doc
- Edits, clicks Save, done
- Never sees the word "git", "branch", "commit", or "merge"
- Submits her playbook for review — Rachel approves it — Rose feels like a real contributor to the system
- Can see what Kristi and Rachel published this week — the team's work is visible and connected
- Thinks: "Oh, this is like Notion but connected to everything"

### Design principles for Rose
- **Zero configuration.** It works the moment she opens it.
- **Familiar patterns.** If it looks like Google Docs or Notion, she'll know what to do.
- **No jargon.** Every label must pass the test: "Would Rose understand this without explanation?"
- **Progressive disclosure.** Don't show her git features she doesn't need. Let the app handle complexity silently.
- **Visible value.** She needs to SEE why this is better than just using Claude Desktop + Finder. The organization, the version history, the review flow — these are the selling points.

### Her risk to the product
If Rose opens AMP Atlas and it feels like "another developer tool," she will close it and never come back. She's already been burned by Obsidian and GitHub Desktop. We get one shot.

---

## Persona 2: Kristi — "The System Builder"

**Role:** AI Operations lead. Builds workspace structure, maintains skills, creates the systems that others work inside.
**Technical comfort:** High. Python, React, terminal git, Anthropic SDK, MCP servers.
**Git experience:** Daily user. Prefers git CLI in terminal. Uses GitHub web for PRs and reviews. Doesn't use GitHub Desktop.

### What she does today
- Manages workspace repos via terminal git (clone, branch, commit, push, PR)
- Edits markdown in Obsidian — likes the live preview and file organization
- Uses VS Code for code and Claude Code for AI-assisted development
- Reviews AI employee PRs on GitHub web
- Sets up new workspaces, configures CLAUDE.md files, creates skills

### What she needs
- To keep using her terminal for git when she wants to (AMP Atlas must detect and reflect external changes)
- A faster way to browse and edit workspace content than switching between Obsidian + terminal + GitHub
- To see the IDE-style file change indicators she's used to (modified/new/deleted coloring)
- To review AI employee output efficiently — see what changed, approve or request fixes
- To manage workspace structure (create folders, templates, skills) without leaving the app

### Her emotional arc with current tools
```
Productive         "I can do everything     "But switching between    "And Rose can't use
with terminal →→   I need" →→→→→→→→→→→→     3 apps is annoying" →→   any of this, so I
                                                                      end up doing her
                                                                      work too"
```

### What would make her love AMP Atlas
- All-in-one: file browsing + markdown editing + git status + review — in a single window
- Doesn't fight her terminal workflow. She can `git commit` in terminal and see it reflected in AMP Atlas instantly
- The editor is as good as Obsidian's for markdown preview
- She can hand AMP Atlas to Rose and say "use this" and Rose can actually do it
- Admin features let her see what's happening across systems without checking GitHub manually

### Design principles for Kristi
- **Don't slow her down.** Keyboard shortcuts, command palette, fast file switching.
- **Show the details she wants.** File change status, draft/save counts, diff views. She'll use them.
- **Respect her existing workflow.** Terminal git must coexist seamlessly.
- **Give her admin tools.** She's the one setting up systems — she needs structural power (create templates, manage workspace config, see activity across systems).
- **Make her colleagues self-sufficient.** The biggest value for Kristi is that Rose and Hannah can finally work in these systems WITHOUT Kristi doing it for them.

### Her risk to the product
If the editor or file browser is worse than Obsidian, she'll stick with Obsidian. If the git integration is slower or less reliable than terminal, she'll ignore it. The bar is high because she already has a working (if fragmented) workflow.

---

## Persona 3: Rachel — "The CEO Power User"

**Role:** CEO and co-founder. Works deeply within her own systems. Creates strategy docs, reviews work, makes decisions.
**Technical comfort:** High. Understands git, can use terminal, but prefers tools that feel polished and effortless.
**Git experience:** Moderate-to-high. Capable but doesn't want to think about it.

### What she does today
- Works primarily in her own domain systems (strategy, business ops)
- Writes and edits content directly
- Reviews PRs when flagged
- Wants things to "just work" — has the technical understanding to troubleshoot but shouldn't have to

### What she needs
- Her systems to feel like her private workspace — clean, fast, focused
- To edit and publish without friction
- To see at a glance what needs her attention (review requests, updates from AI employees)
- To trust that versioning is happening automatically
- Eventual admin/leadership view showing activity and ROI across all systems

### Her emotional arc with current tools
```
"I can figure       "But I don't want to     "I want the power      "And I want to see
out anything" →→    figure out everything" →→  of git without the →→  that this whole
                                               ceremony of git"       system is working"
```

### What would make her love AMP Atlas
- Opens her system, picks up where she left off
- Editing feels like writing in a premium app — clean typography, generous whitespace, no visual noise
- Save and Publish are one or two clicks
- "Needs Your Review" badge tells her exactly what to look at
- Down the road: a dashboard showing "here's what your team and AI employees accomplished this week"

### Design principles for Rachel
- **Premium feel.** The AMP brand should come through — this should feel like a product she'd be proud to show to clients.
- **Speed to value.** Don't make her configure anything. She should be productive in under 60 seconds.
- **Surface what matters.** Review requests, activity, status. Don't make her go looking for information.
- **Trust through transparency.** She should always understand what state her work is in (saved, published, in review) without checking GitHub.
- **Leadership visibility (future).** She will eventually need to see the ROI story — how much is getting done, by whom, how fast.

### Her risk to the product
If it doesn't feel polished, she won't advocate for it. Rachel is the CEO — if she doesn't use it, nobody will be required to. The quality bar isn't just functional, it's aesthetic and experiential.

---

## Persona Summary Matrix

| | Rose/Hannah | Kristi | Rachel |
|---|---|---|---|
| **Primary goal** | Edit content, submit for review | Build systems, review AI output, enable others | Create strategy docs, review, see big picture |
| **Git comfort** | None | Expert (terminal) | Capable but doesn't want to |
| **Current pain** | Too many tools, all confusing | Fragmented workflow, doing others' work | Wants polish + power without ceremony |
| **Must never see** | Git jargon, config steps, terminal | Broken file sync, slow editor | Unfinished UI, manual processes |
| **"I love this" moment** | "It's like Notion but for our systems" | "Rose can finally do this herself" | "The team is actually using this and I can see it" |
| **Biggest risk** | Bounces on first bad experience | Rejects if editor/git is worse than current tools | Won't champion it if it feels unpolished |
| **Power features** | Templates, WYSIWYG editing | Keyboard shortcuts, command palette, admin tools | Activity overview, leadership dashboard |
| **Success metric** | Uses AMP Atlas instead of Claude Desktop for content work | Stops doing Rose's git work for her | Opens AMP Atlas daily without being asked |
