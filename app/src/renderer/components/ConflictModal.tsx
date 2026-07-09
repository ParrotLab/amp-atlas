import { useEffect } from 'react'
import './ConflictModal.css'

interface ConflictModalProps {
  isOpen: boolean
  files: string[]
  onClose: () => void
}

/** Calm, non-technical escalation when the Live Version changed in a way that overlaps the draft. */
export default function ConflictModal({ isOpen, files, onClose }: ConflictModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="conflict-modal-overlay" onClick={onClose}>
      <div className="conflict-modal" onClick={e => e.stopPropagation()}>
        <h2 className="conflict-modal-title">The Live Version changed while you were working</h2>
        <p className="conflict-modal-body">
          Someone published edits that overlap yours in{' '}
          {files.map((f, i) => (
            <span key={f}>
              <strong>{f}</strong>{i < files.length - 1 ? ', ' : ''}
            </span>
          ))}
          . Your draft is safe and unchanged — nothing was lost.
        </p>
        <p className="conflict-modal-body">
          To finish publishing, <strong>contact your team lead</strong> and they’ll help merge the two versions.
        </p>
        <div className="conflict-modal-actions">
          <button className="conflict-modal-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  )
}
