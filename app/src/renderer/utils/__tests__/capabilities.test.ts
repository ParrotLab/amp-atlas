import { describe, it, expect } from 'vitest'
import { githubActionsAvailable } from '../capabilities'

describe('githubActionsAvailable', () => {
  it('true when git repo + connected + online', () => {
    expect(githubActionsAvailable({ isGitRepo: true, connected: true }, true)).toBe(true)
  })
  it('false when offline', () => {
    expect(githubActionsAvailable({ isGitRepo: true, connected: true }, false)).toBe(false)
  })
  it('false when not connected (no token)', () => {
    expect(githubActionsAvailable({ isGitRepo: true, connected: false }, true)).toBe(false)
  })
  it('false when not a git repo', () => {
    expect(githubActionsAvailable({ isGitRepo: false, connected: true }, true)).toBe(false)
  })
})
