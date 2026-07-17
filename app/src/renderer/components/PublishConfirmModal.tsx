import { useState, useEffect } from 'react'
import Modal from './Modal'
import Button from './Button'
import './PublishConfirmModal.css'

interface PublishConfirmModalProps {
  isOpen: boolean
  itemName: string
  /** Performs the merge (mergePR). Resolves with the outcome. */
  onConfirm: () => Promise<{ ok: boolean; error?: string }>
  /** Navigate to the in-app Live Version (also runs post-publish cleanup at the call site). */
  onSeeItLive: () => void
  /** Close/cancel. Ignored while publishing. */
  onClose: () => void
}

type Phase = 'confirm' | 'publishing' | 'success' | 'error'

/**
 * The publish-to-live flow: confirm → publishing → "your version is now live!" (with a "See it
 * live" button), or an inline error phase with retry. Cleanup + navigation are the call site's
 * responsibility (via onSeeItLive); this component owns the confirmation/feedback UX only.
 */
export default function PublishConfirmModal({
  isOpen, itemName, onConfirm, onSeeItLive, onClose,
}: PublishConfirmModalProps) {
  const [phase, setPhase] = useState<Phase>('confirm')
  const [errorMsg, setErrorMsg] = useState('')

  // Always start from the confirmation each time the modal is opened.
  useEffect(() => { if (isOpen) { setPhase('confirm'); setErrorMsg('') } }, [isOpen])

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
      ? <>This makes <strong>{itemName}</strong> the live version everyone sees.</>
      : undefined

  const body =
    phase === 'publishing' ? (
      <div className="pcm-status"><span className="pcm-spinner" /> Publishing…</div>
    ) : phase === 'success' ? (
      <div className="pcm-success">
        <div className="pcm-success-emoji">🎉</div>
        <h2 className="pcm-success-title">Your version is now live!</h2>
        <p className="pcm-success-sub"><strong>{itemName}</strong> is published — everyone sees it now.</p>
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
