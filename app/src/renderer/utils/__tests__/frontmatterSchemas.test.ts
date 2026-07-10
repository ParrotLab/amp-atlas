import { describe, it, expect } from 'vitest'
import { detectFileType, getSchema } from '../frontmatterSchemas'

describe('detectFileType', () => {
  it('prefers an explicit type field', () => {
    expect(detectFileType('/any/where/notes.md', { type: 'playbook' })).toBe('playbook')
  })

  it('falls back to SKILL.md under .claude/skills', () => {
    expect(detectFileType('/repo/.claude/skills/onboarding/SKILL.md', {})).toBe('playbook')
  })

  it('does not treat other files in .claude/skills as playbooks', () => {
    expect(detectFileType('/repo/.claude/skills/onboarding/notes.md', {})).toBeNull()
  })

  it('returns null for an unrecognized file', () => {
    expect(detectFileType('/repo/docs/readme.md', {})).toBeNull()
  })
})

describe('getSchema', () => {
  it('returns ordered fields for playbook', () => {
    const fields = getSchema('playbook')!.map(f => f.key)
    expect(fields).toEqual(['name', 'description', 'system', 'sub-system', 'status'])
  })

  it('returns null for unknown type', () => {
    expect(getSchema('nope')).toBeNull()
  })
})
