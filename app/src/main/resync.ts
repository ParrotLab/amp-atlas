import { simpleGit } from 'simple-git'
import { prepareRemoteAuth } from './gitAuth'

function baseName(all: string[]): string {
  return all.includes('main') ? 'main' : all.includes('master') ? 'master' : 'main'
}

/** Unpublished work = a dirty working tree OR a local draft branch not merged into origin/base. */
export async function hasUnpublishedWork(repoPath: string): Promise<boolean> {
  const git = simpleGit(repoPath)
  const status = await git.status()
  if (!status.isClean()) return true
  const info = await git.branch()
  const base = baseName(info.all)
  const merged = new Set(
    (await git.raw(['branch', '--merged', `origin/${base}`]))
      .split('\n').map(s => s.replace('*', '').trim()).filter(Boolean),
  )
  return info.all.some(b => b !== base && !b.startsWith('remotes/') && !merged.has(b))
}

/** Hard-reset the local system to exactly match the Live Version. Destroys local changes. */
export async function resyncFromLive(repoPath: string, token?: string): Promise<{ base: string }> {
  const git = simpleGit(repoPath)
  const info = await git.branch()
  const base = baseName(info.all)
  const auth = await prepareRemoteAuth(git, token)
  await git.raw([...auth, 'fetch', 'origin', base])
  await git.checkout(base)
  await git.reset(['--hard', `origin/${base}`])
  await git.clean('f', ['-d'])
  return { base }
}
