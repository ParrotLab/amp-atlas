import { useState, useEffect } from 'react'
import Modal from './Modal'
import Button from './Button'
import './PublishConfirmModal.css'

export interface ReviewerDetail {
  name: string
  status: 'approved' | 'changes_requested' | 'pending'
  at?: string   // ISO timestamp of the decisive review (approved / changes)
}

interface PublishConfirmModalProps {
  isOpen: boolean
  itemName: string
  /** Performs the merge (mergePR). Resolves with the outcome. */
  onConfirm: () => Promise<{ ok: boolean; error?: string }>
  /** Navigate to the in-app Live Version (also runs post-publish cleanup at the call site). */
  onSeeItLive: () => void
  /** Close/cancel. Ignored while publishing. */
  onClose: () => void
  /** Per-reviewer status shown on the confirm screen (optional). */
  reviews?: ReviewerDetail[]
}

type Phase = 'confirm' | 'publishing' | 'success' | 'error'

function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${Math.max(m, 1)}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const PILL = {
  approved: { cls: 'approved', label: '✓ Approved' },
  changes_requested: { cls: 'changes', label: '↻ Changes requested' },
  pending: { cls: 'pending', label: '• Pending' },
} as const

/**
 * The publish-to-live flow: confirm → publishing → "your version is now live!" (with a "See it
 * live" button), or an inline error phase with retry. Cleanup + navigation are the call site's
 * responsibility (via onSeeItLive); this component owns the confirmation/feedback UX only.
 */
export default function PublishConfirmModal({
  isOpen, itemName, onConfirm, onSeeItLive, onClose, reviews,
}: PublishConfirmModalProps) {
  const [phase, setPhase] = useState<Phase>('confirm')
  const [errorMsg, setErrorMsg] = useState('')
  // Snapshot the name when the modal opens: some call sites (the editor) switch branch during the
  // publish cleanup, which would otherwise change itemName to "Main" by the time success renders.
  const [name, setName] = useState(itemName)

  // Always start from the confirmation each time the modal is opened, snapshotting the name at that
  // moment. Intentionally keyed on isOpen only — re-snapshotting when itemName later changes (the
  // editor switches to "Main" during cleanup) would defeat the purpose.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (isOpen) { setPhase('confirm'); setErrorMsg(''); setName(itemName) } }, [isOpen])

  const runPublish = async () => {
    setPhase('publishing')
    const r = await onConfirm()
    if (r.ok) setPhase('success')
    else { setErrorMsg(r.error || 'Something went wrong.'); setPhase('error') }
  }

  // Not closable mid-publish; otherwise overlay/Escape close normally.
  const guardedClose = phase === 'publishing' ? () => {} : onClose

  const title =
    phase === 'confirm' ? 'Publish this version?'
    : phase === 'success' ? undefined
    : phase === 'error' ? "Couldn't publish"
    : undefined

  const subtitle =
    phase === 'confirm'
      ? <>This makes <strong>{name}</strong> the live version everyone sees.</>
      : undefined

  const body =
    phase === 'confirm' && reviews && reviews.length > 0 ? (
      <div className="pcm-reviews">
        <div className="pcm-reviews-label">Reviews</div>
        {reviews.map((r, i) => (
          <div key={i} className="pcm-review-row">
            <span className="pcm-review-avatar">{(r.name.trim()[0] || '?').toUpperCase()}</span>
            <span className="pcm-review-name">{r.name}</span>
            <span className={`pcm-review-pill ${PILL[r.status].cls}`}>
              {PILL[r.status].label}{r.at && r.status !== 'pending' ? ` · ${ago(r.at)}` : ''}
            </span>
          </div>
        ))}
      </div>
    ) : phase === 'publishing' ? (
      <div className="pcm-status"><span className="pcm-spinner" /> Publishing…</div>
    ) : phase === 'success' ? (
      <div className="pcm-success">
        <div className="pcm-success-emoji">🎉</div>
        <h2 className="pcm-success-title">Your version is now live!</h2>
        <p className="pcm-success-sub"><strong>{name}</strong> is published — everyone sees it now.</p>
      </div>
    ) : phase === 'error' ? (
      <div className="pcm-error">{errorMsg}</div>
    ) : undefined

  const footer =
    phase === 'confirm' ? (
      <>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={runPublish}>Publish</Button>
      </>
    ) : phase === 'success' ? (
      <>
        <Button variant="ghost" onClick={onClose}>Done</Button>
        <Button variant="primary" onClick={onSeeItLive}>See it live</Button>
      </>
    ) : phase === 'error' ? (
      <>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={runPublish}>Try again</Button>
      </>
    ) : undefined  // publishing: no footer

  return (
    <Modal isOpen={isOpen} onClose={guardedClose} title={title} subtitle={subtitle} footer={footer} maxWidth={440}>
      {body}
    </Modal>
  )
}
