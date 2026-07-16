export type InboxTab = 'review' | 'publish' | 'drafts'
export type InboxAction = 'review' | 'publish' | 'make-edits' | 'view'
// 'draft' = a local draft that hasn't been submitted for review yet.
export type InboxBadge = 'approved' | 'changes' | 'inreview' | 'draft' | null

export type ReviewState = 'in_review' | 'changes_requested' | 'approved'

export interface ClassifiablePR {
  author: { login: string }
  requestedReviewers: string[]
  reviewState: ReviewState
}

export interface InboxClassification {
  tab: InboxTab | null            // null = not shown in the inbox
  action: InboxAction
  badge: InboxBadge
}

/**
 * Map an open PR + the current user's login to a tab, primary action, and badge.
 * `reviewState` already encodes precedence (a change request beats an approval, a re-requested
 * reviewer counts as pending), so we route straight off it — no order-dependent guessing.
 */
export function classifyInboxPR(pr: ClassifiablePR, login: string): InboxClassification {
  const mine = pr.author.login === login
  const pending = pr.requestedReviewers ?? []
  if (mine) {
    if (pr.reviewState === 'changes_requested') return { tab: 'drafts', action: 'make-edits', badge: 'changes' }
    if (pr.reviewState === 'approved') return { tab: 'publish', action: 'publish', badge: 'approved' }
    return { tab: 'drafts', action: 'view', badge: 'inreview' }
  }
  if (pending.includes(login)) return { tab: 'review', action: 'review', badge: null }
  return { tab: null, action: 'view', badge: null }
}
