import { useState, useEffect } from 'react'
import { addSystem, updateSystemFolder } from '../utils/systemStore'
import { GRADIENTS } from '../utils/appearance'
import { iconMap, iconList } from './SystemIcons'
import Modal from './Modal'
import Button from './Button'
import './NewSystemModal.css'

interface NewSystemModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

/** Create a new system: name, appearance (color + icon), and the local folder it lives in. */
export default function NewSystemModal({ isOpen, onClose, onCreated }: NewSystemModalProps) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('book')
  const [gradient, setGradient] = useState(GRADIENTS[0].value)
  const [folder, setFolder] = useState('')

  useEffect(() => {
    if (isOpen) { setName(''); setIcon('book'); setGradient(GRADIENTS[0].value); setFolder('') }
  }, [isOpen])

  const chooseFolder = async () => {
    const r = await window.api.dialog.selectFolder()
    if (r.ok && r.path) setFolder(r.path)
  }

  const create = () => {
    if (!name.trim()) return
    const updated = addSystem(name.trim(), icon, gradient)
    const created = updated[updated.length - 1]
    if (folder && created) updateSystemFolder(created.id, folder)
    onCreated()
    onClose()
  }

  const PreviewIcon = iconMap[icon] || iconMap['book']

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth={480}
      title="Add a system"
      subtitle="A system is like a vault in Obsidian — pick the folder on your computer where its files live, and give it a name and look."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={create}>Create system</Button>
        </>
      }
    >
        {/* Live preview + name */}
        <div className="newsystem-head">
          <div className="newsystem-preview" style={{ background: gradient }}>
            <PreviewIcon size={22} />
          </div>
          <input
            className="newsystem-input"
            autoFocus
            value={name}
            placeholder="System name (e.g. Marketing System)"
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') create() }}
          />
        </div>

        <div className="newsystem-label">Color</div>
        <div className="newsystem-swatches">
          {GRADIENTS.map(g => (
            <button
              key={g.value}
              className={`newsystem-swatch ${gradient === g.value ? 'active' : ''}`}
              style={{ background: g.value }}
              onClick={() => setGradient(g.value)}
              aria-label="Choose color"
            />
          ))}
        </div>

        <div className="newsystem-label">Icon</div>
        <div className="newsystem-icons">
          {iconList.map(opt => {
            const Ic = iconMap[opt.value]
            return (
              <button
                key={opt.value}
                className={`newsystem-icon ${icon === opt.value ? 'active' : ''}`}
                onClick={() => setIcon(opt.value)}
                title={opt.label}
              >
                {Ic && <Ic size={16} />}
              </button>
            )
          })}
        </div>

        <div className="newsystem-label">Folder</div>
        <div className="newsystem-folder">
          <button className="newsystem-folder-btn" onClick={chooseFolder}>
            {folder ? 'Change folder' : 'Choose folder…'}
          </button>
          <span className="newsystem-folder-path">{folder || 'No folder selected yet'}</span>
        </div>
    </Modal>
  )
}
