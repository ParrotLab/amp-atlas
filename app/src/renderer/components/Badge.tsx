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

export type ReviewState = 'in_review' | 'changes_requested' | 'approved'

/** Map a review state to the badge variant used across the app. */
export function reviewVariant(state: ReviewState | null | undefined): BadgeVariant {
  if (state === 'approved') return 'success'
  if (state === 'changes_requested') return 'warning'
  return 'brand'
}

/** Human label for a review state (In Review / Approved / Changes Requested). */
export function reviewLabel(state: ReviewState | null | undefined): string {
  if (state === 'approved') return 'Approved'
  if (state === 'changes_requested') return 'Changes Requested'
  return 'In Review'
}
