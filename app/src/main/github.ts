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
  const prs = await gh(`/repos/${owner}/${repo}/pulls?state=open&per_page=20`) as Array<{ number: number; title: string; state: string; user: { login: string }; created_at: string; head: { ref: string }; html_url: string; body: string | null; requested_reviewers: { login: string }[] | null }>
  return Promise.all(prs.map(async p => {
    const detail = await gh(`/repos/${owner}/${repo}/pulls/${p.number}`) as { additions: number; deletions: number; changed_files: number }
    return {
      number: p.number, title: p.title, state: p.state.toUpperCase(),
      author: { login: p.user.login, name: p.user.login }, createdAt: p.created_at,
      headRefName: p.head.ref, reviewDecision: await reviewDecision(owner, repo, p.number),
      url: p.html_url, additions: detail.additions, deletions: detail.deletions, changedFiles: detail.changed_files,
      body: p.body || '', requestedReviewers: (p.requested_reviewers ?? []).map(u => u.login),
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

export async function mergePR(repoPath: string, num: number) {
  const { owner, repo } = await ownerRepo(repoPath)
  const pr = await gh(`/repos/${owner}/${repo}/pulls/${num}`) as { head: { ref: string } }
  await gh(`/repos/${owner}/${repo}/pulls/${num}/merge`, { method: 'PUT', body: JSON.stringify({ merge_method: 'squash' }) })
  // Deleting the merged branch is best-effort (may be protected or already gone).
  try { await gh(`/repos/${owner}/${repo}/git/refs/heads/${pr.head.ref}`, { method: 'DELETE' }) } catch { /* ignore */ }
}

export async function collaborators(repoPath: string) {
  const { owner, repo } = await ownerRepo(repoPath)
  const cols = await gh(`/repos/${owner}/${repo}/collaborators?per_page=100`) as { login: string }[]
  return cols.map(c => ({ login: c.login, name: c.login }))
}

export function isTokenError(e: unknown): boolean { return e instanceof TokenError }

/** Count of open PRs in this repo where `login` is a requested reviewer (i.e. awaiting their review). One API call. */
export async function reviewRequestCount(repoPath: string, login: string): Promise<number> {
  const { owner, repo } = await ownerRepo(repoPath)
  const prs = await gh(`/repos/${owner}/${repo}/pulls?state=open&per_page=50`) as Array<{ requested_reviewers?: { login: string }[] }>
  return prs.filter(p => (p.requested_reviewers ?? []).some(u => u.login === login)).length
}

export type FileWatcher = { number: number; author: string; title: string; branch: string }

type WatcherPR = { number: number; title: string; headRefName: string; author: { login: string } }

/** Pure: open PRs not on `currentBranch` whose file set includes `relPath` (author kept as login). */
export function selectWatchers(
  prs: WatcherPR[],
  filesByPr: Record<number, string[]>,
  currentBranch: string | null,
  relPath: string,
): { number: number; login: string; title: string; branch: string }[] {
  return prs
    .filter(p => p.headRefName !== currentBranch)
    .filter(p => (filesByPr[p.number] || []).includes(relPath))
    .map(p => ({ number: p.number, login: p.author.login, title: p.title, branch: p.headRefName }))
}

// Display name for a GitHub login, falling back to the login. Cached per login for the process lifetime.
const nameCache = new Map<string, string>()
async function resolveUserName(login: string): Promise<string> {
  const cached = nameCache.get(login)
  if (cached) return cached
  let name = login
  try {
    const u = await gh(`/users/${login}`) as { name: string | null }
    if (u.name) name = u.name
  } catch { /* offline / rate-limited — fall back to login */ }
  nameCache.set(login, name)
  return name
}

/** Open PRs by others that already touch `relPath`, with author display names resolved. */
export async function fileWatchers(repoPath: string, relPath: string): Promise<FileWatcher[]> {
  const currentBranch = (await simpleGit(repoPath).status()).current
  const prs = await listPRs(repoPath)
  const others = prs.filter(p => p.headRefName !== currentBranch)

  const filesByPr: Record<number, string[]> = {}
  for (const p of others) filesByPr[p.number] = await prFiles(repoPath, p.number)

  const picked = selectWatchers(prs as unknown as WatcherPR[], filesByPr, currentBranch, relPath)
  const out: FileWatcher[] = []
  for (const w of picked) {
    out.push({ number: w.number, author: await resolveUserName(w.login), title: w.title, branch: w.branch })
  }
  return out
}
