import { describe, it, expect } from 'vitest'
import { classifyInboxPR } from '../inboxClassify'

const me = 'kristi'
const pr = (over: Partial<Parameters<typeof classifyInboxPR>[0]>) =>
  ({ author: { login: 'other' }, requestedReviewers: [], reviewState: 'in_review' as const, ...over })

describe('classifyInboxPR', () => {
  it('my approved PR is Ready to publish', () => {
    expect(classifyInboxPR(pr({ author: { login: me }, reviewState: 'approved' }), me))
      .toEqual({ tab: 'publish', action: 'publish', badge: 'approved' })
  })
  it('my changes-requested PR is a draft with Make Edits', () => {
    expect(classifyInboxPR(pr({ author: { login: me }, reviewState: 'changes_requested' }), me))
      .toEqual({ tab: 'drafts', action: 'make-edits', badge: 'changes' })
  })
  it('my in-review PR is a draft with View', () => {
    expect(classifyInboxPR(pr({ author: { login: me } }), me))
      .toEqual({ tab: 'drafts', action: 'view', badge: 'inreview' })
  })
  it("someone else's PR requesting my review is Needs your review", () => {
    expect(classifyInboxPR(pr({ requestedReviewers: [me] }), me))
      .toEqual({ tab: 'review', action: 'review', badge: null })
  })
  it("someone else's PR not requesting me is hidden", () => {
    expect(classifyInboxPR(pr({ requestedReviewers: ['other2'] }), me).tab).toBeNull()
  })
  it('tolerates a PR missing requestedReviewers without throwing', () => {
    const partial = { author: { login: 'other' }, reviewState: 'in_review' } as unknown as Parameters<typeof classifyInboxPR>[0]
    expect(() => classifyInboxPR(partial, me)).not.toThrow()
    expect(classifyInboxPR(partial, me).tab).toBeNull()
  })
  it('changes-requested wins even with a pending reviewer (state already resolved upstream)', () => {
    // reviewSummary already treats a re-requested reviewer as pending; a 'changes_requested' state
    // here means a genuine open change request → Make Edits.
    expect(classifyInboxPR(pr({ author: { login: me }, reviewState: 'changes_requested', requestedReviewers: ['reviewer1'] }), me))
      .toEqual({ tab: 'drafts', action: 'make-edits', badge: 'changes' })
  })
  it('my fresh PR out for review is In review', () => {
    expect(classifyInboxPR(pr({ author: { login: me }, requestedReviewers: ['reviewer1'] }), me))
      .toEqual({ tab: 'drafts', action: 'view', badge: 'inreview' })
  })
})
