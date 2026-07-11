import { useState, useEffect } from 'react'
import Modal from './Modal'
import Button from './Button'
import FolderPicker from './FolderPicker'

interface MoveToModalProps {
  isOpen: boolean
  itemName: string
  folders: string[]              // system-relative destination folders (source + descendants excluded)
  currentFolder: string          // where the item lives now ('' = top level) — the browser opens here
  onPick: (folderRel: string) => void
  onCancel: () => void
}

export default function MoveToModal({ isOpen, itemName, folders, currentFolder, onPick, onCancel }: MoveToModalProps) {
  const [dest, setDest] = useState<string | null>(null)

  // Reset the selection on close, so reopening starts fresh at the item's current folder
  // (initialBrowse) instead of wherever the last session navigated to.
  useEffect(() => {
    if (!isOpen) setDest(null)
  }, [isOpen])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={`Move “${itemName}” to…`}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" disabled={dest === null} onClick={() => dest !== null && onPick(dest)}>Move here</Button>
        </>
      }
    >
      <FolderPicker folders={folders} value={dest} onSelect={setDest} initialBrowse={currentFolder} />
      <div className="modal-hint">
        {dest === null ? 'Choose a destination' : dest === '' ? 'Top level' : dest}
      </div>
    </Modal>
  )
}
