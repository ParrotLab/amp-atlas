import { useState, useEffect, useRef } from 'react'
import Modal from './Modal'
import Button from './Button'
import Input from './Input'
import FolderPicker from './FolderPicker'

interface LocationConfig {
  folders: string[]          // system-relative folders, e.g. "work/x"
  initial?: string           // '' = top level; undefined = force the user to pick
}

interface NewItemModalProps {
  isOpen: boolean
  title: string                                       // e.g. "New File"
  previewFor: (name: string, folderRel: string) => string
  initialName?: string
  confirmLabel?: string                               // e.g. "Create" | "Rename"
  location?: LocationConfig                           // present for file/folder; omitted for scaffold/rename
  onConfirm: (name: string, folderRel: string) => void
  onCancel: () => void
}

export default function NewItemModal({ isOpen, title, previewFor, initialName, confirmLabel = 'Create', location, onConfirm, onCancel }: NewItemModalProps) {
  const [name, setName] = useState('')
  // null = nothing picked yet (force selection); '' = top level; 'work/x' = that folder.
  const [folder, setFolder] = useState<string | null>('')
  const inputRef = useRef<HTMLInputElement>(null)
  const wasOpen = useRef(false)

  // Reset ONLY on the open transition. `location` is a fresh object every render, so keying
  // the reset off it would wipe the name/selection on every keystroke.
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setName(initialName || '')
      setFolder(location ? (location.initial ?? null) : '')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
    wasOpen.current = isOpen
  }, [isOpen, initialName, location])

  // Exact name — no slugifying. Spaces + capitalization are preserved (Obsidian-style).
  const trimmed = name.trim()
  const locationReady = !location || folder !== null
  const valid = trimmed.length > 0 && locationReady

  const submit = () => { if (valid) onConfirm(trimmed, folder ?? '') }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" disabled={!valid} onClick={submit}>{confirmLabel}</Button>
        </>
      }
    >
      <Input
        ref={inputRef}
        placeholder="Name"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit() }}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {trimmed.length === 0 && <div className="modal-hint">Enter a name</div>}

      {location ? (
        <>
          <div className="modal-field-label" style={{ marginTop: 16 }}>Location</div>
          <FolderPicker folders={location.folders} value={folder} onSelect={setFolder} />
          {trimmed.length > 0 && (
            <div className="modal-hint">{locationReady ? previewFor(trimmed, folder ?? '') : 'Choose a location'}</div>
          )}
        </>
      ) : (
        trimmed.length > 0 && <div className="modal-hint">{previewFor(trimmed, '')}</div>
      )}
    </Modal>
  )
}
