import { ReactNode } from 'react'

// Variants come from the design system (styles/components/badge.css .badge-*).
export type BadgeVariant = 'brand' | 'success' | 'warning' | 'error' | 'neutral'

interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}

/** A status pill/tag. */
export default function Badge({ children, variant = 'neutral', className = '' }: BadgeProps) {
  return <span className={`badge badge-${variant} ${className}`.trim()}>{children}</span>
}

/** Map a GitHub review decision to the badge variant used across the app. */
export function reviewVariant(reviewDecision: string | null | undefined): BadgeVariant {
  if (reviewDecision === 'APPROVED') return 'success'
  if (reviewDecision === 'CHANGES_REQUESTED') return 'warning'
  return 'brand'
}

/** Human label for a review decision (In Review / Approved / Changes Requested). */
export function reviewLabel(reviewDecision: string | null | undefined): string {
  if (reviewDecision === 'APPROVED') return 'Approved'
  if (reviewDecision === 'CHANGES_REQUESTED') return 'Changes Requested'
  return 'In Review'
}
