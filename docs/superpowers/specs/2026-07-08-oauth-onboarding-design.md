# Design: GitHub OAuth Onboarding + REST (drop the gh CLI)

**Date:** 2026-07-08
**Status:** Approved (pending written-spec review)
**Workstream:** MVP #2 — see [`docs/mvp-planning.md`](../../mvp-planning.md) §4 & §5 and the roadmap.
**Branch:** `feat/oauth-onboarding`

## Background

Today GitHub work depends on the **`gh` CLI** (7 PR handlers shell out to it) and on the user's ambient **git credentials** for push. That means Rose and Hannah must install and auth a CLI — the exact friction this app exists to remove (`mvp-planning.md` §4). This workstream replaces `gh` entirely with a **GitHub OAuth device-flow** sign-in and **REST API** operations, so a non-technical user just clicks "Connect to GitHub," approves in a browser, and everything works — no CLI.

**Decision (§4, confirmed):** one workstream does the *full* replacement — device-flow auth + token + push-via-token + all PR ops via REST + collaborators — and deletes `gh.ts`.

## Constraints & decisions

- **OAuth App** (not a GitHub App), registered under **Parrot Labs**, **device flow enabled**. Public `client_id` shipped in the app (safe; overridable via env for OSS forks). Scopes: **`repo` + `read:org`**.
- **Connect required on first run** (local-only mode stays v2). After connecting once, token loss/expiry drops to a **soft "reconnect" state** (editing/local work still fine; GitHub actions grey out).
- **Git auth via `http.extraheader`** (token base64, per-command; not written to config, not in process args). Assumes HTTPS remotes (GitHub Desktop default); SSH remotes are flagged.
- Electron main's global `fetch` is used for all HTTP (no HTTP dependency).

---

## 1. Config

`src/main/oauthConfig.ts` — exports `CLIENT_ID` (from `process.env.AMP_GITHUB_CLIENT_ID` or the baked-in Parrot Labs client id) and `SCOPES = 'repo read:org'`.

## 2. Device-flow auth (`src/main/githubAuth.ts`)

- `startDeviceFlow(): Promise<{ deviceCode, userCode, verificationUri, interval, expiresIn }>` — POST `https://github.com/login/device/code` with `client_id` + `scope`, `Accept: application/json`.
- `pollForToken(deviceCode, interval): Promise<{ ok, token?, error? }>` — poll POST `https://github.com/login/oauth/access_token` (`grant_type=urn:ietf:params:oauth:grant-type:device_code`) at `interval`, honoring `slow_down`/`authorization_pending`, until `access_token`, `access_denied`, or `expired_token`. On success, store the token (§3).
- `getIdentity(): Promise<{ login, name, avatarUrl } | null>` — `GET https://api.github.com/user` with the token.

## 3. Token storage (`src/main/tokenStore.ts`)

Electron **`safeStorage`** (keychain-encrypted) written to `app.getPath('userData')/auth.bin`:
- `saveToken(token)` (encrypt + set `everConnected` flag), `getToken(): string | null` (decrypt), `clearToken()` (delete file, keep `everConnected`), `hasEverConnected(): boolean`.
- `everConnected` lives in a tiny plaintext marker (`app.getPath('userData')/amp-auth.json`) so first-run (hard gate) is distinguishable from later token-loss (soft reconnect).

## 4. REST client (`src/main/github.ts`)

A thin token-authenticated wrapper over `api.github.com`. `owner/repo` is parsed from the repo's `origin` remote (`parseOwnerRepo(remoteUrl)`, pure & tested — handles `https://…/o/r(.git)` and `git@github.com:o/r(.git)`). Endpoints replacing the `gh` handlers:

| App op | REST |
|---|---|
| create PR + reviewers | `POST /repos/{o}/{r}/pulls` then `POST …/pulls/{n}/requested_reviewers` |
| list open PRs | `GET /repos/{o}/{r}/pulls?state=open` |
| current-branch PR status | `GET /repos/{o}/{r}/pulls?head={o}:{branch}` |
| check merged | `GET /repos/{o}/{r}/pulls/{n}` → `merged` |
| PR files (names) | `GET /repos/{o}/{r}/pulls/{n}/files` |
| PR file diff | same `files` endpoint → parse each file's `patch` (reuse the existing diff-line parser, extracted pure) |
| PR file content | `GET /repos/{o}/{r}/contents/{path}?ref={headSha}` (base64 decode) |
| submit review | `POST /repos/{o}/{r}/pulls/{n}/reviews` (`APPROVE` / `REQUEST_CHANGES`) |
| collaborators (reviewer picker, §5) | `GET /repos/{o}/{r}/collaborators` |

REST results are mapped to the **same shapes the renderer already consumes** (so `Inbox`/`Review`/`StatusBar` need minimal change). Errors return the uniform `{ ok, error }`.

**Field-coverage note:** the `/pulls` *list* endpoint omits some fields the current UI shows — `reviewDecision` (needs `GET …/pulls/{n}/reviews`) and the `additions`/`deletions`/`changedFiles` stats (need `GET …/pulls/{n}`). The mapper fills these with a small per-PR follow-up call for the current-branch PR and the Inbox list (fine at pilot PR counts), and the UI degrades gracefully if a field is absent (e.g. no stats badge) rather than erroring.

## 5. Git push with the token

`git:publish` pushes via `git.raw(['-c', \`http.https://github.com/.extraheader=AUTHORIZATION: basic <base64(x-access-token:token)>\`, 'push', 'origin', <branch>, '--set-upstream'])`. `buildAuthHeader(token)` is pure & tested. If `origin` is SSH, return a friendly error suggesting the HTTPS remote.

## 6. Capability model

`system:capabilities(repoPath)` → `{ ok, isGitRepo, connected }` where `connected = getToken() !== null`. Replaces `ghAvailable`/`ghAuthed`. `StatusBar`/`SystemOverview` gating uses `canUseGitHub = isGitRepo && connected`; the "Connect to GitHub in Settings" nudge becomes "Reconnect to GitHub" when `everConnected` but not currently connected. **`gh.ts` and its test are deleted; all `runGh` imports removed.**

## 7. Onboarding UX

- **First-run gate** (in `App`/`AppLayout`): if `!connected && !everConnected`, render a full **Connect screen** instead of the routes:
  1. "Connect to GitHub" button → `startDeviceFlow()`.
  2. Show the **one-time `userCode`** prominently + **"Open GitHub"** button (`shell.openExternal(verificationUri)` and copy the code to clipboard) + "Waiting for you to approve…".
  3. `pollForToken` resolves → fetch identity → "Connected as @you" → into the app.
- **Soft reconnect** (`!connected && everConnected`): app is usable for local editing; GitHub actions greyed with a "Reconnect to GitHub" prompt that runs the same device flow (surfaced via the capability nudge, not a hard gate).
- **Settings**: replace the placeholder with the real state — "Connected as **@you**" + **Sign out** (→ `clearToken`, soft reconnect), or "Connect to GitHub" (device flow) when disconnected.

## 8. IPC surface (main → preload → env.d.ts)

- `auth:startDeviceFlow()` → device info; `auth:pollToken(deviceCode, interval)` → `{ ok, connected }`; `auth:identity()` → identity | null; `auth:status()` → `{ connected, everConnected }`; `auth:signOut()`.
- `github:collaborators(repoPath)` → `{ ok, collaborators: {login, name}[] }`.
- Existing `git:*` PR handlers keep their names/shapes but are re-implemented over REST; `git:publish` uses the token.

## 9. Error handling

- Device flow: handle `authorization_pending` (keep polling), `slow_down` (increase interval), `expired_token`/`access_denied` (stop, friendly message, let them retry).
- REST 401 (token revoked/expired) → `clearToken()` + drop to soft reconnect + toast "Your GitHub session expired — reconnect."
- Org-restricted OAuth app (403 with SSO/approval hint) → message pointing the owner to approve the app.
- SSH-remote push → friendly guidance.

## 10. Testing

- **Pure/unit (Vitest):** `parseOwnerRepo` (https/ssh/.git variants), `buildAuthHeader` (base64 of `x-access-token:token`), device-flow response mapping, the extracted PR-patch → diff-line parser, REST→renderer shape mappers, `tokenStore` with a mocked `safeStorage`.
- **Manual (needs the real `client_id` + network):** the end-to-end device flow (code → approve → connected), a real publish/PR/review round-trip, sign-out → reconnect, and a revoked-token → soft-reconnect.

## Affected files (indicative)

- **New:** `src/main/oauthConfig.ts`, `src/main/githubAuth.ts` (+ tests), `src/main/tokenStore.ts` (+ tests), `src/main/github.ts` (+ tests for pure helpers), `src/renderer/pages/Connect.tsx` (+ css) or a gate component, `src/renderer/hooks/useAuth.ts`.
- **Modify:** `src/main/index.ts` (auth + github IPC; rewrite the 7 PR handlers + publish; capabilities), `src/preload/index.ts` + `src/renderer/env.d.ts` (auth/github methods; capabilities shape), `src/renderer/App.tsx` / `AppLayout.tsx` (first-run gate), `src/renderer/pages/Settings.tsx` (real connect/sign-out), `src/renderer/pages/SystemOverview.tsx` + `components/StatusBar.tsx` (capability shape `connected`; reconnect nudge), `src/renderer/components/PublishModal.tsx` (reviewer picker from collaborators).
- **Deleted:** `src/main/gh.ts`, `src/main/__tests__/gh.test.ts`.

## Success criteria

1. First run with no token shows the Connect screen; clicking through the device flow (code → approve in browser) signs the user in and shows "Connected as @you".
2. With no `gh` installed anywhere, a user can **publish** (push + PR), see the **Inbox**, and **review** (diff + approve/request-changes) — all via the token/REST.
3. The reviewer picker lists real repo **collaborators** (no hardcoded mapping).
4. Sign out (or a revoked token) drops to the soft reconnect state; local editing still works; reconnecting restores GitHub actions.
5. `gh.ts` is gone and nothing references `gh`.
6. Vitest covers `parseOwnerRepo`, `buildAuthHeader`, device-flow mapping, the diff parser, and `tokenStore`.
