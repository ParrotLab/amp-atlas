import { describe, it, expect } from 'vitest'
import { parseOwnerRepo } from '../githubUrl'

describe('parseOwnerRepo', () => {
  it('parses https with .git', () => {
    expect(parseOwnerRepo('https://github.com/ParrotLab/amp-atlas.git')).toEqual({ owner: 'ParrotLab', repo: 'amp-atlas' })
  })
  it('parses https without .git', () => {
    expect(parseOwnerRepo('https://github.com/ParrotLab/amp-atlas')).toEqual({ owner: 'ParrotLab', repo: 'amp-atlas' })
  })
  it('parses ssh', () => {
    expect(parseOwnerRepo('git@github.com:ParrotLab/amp-atlas.git')).toEqual({ owner: 'ParrotLab', repo: 'amp-atlas' })
  })
  it('returns null for a non-github url', () => {
    expect(parseOwnerRepo('https://example.com/x/y')).toBeNull()
  })
})
