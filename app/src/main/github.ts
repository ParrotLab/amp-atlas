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
