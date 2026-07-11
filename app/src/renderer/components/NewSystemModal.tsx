import { useState, useEffect } from 'react'
import { addSystem, updateSystem, updateSystemFolder, SystemConfig } from '../utils/systemStore'
import { GRADIENTS, primaryColor, softTint } from '../utils/appearance'
import { iconMap, iconList } from './SystemIcons'
import Modal from './Modal'
import Button from './Button'
import './NewSystemModal.css'

interface NewSystemModalProps {
  isOpen: boolean
  system?: SystemConfig | null   // present => edit an existing system
  onClose: () => void
  onCreated: () => void          // called after create OR save
}

/** Create or edit a system: name, appearance (color + icon), and the local folder it lives in. */
export default function NewSystemModal({ isOpen, system, onClose, onCreated }: NewSystemModalProps) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('book')
  const [gradient, setGradient] = useState(GRADIENTS[0].value)
  const [folder, setFolder] = useState('')

  useEffect(() => {
    if (!isOpen) return
    if (system) { setName(system.name); setIcon(system.icon); setGradient(system.gradient); setFolder(system.folderPath) }
    else { setName(''); setIcon('book'); setGradient(GRADIENTS[0].value); setFolder('') }
  }, [isOpen, system])

  const chooseFolder = async () => {
    const r = await window.api.dialog.selectFolder()
    if (r.ok && r.path) setFolder(r.path)
  }

  const save = () => {
    if (!name.trim()) return
    if (system) {
      updateSystem(system.id, { name: name.trim(), icon, gradient })
      updateSystemFolder(system.id, folder)
    } else {
      const updated = addSystem(name.trim(), icon, gradient)
      const created = updated[updated.length - 1]
      if (folder && created) updateSystemFolder(created.id, folder)
    }
    onCreated()
    onClose()
  }

  const PreviewIcon = iconMap[icon] || iconMap['book']

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth={480}
      title={system ? 'Edit system' : 'Add a system'}
      subtitle={system
        ? 'Update this system’s name, look, or the folder its files live in.'
        : 'A system is like a vault in Obsidian — pick the folder on your computer where its files live, and give it a name and look.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={save}>{system ? 'Save changes' : 'Create system'}</Button>
        </>
      }
    >
        {/* Live preview + name */}
        <div className="newsystem-head">
          <div className="newsystem-preview" style={{ background: softTint(primaryColor(gradient)) }}>
            <PreviewIcon size={22} />
          </div>
          <input
            className="newsystem-input"
            autoFocus
            value={name}
            placeholder="System name (e.g. Marketing System)"
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save() }}
          />
        </div>

        <div className="newsystem-label">Color</div>
        <div className="newsystem-swatches">
          {GRADIENTS.map(g => (
            <button
              key={g.value}
              className={`newsystem-swatch ${gradient === g.value ? 'active' : ''}`}
              style={{ background: softTint(primaryColor(g.value)) }}
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
