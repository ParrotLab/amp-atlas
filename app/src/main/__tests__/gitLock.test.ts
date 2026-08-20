import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { clearStaleIndexLock, STALE_LOCK_MS } from '../gitLock'

describe('clearStaleIndexLock', () => {
  let repo: string
  const lock = () => join(repo, '.git', 'index.lock')

  beforeEach(async () => {
    repo = await fs.mkdtemp(join(tmpdir(), 'atlas-lock-'))
    await fs.mkdir(join(repo, '.git'), { recursive: true })
  })
  afterEach(async () => { await fs.rm(repo, { recursive: true, force: true }) })

  it('returns false when there is no lock', async () => {
    expect(await clearStaleIndexLock(repo)).toBe(false)
  })

  it('removes a stale lock and returns true', async () => {
    await fs.writeFile(lock(), '')
    const st = await fs.stat(lock())
    const removed = await clearStaleIndexLock(repo, st.mtimeMs + STALE_LOCK_MS + 1000)
    expect(removed).toBe(true)
    await expect(fs.stat(lock())).rejects.toBeTruthy()   // gone
  })

  it('leaves a fresh lock alone and returns false', async () => {
    await fs.writeFile(lock(), '')
    const st = await fs.stat(lock())
    const removed = await clearStaleIndexLock(repo, st.mtimeMs + 100)   // only 100ms "old"
    expect(removed).toBe(false)
    expect((await fs.stat(lock())).isFile()).toBe(true)   // still there
  })
})
