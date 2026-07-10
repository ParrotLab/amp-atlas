import { useEffect, useState } from 'react'
import Modal from './Modal'
import Button from './Button'
import Input from './Input'

interface MoveToModalProps {
  isOpen: boolean
  itemName: string
  folders: string[]              // system-relative destination folders
  onPick: (folderRel: string) => void
  onCancel: () => void
}

export default function MoveToModal({ isOpen, itemName, folders, onPick, onCancel }: MoveToModalProps) {
  const [filter, setFilter] = useState('')
  useEffect(() => { if (isOpen) setFilter('') }, [isOpen])
  const shown = folders.filter(f => f.toLowerCase().includes(filter.toLowerCase()))
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={`Move “${itemName}” to…`}
      footer={<Button variant="ghost" onClick={onCancel}>Cancel</Button>}
    >
      <Input placeholder="Filter folders" value={filter} onChange={e => setFilter(e.target.value)} />
      <div style={{ maxHeight: 240, overflowY: 'auto', marginTop: 10 }}>
        {shown.length === 0 && <div className="modal-hint">No folders</div>}
        {shown.map(f => (
          <button key={f} className="tcm-item" style={{ width: '100%', textAlign: 'left' }} onClick={() => onPick(f)}>{f}</button>
        ))}
      </div>
    </Modal>
  )
}
