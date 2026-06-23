# AMP UP

Internal desktop app for the AMP (AI Momentum Protocols) team — an Obsidian-like markdown editor that sits on top of GitHub, designed for non-technical users.

> **Drafts** instead of branches. **Save** instead of commit. **Publish** instead of push. Same git workflow underneath, no developer vocabulary on the surface.

For the product context, see [`PROJECT-SYNTHESIS.md`](./PROJECT-SYNTHESIS.md).

---

## Status

Functional alpha. End-to-end loop works against real GitHub repos:

- ✅ Multi-system (multi-repo) sidebar, add/rename/remove + icon & color picker
- ✅ Dashboard with system cards, Jump Back In, recently edited
- ✅ TipTap-based markdown editor with frontmatter properties drawer
- ✅ Draft workflow (create / switch / save / discard / publish) over real `simple-git`
- ✅ Publish modal with diff summary against Live Version, reviewer selection
- ✅ PR creation via `gh` CLI on publish
- ✅ Inbox listing open PRs across all configured systems
- ✅ Review page: per-file expandable diff, Final/Changes toggle, per-file "✓ Reviewed" check-off, gated Approve / Request Changes

### Known stopgaps (before shipping to non-technical users)

- **`gh` CLI dependency** — PR create / list / diff / review all shell out to `gh`. Needs replacement with GitHub OAuth + REST API so users don't need `gh` installed and authed. (`app/src/main/index.ts:239`, `app/src/renderer/pages/SystemOverview.tsx:198`)
- **Reviewer mapping** — Display name → GitHub username is hardcoded in main. Needs a real team config. (`app/src/main/index.ts:249`)
- **Token storage** — When OAuth lands, use Electron `safeStorage` (or `keytar`) for the token.

---

## Tech stack

- **Electron** (main process) + **electron-vite** for build / HMR
- **React 19** + **react-router-dom** (HashRouter) in the renderer
- **TipTap 3** for the editor + Final-view rendering
- **simple-git** for repo ops; **`gh` CLI** for PR ops (stopgap, see above)
- **gray-matter** for YAML frontmatter; **turndown** + **markdown-it** for HTML ↔ Markdown
- Storage: `localStorage` for system list / settings; user's filesystem for everything else (no DB)

---

## Run it locally

### Prerequisites

- Node 18+
- `gh` CLI installed and authed (`gh auth status` should show a token with `repo` scope) — required for PR features
- A local clone of any repo you want to use as a "system"

### Setup

```bash
cd app
npm install
npm run dev
```

`npm run dev` launches the Electron window with HMR for the renderer. Main-process changes require a restart.

Add a system from **Settings** in the sidebar: pick a folder on disk that's a git repo with a GitHub remote, give it a name and color/icon, and it'll show up everywhere.

### Build

```bash
cd app
npm run build      # type-check + bundle main/preload/renderer
npm run preview    # run the production build
```

Production packaging (electron-builder, code signing, auto-update via GitHub Releases) is not yet wired — see [`memory/reference_electron_build.md`](#) in personal notes for the planned setup.

---

## Repo layout

```
amp-up-app/
├── app/                      # The Electron app
│   ├── src/
│   │   ├── main/index.ts     # Main process — IPC handlers, git/gh ops
│   │   ├── preload/index.ts  # Bridge API exposed to renderer (window.api)
│   │   └── renderer/
│   │       ├── App.tsx       # Router
│   │       ├── pages/        # Dashboard, Inbox, Review, SystemOverview, Settings
│   │       ├── components/   # Sidebar, FileTree, StatusBar, modals, etc.
│   │       └── utils/        # systemStore (localStorage), markdown helpers
│   └── electron.vite.config.ts
├── design/                   # Personas, journey maps, mockups
├── design-system/            # Fonts, tokens, typography, preview.html
├── docs/                     # Implementation plans
└── PROJECT-SYNTHESIS.md      # Product vision + brand + requirements
```

### Routes

| Path                                 | Page          |
|--------------------------------------|---------------|
| `/`                                  | Dashboard     |
| `/inbox`                             | Inbox (open PRs across all systems) |
| `/review/:systemId/:prNumber`        | Review (file diffs + approve / request changes) |
| `/system/:systemId`                  | System overview / editor |
| `/settings`                          | Settings — manage systems |

---

## Design language

- Light warm sidebar (`#FEFCF9`), cream backgrounds (`#F5F0EB`), white floating cards
- Plum / violet / orange / lavender accents on cream
- 16px radius cards, soft shadows, no harsh borders
- PP Neue Montreal (UI) + PP Editorial New (display) — bundled in `app/src/renderer/assets/fonts`
- Non-technical vocabulary everywhere: **Draft**, **Save**, **Publish**, **Live Version**

See `design/00-design-guide.md` and `design-system/preview.html` for the full system.
