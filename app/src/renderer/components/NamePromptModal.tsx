import { useState } from 'react'
import Input from './Input'
import './NamePromptModal.css'

interface NamePromptModalProps {
  isOpen: boolean
  onSave: (name: string) => void
  onSkip: () => void
}

/** Shown once after connecting when GitHub has no display name for the user. */
export default function NamePromptModal({ isOpen, onSave, onSkip }: NamePromptModalProps) {
  const [value, setValue] = useState('')
  if (!isOpen) return null

  const submit = () => { if (value.trim()) onSave(value.trim()) }

  return (
    <div className="nameprompt-overlay">
      <div className="nameprompt-modal">
        <h2 className="nameprompt-title">What should we call you?</h2>
        <p className="nameprompt-body">
          Your GitHub account doesn't have a display name set. We'll use this to label your drafts and reviews — you can change it anytime in Settings.
        </p>
        <Input
          autoFocus
          value={value}
          placeholder="Your name"
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
        />
        <div className="nameprompt-actions">
          <button className="nameprompt-skip" onClick={onSkip}>Skip for now</button>
          <button className="nameprompt-primary" disabled={!value.trim()} onClick={submit}>Save</button>
        </div>
      </div>
    </div>
  )
}
