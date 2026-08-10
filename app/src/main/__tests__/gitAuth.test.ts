import { describe, it, expect, vi } from 'vitest'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { simpleGit } from 'simple-git'
import { authConfigArgs, ensureHttpsRemote, prepareRemoteAuth } from '../gitAuth'
import { buildAuthHeader } from '../authHeader'

async function repoWithOrigin(originUrl: string): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'amp-auth-'))
  const git = simpleGit(dir)
  await git.init()
  await git.addRemote('origin', originUrl)
  return dir
}

describe('authConfigArgs', () => {
  it('injects the extraheader git config scoped to github https', () => {
    expect(authConfigArgs('tok123')).toEqual([
      '-c',
      `http.https://github.com/.extraheader=${buildAuthHeader('tok123')}`,
    ])
  })
})

describe('ensureHttpsRemote', () => {
  it('rewrites an ssh origin to https and returns the new url', async () => {
    const setUrl = vi.fn(async () => {})
    const result = await ensureHttpsRemote('git@github.com:ParrotLab/marketing_system.git', setUrl)
    expect(result).toBe('https://github.com/ParrotLab/marketing_system.git')
    expect(setUrl).toHaveBeenCalledWith('https://github.com/ParrotLab/marketing_system.git')
  })

  it('leaves an already-canonical https origin untouched (no write)', async () => {
    const setUrl = vi.fn(async () => {})
    const result = await ensureHttpsRemote('https://github.com/ParrotLab/marketing_system.git', setUrl)
    expect(result).toBe('https://github.com/ParrotLab/marketing_system.git')
    expect(setUrl).not.toHaveBeenCalled()
  })

  it('leaves a non-github origin untouched (no write)', async () => {
    const setUrl = vi.fn(async () => {})
    const result = await ensureHttpsRemote('git@gitlab.com:x/y.git', setUrl)
    expect(result).toBe('git@gitlab.com:x/y.git')
    expect(setUrl).not.toHaveBeenCalled()
  })
})

describe('prepareRemoteAuth', () => {
  it('rewrites an ssh origin to https and returns auth args when given a token', async () => {
    const dir = await repoWithOrigin('git@github.com:ParrotLab/marketing_system.git')
    const git = simpleGit(dir)
    const args = await prepareRemoteAuth(git, 'tok123')
    expect(args).toEqual(authConfigArgs('tok123'))
    expect((await git.remote(['get-url', 'origin']))?.trim())
      .toBe('https://github.com/ParrotLab/marketing_system.git')
  })

  it('returns no auth args and does not touch origin without a token', async () => {
    const dir = await repoWithOrigin('git@github.com:ParrotLab/marketing_system.git')
    const git = simpleGit(dir)
    const args = await prepareRemoteAuth(git, undefined)
    expect(args).toEqual([])
    expect((await git.remote(['get-url', 'origin']))?.trim())
      .toBe('git@github.com:ParrotLab/marketing_system.git')
  })
})
