import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getPlaybookCount } from '../playbookCount'

const readDirectory = vi.fn()
beforeEach(() => {
  readDirectory.mockReset()
  ;(window as unknown as { api: unknown }).api = { fs: { readDirectory } }
})

describe('getPlaybookCount', () => {
  it('returns null for an empty folder path', async () => {
    expect(await getPlaybookCount('')).toBeNull()
    expect(readDirectory).not.toHaveBeenCalled()
  })

  it('counts only directory entries in .claude/skills', async () => {
    readDirectory.mockResolvedValue({
      ok: true,
      entries: [
        { name: 'onboarding', isDirectory: true, path: '/x' },
        { name: 'triage', isDirectory: true, path: '/y' },
        { name: 'README.md', isDirectory: false, path: '/z' },
      ],
    })
    expect(await getPlaybookCount('/repo')).toBe(2)
    expect(readDirectory).toHaveBeenCalledWith('/repo/.claude/skills')
  })

  it('returns null when the directory read fails (e.g. no .claude/skills)', async () => {
    readDirectory.mockResolvedValue({ ok: false })
    expect(await getPlaybookCount('/repo')).toBeNull()
  })

  it('returns null when the bridge throws', async () => {
    readDirectory.mockRejectedValue(new Error('boom'))
    expect(await getPlaybookCount('/repo')).toBeNull()
  })
})
