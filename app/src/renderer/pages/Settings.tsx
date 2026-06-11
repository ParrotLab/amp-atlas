import { useState, useEffect } from 'react'
import { getSystems, updateSystemFolder, addSystem, removeSystem, updateSystem, SystemConfig } from '../utils/systemStore'
import './Settings.css'

const gradientOptions = [
  { label: 'Violet', value: 'linear-gradient(135deg, #8B2BFF, #A855FF)', color: '#8B2BFF' },
  { label: 'Orange', value: 'linear-gradient(135deg, #FF7B00, #FFB875)', color: '#FF7B00' },
  { label: 'Plum', value: 'linear-gradient(135deg, #3D0052, #7A3D8F)', color: '#3D0052' },
  { label: 'Green', value: 'linear-gradient(135deg, #16A34A, #22C55E)', color: '#16A34A' },
  { label: 'Blue', value: 'linear-gradient(135deg, #2563EB, #60A5FA)', color: '#2563EB' },
  { label: 'Rose', value: 'linear-gradient(135deg, #E11D48, #FB7185)', color: '#E11D48' },
  { label: 'Amber', value: 'linear-gradient(135deg, #D97706, #FCD34D)', color: '#D97706' },
  { label: 'Teal', value: 'linear-gradient(135deg, #0D9488, #5EEAD4)', color: '#0D9488' },
]

export default function Settings() {
  const [systems, setSystems] = useState<SystemConfig[]>([])
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null)
  const [editingName, setEditingName] = useState<string | null>(null)

  useEffect(() => {
    setSystems(getSystems())
  }, [])

  const handleSelectFolder = async (systemId: string) => {
    const result = await window.api.dialog.selectFolder()
    if (result.ok && result.path) {
      const updated = updateSystemFolder(systemId, result.path)
      setSystems(updated)
    }
  }

  const handleChangeColor = (systemId: string, gradient: string) => {
    const updated = updateSystem(systemId, { gradient })
    setSystems(updated)
    setColorPickerFor(null)
  }

  const handleChangeName = (systemId: string, name: string) => {
    if (name.trim()) {
      const updated = updateSystem(systemId, { name: name.trim() })
      setSystems(updated)
    }
    setEditingName(null)
  }

  const handleAddSystem = () => {
    const name = prompt('Name your new system:')
    if (!name?.trim()) return
    const updated = addSystem(name.trim(), 'book', gradientOptions[0].value)
    setSystems(updated)
  }

  const handleRemoveSystem = (systemId: string, systemName: string) => {
    const confirmed = window.confirm(`Remove "${systemName}"?\n\nThis only removes it from AMP UP — your files won't be deleted.`)
    if (!confirmed) return
    const updated = removeSystem(systemId)
    setSystems(updated)
  }

  return (
    <div className="settings-page">
      <div className="settings-inner">
        <div className="settings-header">
          <h1 className="settings-title">Settings</h1>
          <p className="settings-subtitle">Manage your systems and preferences.</p>
        </div>

        <div className="settings-section">
          <div className="settings-section-header">
            <span className="settings-section-title">Your Systems</span>
            <button className="settings-add-btn" onClick={handleAddSystem}>+ Add System</button>
          </div>
          <div className="settings-systems">
            {systems.map(sys => (
              <div key={sys.id} className="settings-system">
                <div
                  className="settings-system-color"
                  style={{ background: sys.gradient }}
                  onClick={() => setColorPickerFor(colorPickerFor === sys.id ? null : sys.id)}
                >
                  {sys.name.charAt(0)}
                  <div className="settings-system-color-edit">&#x270E;</div>

                  {colorPickerFor === sys.id && (
                    <>
                      <div className="color-picker-overlay" onClick={(e) => { e.stopPropagation(); setColorPickerFor(null) }} />
                      <div className="color-picker" onClick={e => e.stopPropagation()}>
                        {gradientOptions.map(opt => (
                          <div
                            key={opt.value}
                            className={`color-picker-swatch ${sys.gradient === opt.value ? 'active' : ''}`}
                            style={{ background: opt.value }}
                            onClick={() => handleChangeColor(sys.id, opt.value)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="settings-system-info">
                  {editingName === sys.id ? (
                    <input
                      className="settings-system-name-input"
                      defaultValue={sys.name}
                      autoFocus
                      onBlur={e => handleChangeName(sys.id, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    />
                  ) : (
                    <div className="settings-system-name" onClick={() => setEditingName(sys.id)} style={{ cursor: 'pointer' }}>
                      {sys.name}
                    </div>
                  )}
                  {sys.folderPath ? (
                    <div className="settings-system-path">{sys.folderPath}</div>
                  ) : (
                    <div className="settings-system-path empty">No folder connected</div>
                  )}
                </div>

                <div className="settings-system-actions">
                  <button
                    className={`settings-btn ${sys.folderPath ? '' : 'primary'}`}
                    onClick={() => handleSelectFolder(sys.id)}
                  >
                    {sys.folderPath ? 'Change' : 'Connect'}
                  </button>
                  <button
                    className="settings-btn danger"
                    onClick={() => handleRemoveSystem(sys.id, sys.name)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title" style={{ marginBottom: '14px' }}>Account</div>
          <div className="settings-info-card">
            <div className="settings-info-label">Signed in as</div>
            <div className="settings-info-value">Rose &middot; Parrot Labs</div>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title" style={{ marginBottom: '14px' }}>About</div>
          <div className="settings-info-card">
            <div className="settings-info-label">Version</div>
            <div className="settings-info-value">AI Momentum Protocols v0.1.0</div>
          </div>
        </div>
      </div>
    </div>
  )
}
