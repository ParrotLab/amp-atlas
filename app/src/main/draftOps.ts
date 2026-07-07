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
