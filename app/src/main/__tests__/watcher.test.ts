import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { shouldIgnore, startWatch, stopWatch } from '../watcher'

describe('shouldIgnore', () => {
  it('ignores .git and node_modules', () => {
    expect(shouldIgnore('/repo/.git/HEAD')).toBe(true)
    expect(shouldIgnore('/repo/node_modules/x/index.js')).toBe(true)
  })
  it('allows normal files and .claude', () => {
    expect(shouldIgnore('/repo/work/notes.md')).toBe(false)
    expect(shouldIgnore('/repo/.claude/skills/a/SKILL.md')).toBe(false)
  })
})

describe('startWatch', () => {
  afterEach(() => stopWatch())

  it('fires onChange with the changed path when a file is written', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'amp-watch-'))
    const seen: string[] = []
    await startWatch(dir, (paths) => seen.push(...paths))
    writeFileSync(join(dir, 'note.md'), 'hello\n')
    await new Promise<void>((resolve, reject) => {
      const t0 = Date.now()
      const iv = setInterval(() => {
        if (seen.some(p => p.endsWith('note.md'))) { clearInterval(iv); resolve() }
        else if (Date.now() - t0 > 4000) { clearInterval(iv); reject(new Error('no event')) }
      }, 50)
    })
    expect(seen.some(p => p.endsWith('note.md'))).toBe(true)
  })
})
