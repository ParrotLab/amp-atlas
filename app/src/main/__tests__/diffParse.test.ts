import { describe, it, expect } from 'vitest'
import { parsePatch } from '../diffParse'

describe('parsePatch', () => {
  it('parses a unified patch into typed lines', () => {
    const patch = '@@ -1,2 +1,2 @@\n context line\n-removed\n+added'
    expect(parsePatch(patch)).toEqual([
      { type: 'header', content: '@@ -1,2 +1,2 @@' },
      { type: 'context', content: 'context line' },
      { type: 'removed', content: 'removed' },
      { type: 'added', content: 'added' },
    ])
  })
  it('returns [] for empty/undefined', () => {
    expect(parsePatch(undefined)).toEqual([])
    expect(parsePatch('')).toEqual([])
  })
})
