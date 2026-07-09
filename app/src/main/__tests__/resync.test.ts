import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { simpleGit } from 'simple-git'
import { hasUnpublishedWork, resyncFromLive } from '../resync'

async function tempRepo(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'amp-'))
  const git = simpleGit(dir)
  await git.init()
  await git.addConfig('user.email', 't@t.com')
  await git.addConfig('user.name', 'T')
  await git.checkoutLocalBranch('main')
  writeFileSync(join(dir, 'readme.md'), '# hi\n')
  await git.add('-A'); await git.commit('init')
  return dir
}

async function withOrigin(dir: string): Promise<{ originWork: string }> {
  const bare = mkdtempSync(join(tmpdir(), 'amp-bare-'))
  await simpleGit(dir).raw(['clone', '--bare', dir, bare])
  await simpleGit(dir).addRemote('origin', bare)
  await simpleGit(dir).fetch('origin', 'main')
  const originWork = mkdtempSync(join(tmpdir(), 'amp-origin-'))
  await simpleGit(originWork).clone(bare, originWork)
  await simpleGit(originWork).addConfig('user.email', 't@t.com')
  await simpleGit(originWork).addConfig('user.name', 'T')
  return { originWork }
}

describe('hasUnpublishedWork', () => {
  it('false on a clean base that matches origin', async () => {
    const dir = await tempRepo(); await withOrigin(dir)
    expect(await hasUnpublishedWork(dir)).toBe(false)
  })
  it('true when the working tree is dirty', async () => {
    const dir = await tempRepo(); await withOrigin(dir)
    writeFileSync(join(dir, 'readme.md'), '# hi\n\nedited\n')
    expect(await hasUnpublishedWork(dir)).toBe(true)
  })
  it('true when an unmerged local draft branch exists', async () => {
    const dir = await tempRepo(); await withOrigin(dir)
    await simpleGit(dir).checkoutLocalBranch('draft/x')
    writeFileSync(join(dir, 'note.md'), 'draft\n')
    await simpleGit(dir).add('-A'); await simpleGit(dir).commit('draft work')
    await simpleGit(dir).checkout('main')
    expect(await hasUnpublishedWork(dir)).toBe(true)
  })
})

describe('resyncFromLive', () => {
  it('hard-resets local state to match the Live Version', async () => {
    const dir = await tempRepo(); const { originWork } = await withOrigin(dir)
    // origin advances
    writeFileSync(join(originWork, 'live.md'), 'live\n')
    await simpleGit(originWork).add('-A'); await simpleGit(originWork).commit('live edit')
    await simpleGit(originWork).push('origin', 'main')
    // local diverges: a stray commit + an untracked file
    writeFileSync(join(dir, 'readme.md'), '# hi\n\nlocal junk\n')
    await simpleGit(dir).add('-A'); await simpleGit(dir).commit('local junk')
    writeFileSync(join(dir, 'untracked.md'), 'junk\n')

    const res = await resyncFromLive(dir)
    expect(res).toEqual({ base: 'main' })
    // now matches origin/main exactly
    expect(existsSync(join(dir, 'live.md'))).toBe(true)         // pulled from Live
    expect(existsSync(join(dir, 'untracked.md'))).toBe(false)   // cleaned
    const localHead = (await simpleGit(dir).revparse(['HEAD'])).trim()
    const originHead = (await simpleGit(dir).revparse(['origin/main'])).trim()
    expect(localHead).toBe(originHead)
    expect((await simpleGit(dir).status()).isClean()).toBe(true)
  })
})
