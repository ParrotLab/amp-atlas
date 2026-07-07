import { useEffect } from 'react'
import './ConfirmSwitchModal.css'

interface ConfirmSwitchModalProps {
  isOpen: boolean
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export default function ConfirmSwitchModal({ isOpen, onSave, onDiscard, onCancel }: ConfirmSwitchModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div className="confirm-switch-overlay" onClick={onCancel}>
      <div className="confirm-switch-modal" onClick={e => e.stopPropagation()}>
        <div className="confirm-switch-title">You have unsaved edits in this draft</div>
        <div className="confirm-switch-body">
          Save them before switching, or discard them? Discarding can’t be undone.
        </div>
        <div className="confirm-switch-actions">
          <button className="confirm-switch-btn ghost" onClick={onCancel}>Cancel</button>
          <button className="confirm-switch-btn danger" onClick={onDiscard}>Discard</button>
          <button className="confirm-switch-btn primary" onClick={onSave}>Save &amp; switch</button>
        </div>
      </div>
    </div>
  )
}
