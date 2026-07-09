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

  // Generous budget: chokidar readiness + awaitWriteFinish can be slow under full-suite load.
  it('fires onChange with the changed path when a file is written', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'amp-watch-'))
    const seen: string[] = []
    const file = join(dir, 'note.md')
    await startWatch(dir, (paths) => seen.push(...paths))
    // Re-write on an interval until the event lands: on macOS fsevents can miss a single
    // write made in the instant after 'ready' before the watch fully engages (flaky under load).
    await new Promise<void>((resolve, reject) => {
      const t0 = Date.now()
      const iv = setInterval(() => {
        if (seen.some(p => p.endsWith('note.md'))) { clearInterval(iv); resolve() }
        else if (Date.now() - t0 > 12000) { clearInterval(iv); reject(new Error('no event')) }
        else writeFileSync(file, `hello ${Date.now()}\n`)
      }, 250)
    })
    expect(seen.some(p => p.endsWith('note.md'))).toBe(true)
  }, 15000)
})
