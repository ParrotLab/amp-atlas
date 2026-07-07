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
