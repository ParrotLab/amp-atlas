import { describe, it, expect } from 'vitest'
import { pickActivePr, summarizeReviews } from '../github'

const pr = (over: Partial<{ number: number; title: string; state: string; merged_at: string | null; html_url: string; body: string | null }> = {}) => ({
  number: 1, title: 'PR', state: 'open', merged_at: null, html_url: 'https://gh/1', body: 'b', ...over,
})

describe('pickActivePr', () => {
  it('returns null for an empty list', () => {
    expect(pickActivePr([])).toBeNull()
  })

  it('returns an open PR as the active PR', () => {
    const active = pickActivePr([pr({ number: 7, state: 'open' })])
    expect(active).toMatchObject({ number: 7, state: 'OPEN' })
  })

  it('treats a closed-but-not-merged PR as NO active PR (fix #1)', () => {
    // A PR that was closed without merging must not surface as an active PR,
    // otherwise the submit UI wrongly shows "Add to review" instead of "Submit for review".
    expect(pickActivePr([pr({ state: 'closed', merged_at: null })])).toBeNull()
  })

  it('reports a merged PR as MERGED', () => {
    const active = pickActivePr([pr({ state: 'closed', merged_at: '2026-07-01T00:00:00Z' })])
    expect(active).toMatchObject({ state: 'MERGED' })
  })

  it('prefers the open PR when a closed one is also present', () => {
    const active = pickActivePr([
      pr({ number: 2, state: 'closed', merged_at: null }),
      pr({ number: 3, state: 'open' }),
    ])
    expect(active).toMatchObject({ number: 3, state: 'OPEN' })
  })
})

describe('summarizeReviews', () => {
  const rev = (login: string, state: string) => ({ state, user: { login } })

  it('handles no reviews', () => {
    expect(summarizeReviews([])).toEqual({ decision: null, changesRequestedBy: [] })
  })

  it('lists a reviewer who requested changes', () => {
    expect(summarizeReviews([rev('alice', 'CHANGES_REQUESTED')])).toEqual({
      decision: 'CHANGES_REQUESTED',
      changesRequestedBy: ['alice'],
    })
  })

  it('clears a reviewer once they later approve', () => {
    const r = summarizeReviews([rev('alice', 'CHANGES_REQUESTED'), rev('alice', 'APPROVED')])
    expect(r.changesRequestedBy).toEqual([])
    expect(r.decision).toBe('APPROVED')
  })

  it('clears a reviewer whose changes-requested review was dismissed', () => {
    const r = summarizeReviews([rev('alice', 'CHANGES_REQUESTED'), rev('alice', 'DISMISSED')])
    expect(r.changesRequestedBy).toEqual([])
  })

  it('ignores COMMENTED reviews and tracks per-user latest across reviewers', () => {
    const r = summarizeReviews([
      rev('alice', 'CHANGES_REQUESTED'),
      rev('bob', 'COMMENTED'),
      rev('bob', 'APPROVED'),
    ])
    expect(r.changesRequestedBy).toEqual(['alice'])
  })
})
