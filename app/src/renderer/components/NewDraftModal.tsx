import { useState, useEffect, useRef } from 'react'
import Modal from './Modal'
import Button from './Button'
import Input from './Input'
import Badge from './Badge'
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

  const handleCreate = async () => {
    if (!name.trim() || creating) return
    setCreating(true)
    await onCreate(name.trim())
    setCreating(false)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Draft"
      subtitle="A draft is your own working copy. Your changes won't affect anyone else until you're ready to share."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim() || creating} onClick={handleCreate}>
            {creating ? 'Creating…' : 'Create Draft'}
          </Button>
        </>
      }
    >
      <div className="modal-field-label">Name your draft</div>
      <Input
        ref={inputRef}
        type="text"
        placeholder="e.g. Q2 content updates"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && name.trim()) handleCreate() }}
      />

      <div className="modal-field-label" style={{ marginTop: 16 }}>Start from</div>
      <div className="new-draft-options">
        <div className={`new-draft-option ${startFrom === 'current' ? 'selected' : ''}`} onClick={() => setStartFrom('current')}>
          <div className="new-draft-radio"><div className="new-draft-radio-inner" /></div>
          <div>
            <div className="new-draft-option-title">Live Version</div>
            <div className="new-draft-option-desc">Start fresh from the latest published version</div>
          </div>
        </div>
        <div className="new-draft-option disabled" aria-disabled="true">
          <div className="new-draft-radio"><div className="new-draft-radio-inner" /></div>
          <div>
            <div className="new-draft-option-title">
              Current draft
              <Badge variant="neutral">Advanced</Badge>
            </div>
            <div className="new-draft-option-desc">Branch off your current work-in-progress</div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
