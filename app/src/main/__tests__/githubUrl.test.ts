import { describe, it, expect } from 'vitest'
import { parseOwnerRepo } from '../githubUrl'

describe('parseOwnerRepo', () => {
  it('parses https with .git', () => {
    expect(parseOwnerRepo('https://github.com/ParrotLab/amp-up-app.git')).toEqual({ owner: 'ParrotLab', repo: 'amp-up-app' })
  })
  it('parses https without .git', () => {
    expect(parseOwnerRepo('https://github.com/ParrotLab/amp-up-app')).toEqual({ owner: 'ParrotLab', repo: 'amp-up-app' })
  })
  it('parses ssh', () => {
    expect(parseOwnerRepo('git@github.com:ParrotLab/amp-up-app.git')).toEqual({ owner: 'ParrotLab', repo: 'amp-up-app' })
  })
  it('returns null for a non-github url', () => {
    expect(parseOwnerRepo('https://example.com/x/y')).toBeNull()
  })
})
