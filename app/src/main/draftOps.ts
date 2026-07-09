import { simpleGit } from 'simple-git'

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
  const branch = slugifyDraft(draftName)
  // checkoutLocalBranch keeps the dirty working tree; changes follow onto the new branch.
  await git.checkoutLocalBranch(branch)
  return { branch }
}

/** Plain checkout of an existing branch (no stashing — the renderer resolves dirty state first). */
export async function switchDraft(repoPath: string, branch: string): Promise<void> {
  await simpleGit(repoPath).checkout(branch)
}

/** New Draft: switch to the Live Version, pull latest if possible, then branch. */
export async function createDraftFromMain(repoPath: string, draftName: string): Promise<{ branch: string; pulled: boolean }> {
  const git = simpleGit(repoPath)
  const info = await git.branch()
  const base = info.all.includes('main') ? 'main' : info.all.includes('master') ? 'master' : 'main'
  await git.checkout(base)
  let pulled = false
  try {
    await git.pull(['--ff-only'])
    pulled = true
  } catch {
    // offline / no remote / non-ff — branch from local base with pulled=false
  }
  const branch = slugifyDraft(draftName)
  await git.checkoutLocalBranch(branch)
  return { branch, pulled }
}

export type UpdateFromLiveResult =
  | { ok: true; updated: boolean }
  | { ok: false; conflicted: true; files: string[] }

/**
 * Bring the current draft up to date with the Live Version (origin base branch) before publishing.
 * Merges cleanly when possible; on a real overlap it aborts the merge so the draft is left untouched.
 */
export async function updateFromLive(repoPath: string): Promise<UpdateFromLiveResult> {
  const git = simpleGit(repoPath)
  const info = await git.branch()
  const base = info.all.includes('main') ? 'main' : info.all.includes('master') ? 'master' : 'main'

  // Fetch the latest Live Version. Offline / no remote => nothing to merge, proceed.
  try {
    await git.fetch('origin', base)
  } catch {
    return { ok: true, updated: false }
  }

  // Anything new on origin/base the draft doesn't already have?
  const behind = (await git.raw(['rev-list', '--count', `HEAD..origin/${base}`])).trim()
  if (behind === '0') return { ok: true, updated: false }

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
