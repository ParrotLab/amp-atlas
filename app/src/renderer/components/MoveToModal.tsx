import { useEffect, useState } from 'react'
import './NewItemModal.css'

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
  if (!isOpen) return null
  const shown = folders.filter(f => f.toLowerCase().includes(filter.toLowerCase()))
  return (
    <div className="new-item-overlay" onClick={onCancel}>
      <div className="new-item-modal" onClick={e => e.stopPropagation()}>
        <div className="new-item-title">Move “{itemName}” to…</div>
        <input className="new-item-input" placeholder="Filter folders" value={filter} onChange={e => setFilter(e.target.value)} />
        <div style={{ maxHeight: 240, overflowY: 'auto', marginTop: 10 }}>
          {shown.length === 0 && <div className="new-item-preview">No folders</div>}
          {shown.map(f => (
            <button key={f} className="tcm-item" style={{ width: '100%', textAlign: 'left' }} onClick={() => onPick(f)}>{f}</button>
          ))}
        </div>
        <div className="new-item-actions"><button className="new-item-btn ghost" onClick={onCancel}>Cancel</button></div>
      </div>
    </div>
  )
}
