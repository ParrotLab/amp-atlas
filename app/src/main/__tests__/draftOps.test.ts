import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { simpleGit } from 'simple-git'
import { slugifyDraft, listAdoptableBranches } from '../draftOps'

async function tempRepo(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'amp-'))
  const git = simpleGit(dir)
  await git.init()
  await git.addConfig('user.email', 't@t.com')
  await git.addConfig('user.name', 'T')
  await git.checkoutLocalBranch('main')
  writeFileSync(join(dir, 'readme.md'), '# hi\n')
  await git.add('-A')
  await git.commit('init')
  return dir
}

describe('slugifyDraft', () => {
  it('slugifies with a draft/ prefix', () => {
    expect(slugifyDraft('My Cool Draft')).toBe('draft/my-cool-draft')
  })
  it('strips leading/trailing separators', () => {
    expect(slugifyDraft('  Hello!! ')).toBe('draft/hello')
  })
})

describe('listAdoptableBranches', () => {
  it('returns local branches except main/master', async () => {
    const dir = await tempRepo()
    const git = simpleGit(dir)
    await git.branch(['feature-a'])
    await git.branch(['feature-b'])
    const names = (await listAdoptableBranches(dir)).map(b => b.name).sort()
    expect(names).toEqual(['feature-a', 'feature-b'])
  })
})
