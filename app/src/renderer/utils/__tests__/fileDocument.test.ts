import { describe, it, expect } from 'vitest'
import { parseDocument, composeDocument } from '../fileDocument'

describe('parseDocument', () => {
  it('splits frontmatter from body', () => {
    const raw = '---\nname: Onboarding\nstatus: Active\n---\n# Hello\n\nBody.\n'
    const doc = parseDocument(raw)
    expect(doc.data).toEqual({ name: 'Onboarding', status: 'Active' })
    expect(doc.body.trim()).toBe('# Hello\n\nBody.'.trim())
  })

  it('handles files with no frontmatter', () => {
    const doc = parseDocument('# Just a title\n')
    expect(doc.data).toEqual({})
    expect(doc.body.trim()).toBe('# Just a title')
  })
})

describe('composeDocument', () => {
  it('round-trips, preserving unknown keys', () => {
    const raw = '---\nname: Onboarding\ncustom_field: keep-me\n---\nBody text.\n'
    const doc = parseDocument(raw)
    const out = composeDocument({ ...doc.data, name: 'Renamed' }, doc.body)
    const reparsed = parseDocument(out)
    expect(reparsed.data.name).toBe('Renamed')
    expect(reparsed.data.custom_field).toBe('keep-me')
  })

  it('emits no frontmatter fence when data is empty', () => {
    const out = composeDocument({}, '# Title\n')
    expect(out.startsWith('---')).toBe(false)
    expect(out).toContain('# Title')
  })
})
