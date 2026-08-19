# Contributing to AMP Atlas

Thanks for being here. Atlas is open on purpose — it's meant to be **used, forked, and built on**. Whether you want to fix a bug, improve the docs, or add a feature, you're welcome.

This is not a SaaS product with a company backlog you're waiting on. It's an opinionated tool for building playbooks and systems the AMP way, and it gets better when the people who use it shape it.

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) first — it applies to every interaction here.

## Ways to contribute

- **Report a bug** — open a [Bug report](https://github.com/ParrotLab/amp-atlas/issues/new?template=bug_report.yml).
- **Request a feature** — open a [Feature request](https://github.com/ParrotLab/amp-atlas/issues/new?template=feature_request.yml).
- **Improve the docs** — the user guides live in [`docs/user-guides/`](docs/user-guides/README.md).
- **Write code** — start with a [good first issue](https://github.com/ParrotLab/amp-atlas/labels/good%20first%20issue).

> For anything larger than a small fix, **open an issue first** so we can align on the approach before you invest time.

## Development setup

**Prerequisites:** Node 18 or later, git, and a GitHub account.

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/<your-username>/amp-atlas.git
cd amp-atlas/app
npm install
npm run dev        # launches the app with hot reload
```

Run the test suite before and after your change:

```bash
npm test           # vitest, single run
npm run test:watch # watch mode while developing
```

Build a production bundle with `npm run build`. The repo layout and tech stack are described in the [README](README.md).

## How we work

**Branch names** use a type prefix:

- `feat/<short-name>` — a new feature
- `fix/<short-name>` — a bug fix
- `docs/<short-name>` — docs only
- `chore/<short-name>` — tooling, deps, cleanup

**Commit messages** follow `type: short summary` (e.g. `fix: clear stale git lock before publish`).

**Pull requests:**

1. Keep each PR focused on one thing.
2. Fill out the PR template — it's short, and it tells the reviewer what to look at.
3. Link the issue it closes (`Closes #123`).
4. Make sure `npm test` passes and add tests for new behavior where it makes sense.
5. Update docs if your change affects how people use Atlas.

## A design principle to keep in mind

Atlas deliberately hides developer vocabulary from its users: it says **Draft** (not branch), **Save** (not commit), **Publish** (not push), **Live Version** (not main). When you touch user-facing copy or UI, please preserve that plain-language experience — it's core to who Atlas is for.

## Licensing

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE) that covers this project.
