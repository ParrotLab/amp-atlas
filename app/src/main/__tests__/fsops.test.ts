import { describe, it, expect } from 'vitest'
import { mkdtempSync, existsSync, writeFileSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { ensureDir, createFile, move, del, listFolders } from '../fsops'

function tmp(): string { return mkdtempSync(join(tmpdir(), 'amp-fs-')) }

describe('fsops', () => {
  it('ensureDir creates nested dirs', async () => {
    const d = tmp()
    await ensureDir(join(d, 'a/b/c'))
    expect(existsSync(join(d, 'a/b/c'))).toBe(true)
  })

  it('createFile writes content and creates parents; errors if it exists', async () => {
    const d = tmp()
    const f = join(d, 'work/x/pitch.md')
    await createFile(f, 'hi')
    expect(readFileSync(f, 'utf-8')).toBe('hi')
    await expect(createFile(f, 'again')).rejects.toThrow()
  })

  it('move renames/moves and errors if the target exists', async () => {
    const d = tmp()
    writeFileSync(join(d, 'a.md'), '1')
    await move(join(d, 'a.md'), join(d, 'sub/b.md'))
    expect(existsSync(join(d, 'sub/b.md'))).toBe(true)
    expect(existsSync(join(d, 'a.md'))).toBe(false)
    writeFileSync(join(d, 'c.md'), '2')
    await expect(move(join(d, 'c.md'), join(d, 'sub/b.md'))).rejects.toThrow()
  })

  it('del removes files and folders recursively', async () => {
    const d = tmp()
    await createFile(join(d, 'work/x/pitch.md'), 'hi')
    await del(join(d, 'work/x'))
    expect(existsSync(join(d, 'work/x'))).toBe(false)
  })

  it('listFolders returns nested folders (relative), excluding .git', async () => {
    const d = tmp()
    await ensureDir(join(d, 'work/x'))
    await ensureDir(join(d, 'reference'))
    await ensureDir(join(d, '.git/objects'))
    const folders = await listFolders(d)
    expect(folders).toContain('work')
    expect(folders).toContain('work/x')
    expect(folders).toContain('reference')
    expect(folders.some(f => f.startsWith('.git'))).toBe(false)
  })
})
