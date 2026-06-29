import { describe, it, expect } from 'vitest'
import { pickGhPath, isAuthedFromStatus } from '../gh'

describe('pickGhPath', () => {
  it('returns the first existing candidate', () => {
    const exists = (p: string) => p === '/usr/local/bin/gh'
    expect(pickGhPath(['/opt/homebrew/bin/gh', '/usr/local/bin/gh'], exists)).toBe('/usr/local/bin/gh')
  })

  it('returns null when none exist', () => {
    expect(pickGhPath(['/a/gh', '/b/gh'], () => false)).toBeNull()
  })
})

describe('isAuthedFromStatus', () => {
  it('true when logged in', () => {
    expect(isAuthedFromStatus(0, 'github.com\n  ✓ Logged in to github.com account user')).toBe(true)
  })
  it('false on non-zero exit', () => {
    expect(isAuthedFromStatus(1, 'You are not logged into any GitHub hosts.')).toBe(false)
  })
})
