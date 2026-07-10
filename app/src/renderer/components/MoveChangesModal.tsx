import { useState, useEffect, useRef } from 'react'
import Input from './Input'
import './NewDraftModal.css'

interface MoveChangesModalProps {
  isOpen: boolean
  onClose: () => void
  onMove: (name: string) => Promise<void>
}

/** Move edits made directly on the Live Version into a new draft. Matches the New Draft modal. */
export default function MoveChangesModal({ isOpen, onClose, onMove }: MoveChangesModalProps) {
  const [name, setName] = useState('')
  const [moving, setMoving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) { setName(''); setMoving(false); setTimeout(() => inputRef.current?.focus(), 100) }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const submit = async () => {
    if (!name.trim() || moving) return
    setMoving(true)
    await onMove(name.trim())
    setMoving(false)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="new-draft-modal" onClick={e => e.stopPropagation()}>
        <div className="new-draft-title">Move changes into a draft</div>
        <div className="new-draft-subtitle">
          You've edited the Live Version directly. We'll move these changes into a new draft so you can save and publish them safely — the Live Version stays untouched.
        </div>

        <div className="new-draft-field">
          <div className="new-draft-label">Name your draft</div>
          <Input
            ref={inputRef}
            type="text"
            placeholder="e.g. Q2 content updates"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && name.trim()) submit() }}
          />
        </div>

        <div className="new-draft-footer">
          <button className="new-draft-btn cancel" onClick={onClose}>Cancel</button>
          <button
            className={`new-draft-btn ${moving ? 'creating' : 'create'}`}
            disabled={!name.trim() || moving}
            onClick={submit}
          >
            {moving ? 'Moving...' : 'Move into a draft'}
          </button>
        </div>
      </div>
    </div>
  )
}
