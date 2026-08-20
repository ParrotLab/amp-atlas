import { describe, it, expect } from 'vitest'
import { pickActivePr, reviewSummary } from '../github'

const pr = (over: Partial<{ number: number; title: string; state: string; merged_at: string | null; html_url: string; body: string | null; draft: boolean }> = {}) => ({
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

  it('carries the draft flag (defaults to false)', () => {
    expect(pickActivePr([pr({ state: 'open', draft: true })])).toMatchObject({ draft: true })
    expect(pickActivePr([pr({ state: 'open' })])).toMatchObject({ draft: false })
  })
})

describe('reviewSummary', () => {
  const rev = (login: string, state: string) => ({ state, user: { login } })

  it('no reviews, none requested → in_review', () => {
    expect(reviewSummary([], [])).toMatchObject({ state: 'in_review', approvedBy: [], changesRequestedBy: [] })
  })

  it('requested but not yet reviewed → in_review, pending listed', () => {
    expect(reviewSummary([], ['alice'])).toMatchObject({ state: 'in_review', pending: ['alice'] })
  })

  it('one approval, no open change-requests → approved', () => {
    expect(reviewSummary([rev('alice', 'APPROVED')], [])).toMatchObject({ state: 'approved', approvedBy: ['alice'] })
  })

  it('a change request → changes_requested', () => {
    expect(reviewSummary([rev('alice', 'CHANGES_REQUESTED')], [])).toMatchObject({
      state: 'changes_requested', changesRequestedBy: ['alice'],
    })
  })

  it('change-request BEATS an approval regardless of order (fix)', () => {
    // bob requests changes, then alice approves LAST — must still be blocked.
    const r = reviewSummary([rev('bob', 'CHANGES_REQUESTED'), rev('alice', 'APPROVED')], [])
    expect(r.state).toBe('changes_requested')
    expect(r.approvedBy).toEqual(['alice'])
    expect(r.changesRequestedBy).toEqual(['bob'])
  })

  it('per-user latest: a reviewer who approves after their own change-request no longer blocks', () => {
    const r = reviewSummary([rev('alice', 'CHANGES_REQUESTED'), rev('alice', 'APPROVED')], [])
    expect(r.state).toBe('approved')
    expect(r.changesRequestedBy).toEqual([])
  })

  it('a re-requested reviewer is pending — their prior change-request no longer blocks', () => {
    const r = reviewSummary([rev('alice', 'CHANGES_REQUESTED')], ['alice'])
    expect(r.state).toBe('in_review')
    expect(r.changesRequestedBy).toEqual([])
    expect(r.pending).toEqual(['alice'])
  })

  it('DISMISSED clears a reviewer; COMMENTED is ignored', () => {
    expect(reviewSummary([rev('alice', 'CHANGES_REQUESTED'), rev('alice', 'DISMISSED')], []).changesRequestedBy).toEqual([])
    expect(reviewSummary([rev('bob', 'COMMENTED'), rev('bob', 'APPROVED')], []).state).toBe('approved')
  })

  it('reviewers union includes approved, changes-requested, and pending', () => {
    const r = reviewSummary([rev('alice', 'APPROVED'), rev('bob', 'CHANGES_REQUESTED')], ['carol'])
    expect(r.reviewers.sort()).toEqual(['alice', 'bob', 'carol'])
  })
})
