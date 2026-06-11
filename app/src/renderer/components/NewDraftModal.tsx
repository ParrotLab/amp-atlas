import { useState, useEffect, useRef } from 'react'
import './NewDraftModal.css'

interface NewDraftModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string) => Promise<void>
}

export default function NewDraftModal({ isOpen, onClose, onCreate }: NewDraftModalProps) {
  const [name, setName] = useState('')
  const [startFrom, setStartFrom] = useState<'current' | 'draft'>('current')
  const [creating, setCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setName('')
      setStartFrom('current')
      setCreating(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const handleCreate = async () => {
    if (!name.trim() || creating) return
    setCreating(true)
    await onCreate(name.trim())
    setCreating(false)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim()) {
      handleCreate()
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="new-draft-modal" onClick={e => e.stopPropagation()}>
        <div className="new-draft-title">Create New Draft</div>
        <div className="new-draft-subtitle">
          A draft is your own working copy. Your changes won't affect anyone else until you're ready to share.
        </div>

        <div className="new-draft-field">
          <div className="new-draft-label">Name your draft</div>
          <input
            ref={inputRef}
            className="new-draft-input"
            type="text"
            placeholder="e.g. Q2 content updates"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="new-draft-field">
          <div className="new-draft-label">Start from</div>
          <div className="new-draft-options">
            <div
              className={`new-draft-option ${startFrom === 'current' ? 'selected' : ''}`}
              onClick={() => setStartFrom('current')}
            >
              <div className="new-draft-radio">
                <div className="new-draft-radio-inner" />
              </div>
              <div>
                <div className="new-draft-option-title">Live Version</div>
                <div className="new-draft-option-desc">Start fresh from the latest published version</div>
              </div>
            </div>
            <div
              className={`new-draft-option ${startFrom === 'draft' ? 'selected' : ''}`}
              onClick={() => setStartFrom('draft')}
            >
              <div className="new-draft-radio">
                <div className="new-draft-radio-inner" />
              </div>
              <div>
                <div className="new-draft-option-title">
                  Current draft
                  <span className="new-draft-option-badge">Advanced</span>
                </div>
                <div className="new-draft-option-desc">Branch off your current work-in-progress</div>
              </div>
            </div>
          </div>
        </div>

        <div className="new-draft-footer">
          <button className="new-draft-btn cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`new-draft-btn ${creating ? 'creating' : 'create'}`}
            disabled={!name.trim() || creating}
            onClick={handleCreate}
          >
            {creating ? 'Creating...' : 'Create Draft'}
          </button>
        </div>
      </div>
    </div>
  )
}
