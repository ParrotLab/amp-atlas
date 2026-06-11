import { useState, useEffect } from 'react'
import { getSystems, updateSystemFolder, SystemConfig } from '../utils/systemStore'
import './Settings.css'

export default function Settings() {
  const [systems, setSystems] = useState<SystemConfig[]>([])

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

  return (
    <div className="settings">
      <h1 className="settings-title">Settings</h1>
      <p className="settings-subtitle">Manage your systems and preferences.</p>

      <div className="settings-section">
        <div className="settings-section-title">Your Systems</div>
        <div className="settings-system-list">
          {systems.map(sys => (
            <div key={sys.id} className="settings-system-card">
              <div className="settings-system-icon" style={{ background: sys.gradient.includes('#') ? sys.gradient.split(',')[0].replace('linear-gradient(135deg', '').trim() : '#8B2BFF' }}>
                {sys.name.charAt(0)}
              </div>
              <div className="settings-system-info">
                <div className="settings-system-name">{sys.name}</div>
                {sys.folderPath ? (
                  <div className="settings-system-path">{sys.folderPath}</div>
                ) : (
                  <div className="settings-system-path empty">No folder connected</div>
                )}
              </div>
              <button
                className={`settings-system-btn ${sys.folderPath ? '' : 'primary'}`}
                onClick={() => handleSelectFolder(sys.id)}
              >
                {sys.folderPath ? 'Change' : 'Connect'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Account</div>
        <div className="settings-info">
          <div className="settings-info-label">Signed in as</div>
          <div className="settings-info-value">Rose · Parrot Labs</div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">About</div>
        <div className="settings-info">
          <div className="settings-info-label">Version</div>
          <div className="settings-info-value">AI Momentum Protocols v0.1.0</div>
        </div>
      </div>
    </div>
  )
}
