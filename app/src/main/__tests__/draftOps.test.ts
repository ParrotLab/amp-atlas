import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { simpleGit } from 'simple-git'
import { slugifyDraft, listAdoptableBranches, createDraftFromChanges, switchDraft, createDraftFromMain, updateFromLive } from '../draftOps'

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

describe('createDraftFromChanges', () => {
  it('creates a draft carrying the uncommitted changes', async () => {
    const dir = await tempRepo()
    writeFileSync(join(dir, 'readme.md'), '# hi\n\nedited outside the app\n')
    const { branch } = await createDraftFromChanges(dir, 'From Main Edits')
    const git = simpleGit(dir)
    const status = await git.status()
    expect(status.current).toBe('draft/from-main-edits')
    expect(branch).toBe('draft/from-main-edits')
    expect(status.modified).toContain('readme.md')
  })
})

describe('switchDraft', () => {
  it('checks out an existing branch', async () => {
    const dir = await tempRepo()
    await simpleGit(dir).branch(['feature-x'])
    await switchDraft(dir, 'feature-x')
    expect((await simpleGit(dir).status()).current).toBe('feature-x')
  })
})

describe('createDraftFromMain', () => {
  it('branches from main; pulled=false when there is no remote', async () => {
    const dir = await tempRepo()
    await simpleGit(dir).checkoutLocalBranch('scratch')
    const { branch, pulled } = await createDraftFromMain(dir, 'Fresh Draft')
    expect(branch).toBe('draft/fresh-draft')
    expect(pulled).toBe(false)
    expect((await simpleGit(dir).status()).current).toBe('draft/fresh-draft')
  })
})

// Helper: give `dir` an origin remote (bare clone) so fetch works, and return the origin's working clone.
async function withOrigin(dir: string): Promise<{ originWork: string }> {
  const bare = mkdtempSync(join(tmpdir(), 'amp-bare-'))
  await simpleGit(dir).raw(['clone', '--bare', dir, bare])
  await simpleGit(dir).addRemote('origin', bare)
  // A separate working clone of origin to push new base commits from.
  const originWork = mkdtempSync(join(tmpdir(), 'amp-origin-'))
  await simpleGit(originWork).clone(bare, originWork)
  await simpleGit(originWork).addConfig('user.email', 't@t.com')
  await simpleGit(originWork).addConfig('user.name', 'T')
  return { originWork }
}

describe('updateFromLive', () => {
  it('merges new base commits into the draft (updated:true)', async () => {
    const dir = await tempRepo()
    const { originWork } = await withOrigin(dir)
    // draft branches from main, edits a different file
    await simpleGit(dir).checkoutLocalBranch('draft/x')
    writeFileSync(join(dir, 'draft-note.md'), 'draft work\n')
    await simpleGit(dir).add('-A'); await simpleGit(dir).commit('draft edit')
    // meanwhile main advances on origin with a NON-overlapping file
    writeFileSync(join(originWork, 'live.md'), 'live change\n')
    await simpleGit(originWork).add('-A'); await simpleGit(originWork).commit('live edit')
    await simpleGit(originWork).push('origin', 'main')

    const res = await updateFromLive(dir)
    expect(res).toEqual({ ok: true, updated: true })
    // the live file is now present on the draft
    expect(existsSync(join(dir, 'live.md'))).toBe(true)
  })

  it('reports updated:false when the draft is already current', async () => {
    const dir = await tempRepo()
    await withOrigin(dir)
    await simpleGit(dir).checkoutLocalBranch('draft/y')
    const res = await updateFromLive(dir)
    expect(res).toEqual({ ok: true, updated: false })
  })

  it('aborts on a real overlap, leaving the draft untouched (conflicted)', async () => {
    const dir = await tempRepo()
    const { originWork } = await withOrigin(dir)
    // draft edits readme.md line
    await simpleGit(dir).checkoutLocalBranch('draft/z')
    writeFileSync(join(dir, 'readme.md'), '# hi\n\nDRAFT VERSION\n')
    await simpleGit(dir).add('-A'); await simpleGit(dir).commit('draft readme')
    const draftContent = readFileSync(join(dir, 'readme.md'), 'utf8')
    // main advances with an overlapping edit to the SAME line
    writeFileSync(join(originWork, 'readme.md'), '# hi\n\nLIVE VERSION\n')
    await simpleGit(originWork).add('-A'); await simpleGit(originWork).commit('live readme')
    await simpleGit(originWork).push('origin', 'main')

    const res = await updateFromLive(dir)
    expect(res).toEqual({ ok: false, conflicted: true, files: ['readme.md'] })
    // draft is byte-identical to before, and the tree is clean (merge aborted)
    expect(readFileSync(join(dir, 'readme.md'), 'utf8')).toBe(draftContent)
    expect((await simpleGit(dir).status()).isClean()).toBe(true)
  })
})
