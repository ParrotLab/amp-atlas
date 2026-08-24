<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/atlas-logo-light.svg">
  <img src="docs/assets/atlas-logo-dark.png" alt="AMP Atlas" width="320">
</picture>

# AMP Atlas

**An open, opinionated desktop app for building playbooks and systems the AMP way — on top of GitHub, without the developer vocabulary.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)](#run-it)

<!-- Drop a product screenshot/GIF at docs/assets/atlas-hero.png (see docs/assets/README.md) -->
<img src="docs/assets/atlas-hero.png" alt="AMP Atlas screenshot" width="820" />

</div>

---

## What is Atlas

Atlas is a desktop app that replaces Obsidian and sits on top of GitHub. It's built for non-technical people who want to implement AMP's opinionated framework for building playbooks and systems — without wrestling with branches, commits, and merge conflicts.

> **Drafts** instead of branches. **Save** instead of commit. **Publish** instead of push. The same git workflow underneath — no developer vocabulary on the surface.

## Why Atlas (and why it's open)

AMP is a methodology company, not a software company. Atlas isn't a product we're selling — it's an opinionated *enabler* for the way we teach people to build with AI. The usual path (Obsidian plus raw GitHub) is clunky and gets in the way; Atlas makes the methodology easy to actually do.

That's why it's open source. **Use it, fork it and make it your own, or contribute back to make it better.** This is not SaaS — there's no lock-in and no account required to own your work. Your content lives in your own GitHub repos, in plain Markdown, forever.

## Run it

Atlas is open source — you run it from the source, so it's yours, not an app we install for you. It works on **macOS, Windows, and Linux**. You'll need [Node.js](https://nodejs.org) 18+ and git:

```bash
git clone https://github.com/ParrotLab/amp-atlas.git
cd amp-atlas/app
npm install
npm run dev      # launches Atlas
```

To update later, `git pull` and run `npm run dev` again. For a step-by-step walkthrough plus first-System setup, see the [getting-started guide](docs/user-guides/01-getting-started/02-l3-early-access.md).

## How it works

Atlas is a thin, friendly layer over real git:

- Each **System** is one of your GitHub repos, on your machine.
- You write in a clean Markdown editor with a frontmatter properties drawer.
- **Save** commits, **Publish** opens a pull request, **Review** shows the diffs and approvals.
- Everything stays versioned and traceable in GitHub — Atlas just hides the plumbing.

Sign-in is GitHub OAuth (device flow) — no `gh` CLI and no manual tokens.

## Documentation

User guides live in **[`docs/user-guides/`](docs/user-guides/README.md)**:

- [Getting started](docs/user-guides/01-getting-started/01-welcome.md)
- [Core concepts](docs/user-guides/02-core-concepts/01-operating-model.md)
- [Everyday workflows](docs/user-guides/03-everyday-workflows/01-editing-basics.md)
- [Reference & troubleshooting](docs/user-guides/04-reference/02-troubleshooting-faq.md)

*A hosted docs site is on the roadmap.*

## Contributing

Contributions are welcome — Atlas is meant to be built on. Start with **[CONTRIBUTING.md](CONTRIBUTING.md)** and browse the [open issues](https://github.com/ParrotLab/amp-atlas/issues).

Running locally is covered in [Run it](#run-it) above. To produce a production build, use `npm run build`.

## Tech stack

- **Electron** + **electron-vite** (build / hot reload)
- **React 19** + react-router (HashRouter)
- **TipTap 3** editor
- **simple-git** for repo operations; **GitHub REST API** + OAuth device flow for pull requests
- **gray-matter** (frontmatter), **turndown** + **markdown-it** (HTML <-> Markdown)
- Storage: `localStorage` for settings; your filesystem and GitHub for everything else (no database)

## Roadmap & issues

Track work, file bugs, and suggest ideas in **[Issues](https://github.com/ParrotLab/amp-atlas/issues)**.

## License

[MIT](LICENSE) © Parrot Lab (AMP - AI Momentum Protocols). Fork it, ship it, make it yours.

## Acknowledgments

Built on [Electron](https://www.electronjs.org/), [TipTap](https://tiptap.dev/), [simple-git](https://github.com/steveukx/git-js), and the broader open-source community.
