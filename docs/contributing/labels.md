# Issue & PR labels

A small, consistent label set keeps the tracker readable. Here's what each label means and when to use it.

## Type (what kind of issue is this?)

| Label | Use it when |
|---|---|
| `bug` | Something isn't working the way it should. |
| `enhancement` | A new feature, capability, or improvement. *(This is our single label for feature ideas — see the note below.)* |
| `documentation` | The change is only to docs / guides. |
| `question` | Someone needs more information or wants to discuss, not a defect. |

## Triage & status

| Label | Use it when |
|---|---|
| `help wanted` | We'd welcome an outside contributor picking this up. |
| `duplicate` | Already tracked in another issue (link it, then close). |
| `invalid` | Not reproducible, out of scope, or not actually an issue. |
| `wontfix` | A real point, but we've decided not to pursue it (explain why, then close). |

## Consolidation note

We use **`enhancement`** as the single label for all feature ideas and improvements. The older **`feature request`** label overlapped with it (many issues carried both), so `feature request` is **retired** — the "Feature request" issue form applies `enhancement` automatically. If you see an old issue still tagged `feature request`, relabel it to `enhancement`.

## Guidance

- Most issues get **one type label** plus, optionally, one triage/status label.
- Prefer closing with `duplicate` / `invalid` / `wontfix` (with a short reason) over leaving stale issues open.
