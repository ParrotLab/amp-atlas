import { describe, it, expect } from 'vitest'
import { slugify, scaffoldFor, isProtectedPath, CANONICAL_FOLDERS } from '../scaffold'

describe('slugify', () => {
  it('lowercases, dashes spaces, strips punctuation and edges', () => {
    expect(slugify('My Q3 Plan!')).toBe('my-q3-plan')
    expect(slugify('  Hello  World  ')).toBe('hello-world')
  })
})

describe('scaffoldFor', () => {
  it('playbook → .claude/skills/<name>/SKILL.md, name preserved as typed', () => {
    const { folder, files } = scaffoldFor('playbook', 'Onboarding', '2026-07-08')
    expect(folder).toBe('.claude/skills/Onboarding')
    expect(files).toHaveLength(1)
    expect(files[0].path).toBe('.claude/skills/Onboarding/SKILL.md')
    expect(files[0].content).toContain('name: Onboarding')
    expect(files[0].content).not.toContain('{{name}}')
  })

  it('project → work/<name>/pitch.md + braindump.md, spaces + case preserved', () => {
    const { files } = scaffoldFor('project', 'Launch Plan', '2026-07-08')
    expect(files.map(f => f.path).sort()).toEqual(['work/Launch Plan/braindump.md', 'work/Launch Plan/pitch.md'])
    expect(files[0].content).toContain('2026-07-08')
  })

  it('sub-system → reference/<name>/README.md, name preserved', () => {
    const { files } = scaffoldFor('sub-system', 'Sales', '2026-07-08')
    expect(files[0].path).toBe('reference/Sales/README.md')
  })
})

describe('isProtectedPath', () => {
  it('protects the canonical top-level folders exactly', () => {
    for (const f of CANONICAL_FOLDERS) expect(isProtectedPath(f)).toBe(true)
    expect(isProtectedPath('work/thing')).toBe(false)
    expect(isProtectedPath('notes.md')).toBe(false)
  })
})
