import { useState } from 'react'
import Modal from './Modal'
import Button from './Button'
import Input from './Input'

interface NamePromptModalProps {
  isOpen: boolean
  onSave: (name: string) => void
  onSkip: () => void
}

/** Shown once after connecting when GitHub has no display name for the user. */
export default function NamePromptModal({ isOpen, onSave, onSkip }: NamePromptModalProps) {
  const [value, setValue] = useState('')
  const submit = () => { if (value.trim()) onSave(value.trim()) }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onSkip}
      title="What should we call you?"
      subtitle="Your GitHub account doesn't have a display name set. We'll use this to label your drafts and reviews — you can change it anytime in Settings."
      footer={
        <>
          <Button variant="ghost" onClick={onSkip}>Skip for now</Button>
          <Button variant="primary" disabled={!value.trim()} onClick={submit}>Save</Button>
        </>
      }
    >
      <Input
        autoFocus
        value={value}
        placeholder="Your name"
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit() }}
      />
    </Modal>
  )
}
