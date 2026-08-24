# Atlas for L3 Mastery — early access

Welcome. As part of **L3 Mastery**, you're getting early access to **AMP Atlas** — the
desktop app we built to make the AMP way of working actually easy to do.

You've learned the methodology: building playbooks and systems, with humans planning the
work and AI helping execute, all versioned and reviewable in GitHub. Atlas is the tool
that lets you *live* in that method without wrestling with branches, commits, and merge
conflicts. **Drafts** instead of branches. **Save** instead of commit. **Publish** instead
of push. Same trustworthy machinery underneath — none of the developer vocabulary on top.

> **Atlas is open source, and that's the point.** This isn't software we're selling you or an
> app we manage on your machine. It's an opinionated tool for the methodology, and it's
> yours: you **run it from the code**, and you're free to **fork it and make it your own** or
> **contribute back**. Your content lives in your own GitHub repos, in plain Markdown, forever.

---

## 1. Run it from the source

Because Atlas is yours to run (not an app we install for you), you start it from the code.
It works on **macOS, Windows, and Linux**. You'll need two free tools first:

- **[Node.js](https://nodejs.org)** — download the **LTS** version and install it.
- **[git](https://git-scm.com/downloads)** — for getting the code.

Then, in your terminal, run these one line at a time:

```bash
git clone https://github.com/ParrotLab/amp-atlas.git
cd amp-atlas/app
npm install
npm run dev
```

The last command launches Atlas. Keep that terminal window open while you use it.

**To update later:** come back to the `amp-atlas` folder and run `git pull`, then
`npm run dev` again — you'll have the latest version.

> **New to Node, git, or the terminal?** That's okay — install the two tools above, then run
> the four commands in order. If something snags, that's a perfect first
> **[issue to open](https://github.com/ParrotLab/amp-atlas/issues)**: tell us exactly where it
> got stuck and we'll make it smoother for the next person.

---

## 2. Get set up

Once Atlas is running, follow the normal getting-started path:

1. **[Set up your account & your first System](./04-account-and-first-system.md)** — connect
   your GitHub account (a one-time click) and point Atlas at your first System.
2. **[Get your first System onto your computer](./03-getting-your-system-folder.md)** — if you
   don't have a System folder yet, this walks you through cloning a GitHub repo to use as
   one.
3. **[A tour of the app](./05-app-tour.md)** — get your bearings.

New to the core idea? Start with **[Welcome to AMP Atlas](./01-welcome.md)** — it explains the
**Draft → Review → Publish** cycle that everything is built on.

---

## 3. When you get stuck

Atlas is built so you can solve most things yourself:

- Check the **[Troubleshooting & FAQ](../04-reference/02-troubleshooting-faq.md)** first — the
  common hiccups (restart, sign-in, conflicts) have quick self-serve fixes there.
- Still stuck, or found a bug? **[Open an issue](https://github.com/ParrotLab/amp-atlas/issues)** —
  your reports genuinely make Atlas (and these docs) better.

---

## 4. Make it yours

This is the part that makes Atlas different from a product you just consume:

- **Fork it** and shape it into your own version — that's an intended, encouraged use.
- **Contribute back** — if you fix something or add something useful, open a pull request.
  Start with **[CONTRIBUTING](https://github.com/ParrotLab/amp-atlas/blob/main/CONTRIBUTING.md)**
  and browse the [open issues](https://github.com/ParrotLab/amp-atlas/issues).

---

**You should now be able to:** run Atlas from the source, connect your account and first
System, find help when you need it, and — if you want to — fork or contribute to the tool
itself. Welcome to building the AMP way.
