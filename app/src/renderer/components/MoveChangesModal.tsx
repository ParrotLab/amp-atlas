import { useState, useEffect } from 'react'
import Modal from './Modal'
import Button from './Button'
import Input from './Input'

interface MoveChangesModalProps {
  isOpen: boolean
  onClose: () => void
  onMove: (name: string) => Promise<void>
}

/** Move edits made directly on the Live Version into a new draft. */
export default function MoveChangesModal({ isOpen, onClose, onMove }: MoveChangesModalProps) {
  const [name, setName] = useState('')
  const [moving, setMoving] = useState(false)

  useEffect(() => { if (isOpen) { setName(''); setMoving(false) } }, [isOpen])

  const submit = async () => {
    if (!name.trim() || moving) return
    setMoving(true)
    await onMove(name.trim())
    setMoving(false)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Move changes into a draft"
      subtitle="You've edited the Live Version directly. We'll move these changes into a new draft so you can save and publish them safely — the Live Version stays untouched."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim() || moving} onClick={submit}>
            {moving ? 'Moving…' : 'Move into a draft'}
          </Button>
        </>
      }
    >
      <div className="modal-field-label">Name your draft</div>
      <Input
        autoFocus
        type="text"
        placeholder="e.g. Q2 content updates"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && name.trim()) submit() }}
      />
    </Modal>
  )
}
