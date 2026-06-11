import { useState, useEffect } from 'react'
import { getSystems, updateSystemFolder, addSystem, removeSystem, updateSystem, SystemConfig } from '../utils/systemStore'
import { iconMap, iconList } from '../components/SystemIcons'
import './Settings.css'

const gradientOptions = [
  { value: 'linear-gradient(135deg, #8B2BFF, #A855FF)' },
  { value: 'linear-gradient(135deg, #FF7B00, #FFB875)' },
  { value: 'linear-gradient(135deg, #3D0052, #7A3D8F)' },
  { value: 'linear-gradient(135deg, #16A34A, #22C55E)' },
  { value: 'linear-gradient(135deg, #2563EB, #60A5FA)' },
  { value: 'linear-gradient(135deg, #E11D48, #FB7185)' },
  { value: 'linear-gradient(135deg, #D97706, #FCD34D)' },
  { value: 'linear-gradient(135deg, #0D9488, #5EEAD4)' },
  { value: 'linear-gradient(135deg, #7C3AED, #C084FC)' },
  { value: 'linear-gradient(135deg, #0EA5E9, #7DD3FC)' },
  { value: 'linear-gradient(135deg, #1A1A2E, #4A4743)' },
  { value: 'linear-gradient(135deg, #BE185D, #F9A8D4)' },
  { value: 'linear-gradient(135deg, #059669, #A7F3D0)' },
  { value: 'linear-gradient(135deg, #DC2626, #FCA5A5)' },
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
  }

  const handleChangeIcon = (systemId: string, icon: string) => {
    const updated = updateSystem(systemId, { icon })
    setSystems(updated)
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
              <div key={sys.id} className={`settings-system ${colorPickerFor === sys.id ? 'picker-open' : ''}`}>
                <div
                  className="settings-system-color"
                  style={{ background: sys.gradient }}
                  onClick={() => setColorPickerFor(colorPickerFor === sys.id ? null : sys.id)}
                >
                  {(() => { const Icon = iconMap[sys.icon]; return Icon ? <Icon size={20} /> : sys.name.charAt(0) })()}
                  <div className="settings-system-color-edit">✎</div>

                  {colorPickerFor === sys.id && (
                    <>
                      <div className="appearance-picker-overlay" onClick={(e) => { e.stopPropagation(); setColorPickerFor(null) }} />
                      <div className="appearance-picker" onClick={e => e.stopPropagation()}>
                        <div className="appearance-picker-label">Color</div>
                        <div className="appearance-picker-grid">
                          {gradientOptions.map(opt => (
                            <div
                              key={opt.value}
                              className={`appearance-swatch ${sys.gradient === opt.value ? 'active' : ''}`}
                              style={{ background: opt.value }}
                              onClick={() => handleChangeColor(sys.id, opt.value)}
                            />
                          ))}
                        </div>
                        <div className="appearance-picker-label">Icon</div>
                        <div className="appearance-picker-grid">
                          {iconList.map(opt => {
                            const Icon = iconMap[opt.value]
                            return (
                              <div
                                key={opt.value}
                                className={`appearance-icon ${sys.icon === opt.value ? 'active' : ''}`}
                                onClick={() => handleChangeIcon(sys.id, opt.value)}
                                title={opt.label}
                              >
                                {Icon && <Icon size={16} />}
                              </div>
                            )
                          })}
                        </div>
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
