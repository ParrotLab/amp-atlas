import { describe, it, expect } from 'vitest'
import { parseOwnerRepo, toHttpsRemoteUrl } from '../githubUrl'

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

describe('toHttpsRemoteUrl', () => {
  it('rewrites an ssh remote to the canonical https url', () => {
    expect(toHttpsRemoteUrl('git@github.com:example-org/other-repo.git'))
      .toBe('https://github.com/example-org/other-repo.git')
  })
  it('leaves an https remote unchanged (idempotent)', () => {
    expect(toHttpsRemoteUrl('https://github.com/example-org/other-repo.git'))
      .toBe('https://github.com/example-org/other-repo.git')
  })
  it('canonicalizes an https remote missing the .git suffix', () => {
    expect(toHttpsRemoteUrl('https://github.com/example-org/other-repo'))
      .toBe('https://github.com/example-org/other-repo.git')
  })
  it('returns null for a non-github url', () => {
    expect(toHttpsRemoteUrl('git@gitlab.com:x/y.git')).toBeNull()
  })
})
