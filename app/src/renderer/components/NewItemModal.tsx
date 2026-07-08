import { useState, useEffect, useRef } from 'react'
import { slugify } from '../utils/scaffold'
import './NewItemModal.css'

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

  useEffect(() => {
    if (!isOpen) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [isOpen, onCancel])

  if (!isOpen) return null
  const slug = slugify(name)
  const valid = slug.length > 0

  return (
    <div className="new-item-overlay" onClick={onCancel}>
      <div className="new-item-modal" onClick={e => e.stopPropagation()}>
        <div className="new-item-title">{title}</div>
        <input
          ref={inputRef}
          className="new-item-input"
          placeholder="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && valid) onConfirm(name.trim()) }}
        />
        <div className="new-item-preview">{valid ? previewFor(slug) : 'Enter a name'}</div>
        <div className="new-item-actions">
          <button className="new-item-btn ghost" onClick={onCancel}>Cancel</button>
          <button className="new-item-btn primary" disabled={!valid} onClick={() => onConfirm(name.trim())}>Create</button>
        </div>
      </div>
    </div>
  )
}
