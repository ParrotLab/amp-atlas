import { useState, useEffect, useRef } from 'react'
import Modal from './Modal'
import Button from './Button'
import Input from './Input'
import { slugify } from '../utils/scaffold'

interface NewItemModalProps {
  isOpen: boolean
  title: string                          // e.g. "New Project"
  previewFor: (slug: string) => string   // e.g. slug => `work/${slug}/`
  initialName?: string
  onConfirm: (name: string) => void
  onCancel: () => void
}

export default function NewItemModal({ isOpen, title, previewFor, initialName, onConfirm, onCancel }: NewItemModalProps) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setName(initialName || '')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen, initialName])

  const slug = slugify(name)
  const valid = slug.length > 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={() => onConfirm(name.trim())}>Create</Button>
        </>
      }
    >
      <Input
        ref={inputRef}
        placeholder="Name"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && valid) onConfirm(name.trim()) }}
      />
      <div className="modal-hint">{valid ? previewFor(slug) : 'Enter a name'}</div>
    </Modal>
  )
}
