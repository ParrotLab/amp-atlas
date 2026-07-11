export type InboxTab = 'review' | 'publish' | 'drafts'
export type InboxAction = 'review' | 'publish' | 'make-edits' | 'view'
export type InboxBadge = 'approved' | 'changes' | 'inreview' | null

export interface ClassifiablePR {
  author: { login: string }
  requestedReviewers: string[]
  reviewDecision: string | null   // 'APPROVED' | 'CHANGES_REQUESTED' | null
}

export interface InboxClassification {
  tab: InboxTab | null            // null = not shown in the inbox
  action: InboxAction
  badge: InboxBadge
}

/** Map an open PR + the current user's login to a tab, primary action, and badge. */
export function classifyInboxPR(pr: ClassifiablePR, login: string): InboxClassification {
  const mine = pr.author.login === login
  if (mine) {
    if (pr.reviewDecision === 'APPROVED') return { tab: 'publish', action: 'publish', badge: 'approved' }
    if (pr.reviewDecision === 'CHANGES_REQUESTED') return { tab: 'drafts', action: 'make-edits', badge: 'changes' }
    return { tab: 'drafts', action: 'view', badge: 'inreview' }
  }
  if ((pr.requestedReviewers ?? []).includes(login)) return { tab: 'review', action: 'review', badge: null }
  return { tab: null, action: 'view', badge: null }
}
