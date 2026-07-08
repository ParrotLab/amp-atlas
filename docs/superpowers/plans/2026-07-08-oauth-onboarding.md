# GitHub OAuth Onboarding + REST Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `gh` CLI entirely — device-flow "Connect to GitHub" sign-in, token in `safeStorage`, all PR operations + collaborators via the REST API, and token-authenticated push — so non-technical users never install a CLI.

**Architecture:** Main-process modules do device-flow auth (`githubAuth`), encrypted token storage (`tokenStore`), and REST ops (`github`), with pure tested helpers (`githubUrl`, `authHeader`, `diffParse`). The renderer gates first-run behind a Connect screen (`useAuth` + `Connect`), and existing pages consume the same shapes as before (now REST-backed). `gh.ts` is deleted.

**Tech Stack:** Electron main global `fetch`, `safeStorage`, `simple-git`, React 19, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-08-oauth-onboarding-design.md` · **Client ID:** `Ov23liMkybAS2pixLoUq`

---

## File Structure

**New (main):** `oauthConfig.ts`, `githubUrl.ts` (+test), `authHeader.ts` (+test), `diffParse.ts` (+test), `tokenStore.ts` (+test), `githubAuth.ts` (+test), `github.ts`.
**New (renderer):** `hooks/useAuth.ts`, `pages/Connect.tsx` (+css).
**Modify (main):** `index.ts` (auth + github IPC; rewrite 7 PR handlers + `git:publish` + `system:capabilities`; delete gh usage), `preload/index.ts`, `renderer/env.d.ts`.
**Modify (renderer):** `App.tsx` (first-run gate), `Settings.tsx` (connect/sign-out), `SystemOverview.tsx` + `StatusBar.tsx` (capability shape `connected`), `PublishModal.tsx` (reviewer picker from collaborators).
**Delete:** `src/main/gh.ts`, `src/main/__tests__/gh.test.ts`.

**Conventions:** commands from `app/`; `git` from repo root (`cd ..`). Every task ends in a commit.

---

## Phase 0 — Pure helpers (TDD)

### Task 1: `githubUrl` + `authHeader`

**Files:** Create `app/src/main/githubUrl.ts`, `app/src/main/authHeader.ts`; Test `app/src/main/__tests__/githubUrl.test.ts`, `app/src/main/__tests__/authHeader.test.ts`

- [ ] **Step 1: Failing tests**

`app/src/main/__tests__/githubUrl.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseOwnerRepo } from '../githubUrl'

describe('parseOwnerRepo', () => {
  it('parses https with .git', () => {
    expect(parseOwnerRepo('https://github.com/ParrotLab/amp-up-app.git')).toEqual({ owner: 'ParrotLab', repo: 'amp-up-app' })
  })
  it('parses https without .git', () => {
    expect(parseOwnerRepo('https://github.com/ParrotLab/amp-up-app')).toEqual({ owner: 'ParrotLab', repo: 'amp-up-app' })
  })
  it('parses ssh', () => {
    expect(parseOwnerRepo('git@github.com:ParrotLab/amp-up-app.git')).toEqual({ owner: 'ParrotLab', repo: 'amp-up-app' })
  })
  it('returns null for a non-github url', () => {
    expect(parseOwnerRepo('https://example.com/x/y')).toBeNull()
  })
})
```

`app/src/main/__tests__/authHeader.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildAuthHeader } from '../authHeader'

describe('buildAuthHeader', () => {
  it('base64-encodes x-access-token:token as a basic auth header', () => {
    const expected = 'AUTHORIZATION: basic ' + Buffer.from('x-access-token:tok123').toString('base64')
    expect(buildAuthHeader('tok123')).toBe(expected)
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `cd app && npx vitest run src/main/__tests__/githubUrl.test.ts src/main/__tests__/authHeader.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`app/src/main/githubUrl.ts`:

```typescript
export interface OwnerRepo { owner: string; repo: string }

/** Parse owner/repo from a GitHub https or ssh remote URL. */
export function parseOwnerRepo(remoteUrl: string): OwnerRepo | null {
  const cleaned = remoteUrl.trim().replace(/\.git$/, '')
  const https = cleaned.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/)
  if (https) return { owner: https[1], repo: https[2] }
  const ssh = cleaned.match(/^git@github\.com:([^/]+)\/([^/]+)$/)
  if (ssh) return { owner: ssh[1], repo: ssh[2] }
  return null
}
```

`app/src/main/authHeader.ts`:

```typescript
/** Build a git http.extraheader value that authenticates as the token over HTTPS basic auth. */
export function buildAuthHeader(token: string): string {
  const b64 = Buffer.from(`x-access-token:${token}`).toString('base64')
  return `AUTHORIZATION: basic ${b64}`
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd app && npx vitest run src/main/__tests__/githubUrl.test.ts src/main/__tests__/authHeader.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
cd .. && git add app/src/main/githubUrl.ts app/src/main/authHeader.ts app/src/main/__tests__/githubUrl.test.ts app/src/main/__tests__/authHeader.test.ts && git commit -m "feat: pure github url + auth header helpers"
```

### Task 2: `diffParse` (extract the PR patch parser)

**Files:** Create `app/src/main/diffParse.ts`; Test `app/src/main/__tests__/diffParse.test.ts`

- [ ] **Step 1: Failing test**

`app/src/main/__tests__/diffParse.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parsePatch } from '../diffParse'

describe('parsePatch', () => {
  it('parses a unified patch into typed lines', () => {
    const patch = '@@ -1,2 +1,2 @@\n context line\n-removed\n+added'
    expect(parsePatch(patch)).toEqual([
      { type: 'header', content: '@@ -1,2 +1,2 @@' },
      { type: 'context', content: 'context line' },
      { type: 'removed', content: 'removed' },
      { type: 'added', content: 'added' },
    ])
  })
  it('returns [] for empty/undefined', () => {
    expect(parsePatch(undefined)).toEqual([])
    expect(parsePatch('')).toEqual([])
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `cd app && npx vitest run src/main/__tests__/diffParse.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`app/src/main/diffParse.ts`:

```typescript
export type DiffLine = { type: 'added' | 'removed' | 'context' | 'header'; content: string }

/** Parse a unified diff patch (as returned by the REST files endpoint) into typed lines. */
export function parsePatch(patch: string | undefined): DiffLine[] {
  if (!patch) return []
  const lines: DiffLine[] = []
  for (const line of patch.split('\n')) {
    if (line.startsWith('@@')) lines.push({ type: 'header', content: line })
    else if (line.startsWith('+') && !line.startsWith('+++')) lines.push({ type: 'added', content: line.substring(1) })
    else if (line.startsWith('-') && !line.startsWith('---')) lines.push({ type: 'removed', content: line.substring(1) })
    else if (!line.startsWith('diff ') && !line.startsWith('index ') && !line.startsWith('---') && !line.startsWith('+++')) {
      if (line.length > 0) lines.push({ type: 'context', content: line.startsWith(' ') ? line.substring(1) : line })
    }
  }
  return lines
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd app && npx vitest run src/main/__tests__/diffParse.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
cd .. && git add app/src/main/diffParse.ts app/src/main/__tests__/diffParse.test.ts && git commit -m "feat: pure PR patch parser"
```

---

## Phase 1 — Auth core (main)

### Task 3: `oauthConfig` + `tokenStore`

**Files:** Create `app/src/main/oauthConfig.ts`, `app/src/main/tokenStore.ts`; Test `app/src/main/__tests__/tokenStore.test.ts`

- [ ] **Step 1: Config**

`app/src/main/oauthConfig.ts`:

```typescript
export const CLIENT_ID = process.env.AMP_GITHUB_CLIENT_ID || 'Ov23liMkybAS2pixLoUq'
export const SCOPES = 'repo read:org'
```

- [ ] **Step 2: Failing test (token store with injected deps)**

`app/src/main/__tests__/tokenStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { makeTokenStore } from '../tokenStore'

// Fake safeStorage: reversible, deterministic (base64) — good enough to prove the flow.
const fakeSafe = {
  isEncryptionAvailable: () => true,
  encryptString: (s: string) => Buffer.from('enc:' + s),
  decryptString: (b: Buffer) => b.toString().replace(/^enc:/, ''),
}

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'amp-tok-')) })

describe('tokenStore', () => {
  it('saves + reads + clears a token and tracks everConnected', () => {
    const store = makeTokenStore(dir, fakeSafe as never)
    expect(store.getToken()).toBeNull()
    expect(store.hasEverConnected()).toBe(false)
    store.saveToken('abc')
    expect(store.getToken()).toBe('abc')
    expect(store.hasEverConnected()).toBe(true)
    store.clearToken()
    expect(store.getToken()).toBeNull()
    expect(store.hasEverConnected()).toBe(true) // marker persists after sign-out
  })
})
```

- [ ] **Step 3: Run, verify fail**

Run: `cd app && npx vitest run src/main/__tests__/tokenStore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

`app/src/main/tokenStore.ts`:

```typescript
import { app, safeStorage } from 'electron'
import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs'
import { join } from 'path'

interface SafeStorageLike {
  isEncryptionAvailable(): boolean
  encryptString(s: string): Buffer
  decryptString(b: Buffer): string
}

export function makeTokenStore(dir: string, safe: SafeStorageLike) {
  const tokenFile = join(dir, 'auth.bin')
  const markerFile = join(dir, 'amp-auth.json')

  return {
    getToken(): string | null {
      try {
        if (!existsSync(tokenFile)) return null
        return safe.decryptString(readFileSync(tokenFile))
      } catch { return null }
    },
    saveToken(token: string): void {
      writeFileSync(tokenFile, safe.encryptString(token))
      writeFileSync(markerFile, JSON.stringify({ everConnected: true }))
    },
    clearToken(): void {
      try { if (existsSync(tokenFile)) rmSync(tokenFile) } catch { /* ignore */ }
    },
    hasEverConnected(): boolean {
      try { return existsSync(markerFile) && JSON.parse(readFileSync(markerFile, 'utf-8')).everConnected === true }
      catch { return false }
    },
  }
}

// App-wide singleton bound to Electron's real safeStorage + userData.
let singleton: ReturnType<typeof makeTokenStore> | null = null
export function tokenStore() {
  if (!singleton) singleton = makeTokenStore(app.getPath('userData'), safeStorage)
  return singleton
}
```

- [ ] **Step 5: Run, verify pass**

Run: `cd app && npx vitest run src/main/__tests__/tokenStore.test.ts`
Expected: PASS, 1 test.

- [ ] **Step 6: Commit**

```bash
cd .. && git add app/src/main/oauthConfig.ts app/src/main/tokenStore.ts app/src/main/__tests__/tokenStore.test.ts && git commit -m "feat: oauth config + encrypted token store"
```

### Task 4: `githubAuth` (device flow + identity)

**Files:** Create `app/src/main/githubAuth.ts`; Test `app/src/main/__tests__/githubAuth.test.ts`

- [ ] **Step 1: Failing test (pure poll-result mapping)**

`app/src/main/__tests__/githubAuth.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { interpretPoll } from '../githubAuth'

describe('interpretPoll', () => {
  it('returns token on success', () => {
    expect(interpretPoll({ access_token: 'x' })).toEqual({ done: true, token: 'x' })
  })
  it('keeps waiting on authorization_pending', () => {
    expect(interpretPoll({ error: 'authorization_pending' })).toEqual({ done: false, slowDown: false })
  })
  it('signals slow_down', () => {
    expect(interpretPoll({ error: 'slow_down' })).toEqual({ done: false, slowDown: true })
  })
  it('fails on expired/denied', () => {
    expect(interpretPoll({ error: 'expired_token' })).toEqual({ done: true, error: 'expired_token' })
    expect(interpretPoll({ error: 'access_denied' })).toEqual({ done: true, error: 'access_denied' })
  })
})
```

- [ ] **Step 2: Run, verify fail**

Run: `cd app && npx vitest run src/main/__tests__/githubAuth.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`app/src/main/githubAuth.ts`:

```typescript
import { CLIENT_ID, SCOPES } from './oauthConfig'
import { tokenStore } from './tokenStore'

export interface DeviceInfo { deviceCode: string; userCode: string; verificationUri: string; interval: number; expiresIn: number }

export async function startDeviceFlow(): Promise<DeviceInfo> {
  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, scope: SCOPES }),
  })
  const j = await res.json()
  return { deviceCode: j.device_code, userCode: j.user_code, verificationUri: j.verification_uri, interval: j.interval || 5, expiresIn: j.expires_in }
}

interface PollResult { done: boolean; token?: string; error?: string; slowDown?: boolean }

/** Pure interpretation of a poll response body. */
export function interpretPoll(body: { access_token?: string; error?: string }): PollResult {
  if (body.access_token) return { done: true, token: body.access_token }
  if (body.error === 'authorization_pending') return { done: false, slowDown: false }
  if (body.error === 'slow_down') return { done: false, slowDown: true }
  return { done: true, error: body.error || 'unknown' }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function pollForToken(deviceCode: string, interval: number): Promise<{ ok: boolean; error?: string }> {
  let wait = (interval || 5) * 1000
  for (;;) {
    await sleep(wait)
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: CLIENT_ID, device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }),
    })
    const r = interpretPoll(await res.json())
    if (r.slowDown) wait += 5000
    if (!r.done) continue
    if (r.token) { tokenStore().saveToken(r.token); return { ok: true } }
    return { ok: false, error: r.error }
  }
}

export async function getIdentity(): Promise<{ login: string; name: string; avatarUrl: string } | null> {
  const token = tokenStore().getToken()
  if (!token) return null
  const res = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } })
  if (!res.ok) return null
  const j = await res.json()
  return { login: j.login, name: j.name || j.login, avatarUrl: j.avatar_url }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd app && npx vitest run src/main/__tests__/githubAuth.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
cd .. && git add app/src/main/githubAuth.ts app/src/main/__tests__/githubAuth.test.ts && git commit -m "feat: github device-flow auth + identity"
```

---

## Phase 2 — REST ops (main)

### Task 5: `github.ts` REST client

**Files:** Create `app/src/main/github.ts`

- [ ] **Step 1: Implement the REST client**

`app/src/main/github.ts`:

```typescript
import { simpleGit } from 'simple-git'
import { tokenStore } from './tokenStore'
import { parseOwnerRepo } from './githubUrl'
import { parsePatch } from './diffParse'

const API = 'https://api.github.com'

class TokenError extends Error {}

async function gh(path: string, init: RequestInit = {}): Promise<unknown> {
  const token = tokenStore().getToken()
  if (!token) throw new TokenError('not connected')
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  if (res.status === 401) { tokenStore().clearToken(); throw new TokenError('expired') }
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

async function ownerRepo(repoPath: string): Promise<{ owner: string; repo: string }> {
  const url = (await simpleGit(repoPath).remote(['get-url', 'origin']))?.trim() || ''
  const or = parseOwnerRepo(url)
  if (!or) throw new Error('This system has no GitHub remote')
  return or
}

async function reviewDecision(owner: string, repo: string, num: number): Promise<string | null> {
  const reviews = await gh(`/repos/${owner}/${repo}/pulls/${num}/reviews`) as { state: string }[]
  const decisive = [...reviews].reverse().find(r => r.state === 'APPROVED' || r.state === 'CHANGES_REQUESTED')
  return decisive ? decisive.state : null
}

export async function createPR(repoPath: string, title: string, body: string, reviewers: string[]) {
  const { owner, repo } = await ownerRepo(repoPath)
  const branch = (await simpleGit(repoPath).status()).current
  const base = (await simpleGit(repoPath).branch()).all.includes('main') ? 'main' : 'master'
  const pr = await gh(`/repos/${owner}/${repo}/pulls`, { method: 'POST', body: JSON.stringify({ title, body: body || '', head: branch, base }) }) as { number: number; html_url: string }
  if (reviewers.length) {
    try { await gh(`/repos/${owner}/${repo}/pulls/${pr.number}/requested_reviewers`, { method: 'POST', body: JSON.stringify({ reviewers }) }) } catch { /* reviewer request is best-effort */ }
  }
  return { url: pr.html_url }
}

export async function listPRs(repoPath: string) {
  const { owner, repo } = await ownerRepo(repoPath)
  const prs = await gh(`/repos/${owner}/${repo}/pulls?state=open&per_page=20`) as Array<{ number: number; title: string; state: string; user: { login: string }; created_at: string; head: { ref: string }; html_url: string }>
  return Promise.all(prs.map(async p => {
    const detail = await gh(`/repos/${owner}/${repo}/pulls/${p.number}`) as { additions: number; deletions: number; changed_files: number }
    return {
      number: p.number, title: p.title, state: p.state.toUpperCase(),
      author: { login: p.user.login, name: p.user.login }, createdAt: p.created_at,
      headRefName: p.head.ref, reviewDecision: await reviewDecision(owner, repo, p.number),
      url: p.html_url, additions: detail.additions, deletions: detail.deletions, changedFiles: detail.changed_files,
    }
  }))
}

export async function prStatus(repoPath: string) {
  const branch = (await simpleGit(repoPath).status()).current
  if (!branch || branch === 'main' || branch === 'master') return { hasPR: false }
  const { owner, repo } = await ownerRepo(repoPath)
  const list = await gh(`/repos/${owner}/${repo}/pulls?head=${owner}:${branch}&state=all`) as Array<{ number: number; title: string; state: string; merged_at: string | null; html_url: string }>
  const p = list[0]
  if (!p) return { hasPR: false }
  const state = p.merged_at ? 'MERGED' : p.state.toUpperCase()
  return { hasPR: true, pr: { number: p.number, title: p.title, url: p.html_url, state, reviewDecision: await reviewDecision(owner, repo, p.number) } }
}

export async function checkMerged(repoPath: string) {
  const branch = (await simpleGit(repoPath).status()).current
  if (!branch || branch === 'main' || branch === 'master') return { merged: false }
  const { owner, repo } = await ownerRepo(repoPath)
  const list = await gh(`/repos/${owner}/${repo}/pulls?head=${owner}:${branch}&state=all`) as Array<{ number: number }>
  if (!list[0]) return { merged: false }
  const pr = await gh(`/repos/${owner}/${repo}/pulls/${list[0].number}`) as { merged: boolean }
  return { merged: pr.merged, branch }
}

export async function prFiles(repoPath: string, num: number): Promise<string[]> {
  const { owner, repo } = await ownerRepo(repoPath)
  const files = await gh(`/repos/${owner}/${repo}/pulls/${num}/files?per_page=100`) as { filename: string }[]
  return files.map(f => f.filename)
}

export async function prFileDiff(repoPath: string, num: number, filePath: string) {
  const { owner, repo } = await ownerRepo(repoPath)
  const files = await gh(`/repos/${owner}/${repo}/pulls/${num}/files?per_page=100`) as { filename: string; patch?: string }[]
  const f = files.find(x => x.filename === filePath)
  return { lines: parsePatch(f?.patch) }
}

export async function prFileContent(repoPath: string, num: number, filePath: string) {
  const { owner, repo } = await ownerRepo(repoPath)
  const pr = await gh(`/repos/${owner}/${repo}/pulls/${num}`) as { head: { sha: string } }
  const file = await gh(`/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}?ref=${pr.head.sha}`) as { content?: string }
  const content = file.content ? Buffer.from(file.content, 'base64').toString('utf-8') : ''
  return { content }
}

export async function reviewPR(repoPath: string, num: number, action: 'approve' | 'request-changes', body: string) {
  const { owner, repo } = await ownerRepo(repoPath)
  const event = action === 'approve' ? 'APPROVE' : 'REQUEST_CHANGES'
  await gh(`/repos/${owner}/${repo}/pulls/${num}/reviews`, { method: 'POST', body: JSON.stringify({ event, body: body || '' }) })
}

export async function collaborators(repoPath: string) {
  const { owner, repo } = await ownerRepo(repoPath)
  const cols = await gh(`/repos/${owner}/${repo}/collaborators?per_page=100`) as { login: string }[]
  return cols.map(c => ({ login: c.login, name: c.login }))
}

export function isTokenError(e: unknown): boolean { return e instanceof TokenError }
```

- [ ] **Step 2: Typecheck**

Run: `cd app && npx tsc -p tsconfig.node.json --noEmit 2>&1 | grep github.ts || echo "github.ts clean"`
Expected: `github.ts clean`.

- [ ] **Step 3: Commit**

```bash
cd .. && git add app/src/main/github.ts && git commit -m "feat: github REST client (PR ops + collaborators)"
```

### Task 6: Wire IPC — auth, github, rewrite git handlers, delete gh

**Files:** Modify `app/src/main/index.ts`, `app/src/preload/index.ts`, `app/src/renderer/env.d.ts`; Delete `app/src/main/gh.ts`, `app/src/main/__tests__/gh.test.ts`

- [ ] **Step 1: Swap imports in `index.ts`**

Remove `import { runGh, ghAvailable, ghAuthed } from './gh'`. Add:

```typescript
import { startDeviceFlow, pollForToken, getIdentity } from './githubAuth'
import { tokenStore } from './tokenStore'
import { buildAuthHeader } from './authHeader'
import * as github from './github'
```

- [ ] **Step 2: Auth IPC**

Add near the other handlers:

```typescript
ipcMain.handle('auth:startDeviceFlow', async () => {
  try { return { ok: true, ...(await startDeviceFlow()) } } catch (e) { return { ok: false, error: String(e) } }
})
ipcMain.handle('auth:pollToken', async (_e, deviceCode: string, interval: number) => {
  try { const r = await pollForToken(deviceCode, interval); return { ...r, connected: r.ok } } catch (e) { return { ok: false, error: String(e) } }
})
ipcMain.handle('auth:identity', async () => { try { return { ok: true, identity: await getIdentity() } } catch { return { ok: true, identity: null } } })
ipcMain.handle('auth:status', async () => ({ connected: tokenStore().getToken() !== null, everConnected: tokenStore().hasEverConnected() }))
ipcMain.handle('auth:signOut', async () => { tokenStore().clearToken(); return { ok: true } })
ipcMain.handle('github:collaborators', async (_e, repoPath: string) => {
  try { return { ok: true, collaborators: await github.collaborators(repoPath) } } catch (e) { return { ok: false, error: String(e), collaborators: [] } }
})
```

- [ ] **Step 3: Rewrite the 7 PR handlers over REST**

Replace each existing `git:*` PR handler body to call `github.*` and preserve the return shapes:

```typescript
ipcMain.handle('git:createPR', async (_e, repoPath: string, title: string, body: string, reviewers: string[]) => {
  try { return { ok: true, ...(await github.createPR(repoPath, title, body, reviewers)) } } catch (e) { return { ok: false, error: String(e) } }
})
ipcMain.handle('git:prStatus', async (_e, repoPath: string) => {
  try { return { ok: true, ...(await github.prStatus(repoPath)) } } catch { return { ok: true, hasPR: false } }
})
ipcMain.handle('git:checkMerged', async (_e, repoPath: string) => {
  try { return { ok: true, ...(await github.checkMerged(repoPath)) } } catch { return { ok: true, merged: false } }
})
ipcMain.handle('git:listPRs', async (_e, repoPath: string) => {
  try { return { ok: true, prs: await github.listPRs(repoPath) } } catch { return { ok: true, prs: [] } }
})
ipcMain.handle('git:prDiff', async (_e, repoPath: string, prNumber: number) => {
  try { return { ok: true, files: await github.prFiles(repoPath, prNumber) } } catch (e) { return { ok: false, error: String(e), files: [] } }
})
ipcMain.handle('git:prFileDiff', async (_e, repoPath: string, prNumber: number, filePath: string) => {
  try { return { ok: true, ...(await github.prFileDiff(repoPath, prNumber, filePath)) } } catch (e) { return { ok: false, error: String(e), lines: [] } }
})
ipcMain.handle('git:prFileContent', async (_e, repoPath: string, prNumber: number, filePath: string) => {
  try { return { ok: true, ...(await github.prFileContent(repoPath, prNumber, filePath)) } } catch (e) { return { ok: false, content: '', error: String(e) } }
})
ipcMain.handle('git:reviewPR', async (_e, repoPath: string, prNumber: number, action: 'approve' | 'request-changes', body: string) => {
  try { await github.reviewPR(repoPath, prNumber, action, body); return { ok: true } } catch (e) { return { ok: false, error: String(e) } }
})
```

(Delete the old `execFile`/`runGh`-based bodies of these handlers.)

- [ ] **Step 4: Token-authenticated push**

Replace the `git:publish` handler:

```typescript
ipcMain.handle('git:publish', async (_e, repoPath: string) => {
  try {
    const git = simpleGit(repoPath)
    const branch = (await git.status()).current
    if (!branch) return { ok: false, error: 'No branch found' }
    const token = tokenStore().getToken()
    if (!token) return { ok: false, error: 'Not connected to GitHub' }
    await git.raw(['-c', `http.https://github.com/.extraheader=${buildAuthHeader(token)}`, 'push', 'origin', branch, '--set-upstream'])
    return { ok: true }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})
```

- [ ] **Step 5: Capability model → connected**

Replace the `system:capabilities` handler:

```typescript
ipcMain.handle('system:capabilities', async (_e, repoPath: string) => {
  let isGitRepo = false
  try { isGitRepo = await simpleGit(repoPath).checkIsRepo() } catch { isGitRepo = false }
  return { ok: true, isGitRepo, connected: tokenStore().getToken() !== null }
})
```

- [ ] **Step 6: Delete gh**

```bash
cd app && rm src/main/gh.ts src/main/__tests__/gh.test.ts
grep -rn "runGh\|ghAvailable\|ghAuthed\|from './gh'" src/main || echo "no gh references"
```

- [ ] **Step 7: Preload + env types**

In `app/src/preload/index.ts`, add an `auth` object and a `github` object, and keep `git`/`system` as-is:

```typescript
  auth: {
    startDeviceFlow: () => ipcRenderer.invoke('auth:startDeviceFlow'),
    pollToken: (deviceCode: string, interval: number) => ipcRenderer.invoke('auth:pollToken', deviceCode, interval),
    identity: () => ipcRenderer.invoke('auth:identity'),
    status: () => ipcRenderer.invoke('auth:status'),
    signOut: () => ipcRenderer.invoke('auth:signOut'),
  },
  github: {
    collaborators: (repoPath: string) => ipcRenderer.invoke('github:collaborators', repoPath),
  },
```

In `app/src/renderer/env.d.ts`: change `system.capabilities` return to `{ ok: boolean; isGitRepo: boolean; connected: boolean }`, and add to `ElectronAPI`:

```typescript
  auth: {
    startDeviceFlow: () => Promise<{ ok: boolean; error?: string; deviceCode?: string; userCode?: string; verificationUri?: string; interval?: number; expiresIn?: number }>
    pollToken: (deviceCode: string, interval: number) => Promise<{ ok: boolean; connected?: boolean; error?: string }>
    identity: () => Promise<{ ok: boolean; identity: { login: string; name: string; avatarUrl: string } | null }>
    status: () => Promise<{ connected: boolean; everConnected: boolean }>
    signOut: () => Promise<{ ok: boolean }>
  }
  github: {
    collaborators: (repoPath: string) => Promise<{ ok: boolean; error?: string; collaborators: { login: string; name: string }[] }>
  }
```

- [ ] **Step 8: Typecheck + build + tests**

Run: `cd app && npx tsc -p tsconfig.node.json --noEmit && npx tsc -p tsconfig.web.json --noEmit 2>&1 | grep -vE "SystemOverview|StatusBar|Settings|Inbox|Review" ; npm run build && npm test`
Expected: node clean; web shows only errors in the renderer files updated in Phase 3; build/test pass. (If build fails on the capability shape, that's fixed in Task 8.)

> Note: the `system:capabilities` shape change will surface type errors in `SystemOverview`/`StatusBar` (fixed in Task 8). If `npm run build` (esbuild, no typecheck) succeeds, proceed.

- [ ] **Step 9: Commit**

```bash
cd .. && git add -A && git commit -m "feat: auth+github IPC, PR ops over REST, token push, drop gh"
```

---

## Phase 3 — Renderer

### Task 7: `useAuth` + Connect screen + first-run gate

**Files:** Create `app/src/renderer/hooks/useAuth.ts`, `app/src/renderer/pages/Connect.tsx`, `app/src/renderer/pages/Connect.css`; Modify `app/src/renderer/App.tsx`

- [ ] **Step 1: `useAuth` hook**

`app/src/renderer/hooks/useAuth.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react'

export function useAuth() {
  const [status, setStatus] = useState<{ connected: boolean; everConnected: boolean } | null>(null)

  const refresh = useCallback(async () => {
    setStatus(await window.api.auth.status())
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { status, refresh }
}
```

- [ ] **Step 2: Connect screen**

`app/src/renderer/pages/Connect.tsx`:

```typescript
import { useState } from 'react'
import './Connect.css'

export default function Connect({ onConnected }: { onConnected: () => void }) {
  const [device, setDevice] = useState<{ userCode: string; verificationUri: string } | null>(null)
  const [status, setStatus] = useState<'idle' | 'waiting' | 'error'>('idle')
  const [error, setError] = useState('')

  const start = async () => {
    setStatus('waiting'); setError('')
    const d = await window.api.auth.startDeviceFlow()
    if (!d.ok || !d.deviceCode) { setStatus('error'); setError(d.error || 'Could not start'); return }
    setDevice({ userCode: d.userCode!, verificationUri: d.verificationUri! })
    navigator.clipboard.writeText(d.userCode!)
    window.open(d.verificationUri!)
    const r = await window.api.auth.pollToken(d.deviceCode, d.interval || 5)
    if (r.connected) onConnected()
    else { setStatus('error'); setError(r.error === 'access_denied' ? 'Connection was declined.' : 'The code expired — try again.') }
  }

  return (
    <div className="connect-screen">
      <div className="connect-card">
        <div className="connect-title">Connect to GitHub</div>
        <div className="connect-sub">AMP Atlas works with your team's GitHub. Connect once to publish and review.</div>
        {!device && status !== 'waiting' && <button className="connect-btn" onClick={start}>Connect to GitHub</button>}
        {device && (
          <div className="connect-code-wrap">
            <div className="connect-code-label">Enter this code on GitHub (we copied it for you):</div>
            <div className="connect-code">{device.userCode}</div>
            <button className="connect-btn" onClick={() => window.open(device.verificationUri)}>Open GitHub</button>
            <div className="connect-waiting">Waiting for you to approve…</div>
          </div>
        )}
        {status === 'waiting' && !device && <div className="connect-waiting">Starting…</div>}
        {status === 'error' && <div className="connect-error">{error} <button className="connect-link" onClick={start}>Try again</button></div>}
      </div>
    </div>
  )
}
```

`app/src/renderer/pages/Connect.css`:

```css
.connect-screen { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: #F5F0EB; }
.connect-card { background: #fff; border-radius: 20px; padding: 40px; width: 460px; max-width: 90vw; box-shadow: 0 20px 60px rgba(0,0,0,0.12); text-align: center; }
.connect-title { font-size: 22px; font-weight: 600; color: #1a1a2e; margin-bottom: 8px; }
.connect-sub { font-size: 14px; color: #6B6966; line-height: 1.5; margin-bottom: 24px; }
.connect-btn { padding: 10px 22px; font-size: 14px; font-weight: 500; color: #fff; background: #8B2BFF; border: none; border-radius: 10px; cursor: pointer; font-family: inherit; }
.connect-btn:hover { background: #7A1FE6; }
.connect-code-label { font-size: 12px; color: #8E8B87; margin-bottom: 8px; }
.connect-code { font-size: 28px; font-weight: 700; letter-spacing: 4px; color: #8B2BFF; font-family: ui-monospace, monospace; margin-bottom: 16px; }
.connect-waiting { margin-top: 14px; font-size: 12px; color: #B5B1AC; }
.connect-error { margin-top: 16px; font-size: 13px; color: #DC2626; }
.connect-link { background: none; border: none; color: #8B2BFF; cursor: pointer; font-family: inherit; text-decoration: underline; }
```

- [ ] **Step 3: First-run gate in `App.tsx`**

Replace `App.tsx` with a gate wrapper:

```typescript
import { HashRouter, Routes, Route } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import Dashboard from './pages/Dashboard'
import SystemOverview from './pages/SystemOverview'
import Settings from './pages/Settings'
import Inbox from './pages/Inbox'
import Review from './pages/Review'
import Connect from './pages/Connect'
import { useAuth } from './hooks/useAuth'

export default function App() {
  const { status, refresh } = useAuth()
  if (!status) return null // brief: loading auth status
  if (!status.connected && !status.everConnected) return <Connect onConnected={refresh} />
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/review/:systemId/:prNumber" element={<Review />} />
          <Route path="/system/:systemId" element={<SystemOverview />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
```

- [ ] **Step 4: Build + commit**

Run: `cd app && npm run build`

```bash
cd .. && git add app/src/renderer/hooks/useAuth.ts app/src/renderer/pages/Connect.tsx app/src/renderer/pages/Connect.css app/src/renderer/App.tsx && git commit -m "feat: first-run Connect gate + device-flow UI"
```

### Task 8: Capability shape (`connected`) in SystemOverview + StatusBar

**Files:** Modify `app/src/renderer/pages/SystemOverview.tsx`, `app/src/renderer/components/StatusBar.tsx` (only if it referenced the old shape)

- [ ] **Step 1: Update caps state + gating**

In `SystemOverview.tsx`, replace the caps state and its fetch:

```typescript
  const [caps, setCaps] = useState({ isGitRepo: true, connected: true })

  useEffect(() => {
    if (!rootPath) return
    window.api.system.capabilities(rootPath).then(r => {
      if (r.ok) setCaps({ isGitRepo: r.isGitRepo, connected: r.connected })
    })
  }, [rootPath])
```

Update the derived flags: `canEdit = !isMainBranch && caps.isGitRepo` stays; change the StatusBar props `canUseGitHub={caps.isGitRepo && caps.connected}` and the nudge text `onNeedGitHub={() => showToast(caps.connected ? 'Connect a GitHub-backed system.' : 'Reconnect to GitHub in Settings to publish and review.')}`. (Search for `caps.ghAuthed`/`caps.ghAvailable` and replace with `caps.connected`.)

- [ ] **Step 2: Typecheck + build**

Run: `cd app && npx tsc -p tsconfig.web.json --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd .. && git add app/src/renderer/pages/SystemOverview.tsx app/src/renderer/components/StatusBar.tsx && git commit -m "feat: token-based capability gating (connected)"
```

### Task 9: Settings connect / sign-out

**Files:** Modify `app/src/renderer/pages/Settings.tsx`

- [ ] **Step 1: Real connect/sign-out UI**

In `Settings.tsx`, add auth state and replace the placeholder `handleConnectGitHub`:

```typescript
  const [identity, setIdentity] = useState<{ login: string } | null>(null)
  useEffect(() => { window.api.auth.identity().then(r => setIdentity(r.identity)) }, [])

  const handleConnectGitHub = async () => {
    const d = await window.api.auth.startDeviceFlow()
    if (!d.ok || !d.deviceCode) { showToast(d.error || "Couldn't start GitHub connection"); return }
    navigator.clipboard.writeText(d.userCode!)
    window.open(d.verificationUri!)
    showToast(`Enter code ${d.userCode} on GitHub (copied). Waiting…`)
    const r = await window.api.auth.pollToken(d.deviceCode, d.interval || 5)
    if (r.connected) { const id = await window.api.auth.identity(); setIdentity(id.identity); showToast('Connected to GitHub.') }
    else showToast('GitHub connection did not complete.')
  }

  const handleSignOut = async () => { await window.api.auth.signOut(); setIdentity(null); showToast('Signed out of GitHub.') }
```

Update the GitHub settings section JSX to show connected state:

```tsx
          <div className="settings-info-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="settings-info-label">GitHub</div>
              <div className="settings-info-value">{identity ? `Connected as @${identity.login}` : 'Connect to publish drafts and review changes.'}</div>
            </div>
            {identity
              ? <button className="settings-btn danger" onClick={handleSignOut}>Sign out</button>
              : <button className="settings-btn primary" onClick={handleConnectGitHub}>Connect to GitHub</button>}
          </div>
```

Also update the folder-connect capability check (it referenced `caps.ghAuthed`): change to use `caps.connected` from `window.api.system.capabilities`.

- [ ] **Step 2: Build + commit**

Run: `cd app && npx tsc -p tsconfig.web.json --noEmit && npm run build`

```bash
cd .. && git add app/src/renderer/pages/Settings.tsx && git commit -m "feat: real GitHub connect/sign-out in Settings"
```

### Task 10: PublishModal reviewer picker from collaborators

**Files:** Modify `app/src/renderer/components/PublishModal.tsx`

- [ ] **Step 1: Load collaborators, select by login**

Replace the hardcoded `teamMembers` array with a fetch and select-by-login. Add near the top of the component:

```typescript
  const [members, setMembers] = useState<{ login: string; name: string }[]>([])
  useEffect(() => {
    if (isOpen && repoPath) window.api.github.collaborators(repoPath).then(r => { if (r.ok) setMembers(r.collaborators) })
  }, [isOpen, repoPath])
```

Change `selectedReviewers` handling to use `login`. Replace the reviewer render block to map `members` (using `member.login` as the key and value, `member.name` or `@login` as the label, and `member.login.charAt(0).toUpperCase()` for the avatar). The `onPublish` continues to pass `selectedReviewers` (now logins), which `git:createPR` forwards to the REST `requested_reviewers`.

- [ ] **Step 2: Build + commit**

Run: `cd app && npx tsc -p tsconfig.web.json --noEmit && npm run build`

```bash
cd .. && git add app/src/renderer/components/PublishModal.tsx && git commit -m "feat: reviewer picker from real repo collaborators"
```

---

## Phase 4 — Verify

### Task 11: Full verification + live smoke

- [ ] **Step 1: Everything green**

Run: `cd app && npm test && npx tsc -p tsconfig.web.json --noEmit && npx tsc -p tsconfig.node.json --noEmit && npm run build`
Expected: all tests pass; no type errors; build succeeds.

- [ ] **Step 2: Manual live smoke** (`cd app && npm run dev`) — needs the real network + a Parrot Labs repo

1. First run (no token): the **Connect screen** shows; click Connect → a code appears + GitHub opens → approve in browser → app loads, "Connected as @you".
2. With **no `gh` installed**, connect a system, make a draft edit, **Publish** → pushes + opens a PR (check GitHub).
3. **Inbox** lists the open PR; **Review** shows the file diff and Approve / Request changes work.
4. The Publish reviewer list shows **real repo collaborators**.
5. **Settings → Sign out** → GitHub actions grey out with a "Reconnect" nudge; local editing still works; reconnect restores them.

- [ ] **Step 3: Commit any touch-ups**

```bash
cd .. && git add -A && git commit -m "chore: oauth onboarding verified end-to-end" || echo "nothing to commit"
```

---

## Self-Review Notes (author)

- **Spec coverage:** config §1 → T3; device flow §2 → T4; token store §3 → T3; REST client §4 → T5; push §5 → T6; capability model §6 → T6/T8; onboarding UX §7 → T7/T9; IPC §8 → T6; error handling §9 → T5 (`TokenError`/401), T4 (poll states), T6 (per-handler try/catch); testing §10 → T1–T4 + manual T11. All covered.
- **Field-coverage note (spec §4):** `listPRs`/`prStatus` do the extra per-PR `reviewDecision` + stats calls (T5) to fill the UI shape.
- **Type consistency:** capability shape `{ isGitRepo, connected }` identical in main (T6), env.d.ts (T6), and consumers (T8/T9); `auth.*` shapes identical across preload/env/consumers; `git:*` PR handler return shapes preserved so `Inbox`/`Review` are untouched.
- **gh removal:** T6 deletes `gh.ts` + test and greps for stragglers.
- **Deferred (correctly out):** local-only first-run mode (v2), migrating identity `name` beyond login, richer collaborator metadata.
```