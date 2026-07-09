# MVP Manual Testing Checklist

Run this end-to-end pass once all MVP workstreams are built, before cutting the first real signed release. Automated tests (`npm test`) already cover unit logic — this list is the human/UI/integration behavior that only a real run in `npm run dev` (and eventually the packaged `.dmg`) can confirm.

Check items off as they pass. Note the date/build tested.

---

## Collision prevention

- [ ] **Awareness banner appears** — Create two drafts that edit the **same** file. Publish one as a PR. Open that file in the *other* draft → a soft amber banner names the PR's author ("… also has edits to this file in review").
- [ ] **Banner refreshes on window focus** — With the file open, switch away from the app and back → the banner re-fetches (appears/updates without reopening the file).
- [ ] **Banner shows display name** — The banner shows the author's GitHub display name (falls back to their login if they have no name set).
- [ ] **Banner is dismissible & non-blocking** — Dismiss it; editing and publishing still work normally.
- [ ] **Clean update auto-merges** — With two drafts editing *different parts* of the same file, publish the second → it succeeds (the draft is silently brought up to date with the Live Version first, no conflict).
- [ ] **Real overlap escalates calmly** — With two drafts editing the *same lines*, publish the second → the calm ConflictModal appears ("The Live Version changed while you were working… contact your team lead"). **No git jargon shown.**
- [ ] **Draft is safe after a conflict** — After that modal, confirm the draft's contents are exactly as left, and nothing was pushed. Dismiss ("Got it") and keep working; retry publish later succeeds once the upstream overlap is resolved.
- [ ] **Offline degrades gracefully** — With no network, opening a file (banner silently absent) and publishing (proceeds against local base) both still work.

---

<!-- Add sections here as each remaining MVP workstream lands (safety/support surface, offline capability state, templates, etc.) -->
