import { simpleGit } from 'simple-git'
import { prepareRemoteAuth } from './gitAuth'
import { clearStaleIndexLock } from './gitLock'

export function slugifyDraft(name: string): string {
  return 'draft/' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export interface AdoptableBranch {
  name: string
  isRemoteOnly: boolean
}

/** Branches the app could adopt: local + remote (origin/*), excluding main/master. */
export async function listAdoptableBranches(repoPath: string): Promise<AdoptableBranch[]> {
  const git = simpleGit(repoPath)
  const info = await git.branch(['-a'])
  const skip = new Set(['main', 'master'])
  const local = new Set<string>()
  const result: AdoptableBranch[] = []

  for (const raw of info.all) {
    if (raw.startsWith('remotes/')) continue
    if (skip.has(raw)) continue
    local.add(raw)
    result.push({ name: raw, isRemoteOnly: false })
  }
  for (const raw of info.all) {
    if (!raw.startsWith('remotes/origin/')) continue
    const name = raw.replace('remotes/origin/', '')
    if (skip.has(name) || name === 'HEAD' || local.has(name)) continue
    result.push({ name, isRemoteOnly: true })
  }
  return result
}

/** Create a new draft that carries the current uncommitted working-tree changes (Flow 2). */
export async function createDraftFromChanges(repoPath: string, draftName: string): Promise<{ branch: string }> {
  const git = simpleGit(repoPath)
  await clearStaleIndexLock(repoPath)
  const branch = slugifyDraft(draftName)
  // checkoutLocalBranch keeps the dirty working tree; changes follow onto the new branch.
  await git.checkoutLocalBranch(branch)
  return { branch }
}

/** Plain checkout of an existing branch (no stashing — the renderer resolves dirty state first). */
export async function switchDraft(repoPath: string, branch: string): Promise<void> {
  await clearStaleIndexLock(repoPath)
  await simpleGit(repoPath).checkout(branch)
}

/** New Draft: switch to the Live Version, pull latest if possible, then branch. */
export async function createDraftFromMain(repoPath: string, draftName: string, token?: string): Promise<{ branch: string; pulled: boolean }> {
  const git = simpleGit(repoPath)
  const info = await git.branch()
  const base = info.all.includes('main') ? 'main' : info.all.includes('master') ? 'master' : 'main'
  await clearStaleIndexLock(repoPath)
  await git.checkout(base)
  let pulled = false
  try {
    const auth = await prepareRemoteAuth(git, token)
    await git.raw([...auth, 'pull', '--ff-only'])
    pulled = true
  } catch {
    // offline / no remote / non-ff — branch from local base with pulled=false
  }
  const branch = slugifyDraft(draftName)
  await git.checkoutLocalBranch(branch)
  return { branch, pulled }
}

/**
 * Fetch origin's base branch and fast-forward the local Live Version when possible.
 * Never disturbs the current branch or working tree; diverged/non-ff cases are left as-is.
 * Returns whether the local base advanced.
 */
export async function refreshMain(repoPath: string, token?: string): Promise<{ updated: boolean }> {
  const git = simpleGit(repoPath)
  const info = await git.branch()
  const base = info.all.includes('main') ? 'main' : info.all.includes('master') ? 'master' : 'main'
  const before = await git.revparse([base]).catch(() => '')
  const auth = await prepareRemoteAuth(git, token)
  try {
    await git.raw([...auth, 'fetch', 'origin', base])
  } catch {
    return { updated: false } // offline / no remote
  }
  await clearStaleIndexLock(repoPath)
  const current = (await git.status()).current
  if (current === base) {
    try { await git.merge(['--ff-only', `origin/${base}`]) } catch { /* diverged — leave local as-is */ }
  } else {
    // Advance the local base ref to origin without checking it out (fast-forward only).
    try { await git.raw([...auth, 'fetch', 'origin', `${base}:${base}`]) } catch { /* non-ff — ignore */ }
  }
  const after = await git.revparse([base]).catch(() => '')
  return { updated: before !== after }
}

export type UpdateFromLiveResult =
  | { ok: true; updated: boolean }
  | { ok: false; conflicted: true; files: string[] }

/**
 * Bring the current draft up to date with the Live Version (origin base branch) before publishing.
 * Merges cleanly when possible; on a real overlap it aborts the merge so the draft is left untouched.
 */
export async function updateFromLive(repoPath: string, token?: string): Promise<UpdateFromLiveResult> {
  const git = simpleGit(repoPath)
  const info = await git.branch()
  const base = info.all.includes('main') ? 'main' : info.all.includes('master') ? 'master' : 'main'

  // Fetch the latest Live Version. Offline / no remote => nothing to merge, proceed.
  try {
    const auth = await prepareRemoteAuth(git, token)
    await git.raw([...auth, 'fetch', 'origin', base])
  } catch {
    return { ok: true, updated: false }
  }

  // Anything new on origin/base the draft doesn't already have?
  const behind = (await git.raw(['rev-list', '--count', `HEAD..origin/${base}`])).trim()
  if (behind === '0') return { ok: true, updated: false }

  await clearStaleIndexLock(repoPath)
  try {
    await git.merge([`origin/${base}`])
    return { ok: true, updated: true }
  } catch {
    // Conflict: capture overlapping files, then abort so the working tree is exactly as the user left it.
    const files = (await git.raw(['diff', '--name-only', '--diff-filter=U']))
      .split('\n').map(s => s.trim()).filter(Boolean)
    await git.merge(['--abort'])
    return { ok: false, conflicted: true, files }
  }
}
