import { useState } from 'react'
import { Link } from 'react-router-dom'
import Badge from './Badge'
import { primaryColor, softTint } from '../utils/appearance'
import { InboxAction, InboxBadge } from '../utils/inboxClassify'
import './InboxRow.css'

interface InboxRowProps {
  to: string
  title: string
  meta: string
  color: string
  icon: React.ReactNode
  action: InboxAction
  badge: InboxBadge
  url: string
  publishing?: boolean
  onPublish: () => void
  onMakeEdits: () => void
}

// Match the canonical review badge variants + labels used across the app (Badge.tsx).
const BADGE = {
  approved: { variant: 'success' as const, label: 'Approved' },
  changes: { variant: 'warning' as const, label: 'Changes Requested' },
  inreview: { variant: 'brand' as const, label: 'In Review' },
}

export default function InboxRow({ to, title, meta, color, icon, action, badge, url, publishing, onPublish, onMakeEdits }: InboxRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const tint = softTint(primaryColor(color))

  const primary =
    action === 'review' ? <Link to={to} className="inboxrow-btn primary">Review</Link>
    : action === 'view' ? <Link to={to} className="inboxrow-btn ghost">View</Link>
    : action === 'make-edits' ? <button className="inboxrow-btn primary" onClick={onMakeEdits}>Make Edits</button>
    : <button className="inboxrow-btn publish" onClick={onPublish} disabled={publishing}>{publishing ? 'Publishing…' : 'Publish'}</button>

  return (
    <div className="inboxrow">
      <div className="inboxrow-chip" style={{ background: tint }}>{icon}</div>
      <div className="inboxrow-body">
        <div className="inboxrow-title">{title}</div>
        <div className="inboxrow-meta">{meta}</div>
      </div>
      <div className="inboxrow-right">
        {badge && <Badge variant={BADGE[badge].variant}>{BADGE[badge].label}</Badge>}
        {primary}
        <div className="inboxrow-menu-wrap">
          <button className="inboxrow-kebab" onClick={() => setMenuOpen(o => !o)} aria-label="More actions">⋯</button>
          {menuOpen && (
            <>
              <div className="inboxrow-menu-scrim" onClick={() => setMenuOpen(false)} />
              <div className="inboxrow-menu">
                {action === 'view' && <button className="inboxrow-menu-item" onClick={() => { setMenuOpen(false); onMakeEdits() }}>Make edits</button>}
                <button className="inboxrow-menu-item" onClick={() => { setMenuOpen(false); window.open(url) }}>View on GitHub</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
