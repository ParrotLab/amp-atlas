import { describe, it, expect } from 'vitest'
import { classifyInboxPR } from '../inboxClassify'

const me = 'kristi'
const pr = (over: Partial<Parameters<typeof classifyInboxPR>[0]>) =>
  ({ author: { login: 'other' }, requestedReviewers: [], reviewDecision: null, ...over })

describe('classifyInboxPR', () => {
  it('my approved PR is Ready to publish', () => {
    expect(classifyInboxPR(pr({ author: { login: me }, reviewDecision: 'APPROVED' }), me))
      .toEqual({ tab: 'publish', action: 'publish', badge: 'approved' })
  })
  it('my changes-requested PR is a draft with Make Edits', () => {
    expect(classifyInboxPR(pr({ author: { login: me }, reviewDecision: 'CHANGES_REQUESTED' }), me))
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
})
