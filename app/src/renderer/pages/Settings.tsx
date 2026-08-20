import { useState, useEffect } from 'react'
import { getSystems, removeSystem, SystemConfig } from '../utils/systemStore'
import { iconMap, RefreshIcon, PencilIcon } from '../components/SystemIcons'
import { primaryColor, softTint } from '../utils/appearance'
import { useToast } from '../components/Toast'
import { SUPPORT_FORM_URL, shouldOpenForm } from '../utils/support'
import ResyncModal from '../components/ResyncModal'
import NewSystemModal from '../components/NewSystemModal'
import { useProfile } from '../hooks/useProfile'
import { AUTH_CHANGED_EVENT } from '../hooks/useAuth'
import { clearStoredName } from '../utils/userProfile'
import './Settings.css'

export default function Settings() {
  const [systems, setSystems] = useState<SystemConfig[]>([])
  const [editSystem, setEditSystem] = useState<SystemConfig | null>(null)
  const [identity, setIdentity] = useState<{ login: string } | null>(null)
  const [resyncFor, setResyncFor] = useState<SystemConfig | null>(null)
  const [showAddSystem, setShowAddSystem] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const profile = useProfile()
  const { showToast } = useToast()

  useEffect(() => {
    setSystems(getSystems())
    window.api.auth.identity().then(r => setIdentity(r.identity))
    window.api.app.version().then(setAppVersion)
  }, [])

  // Sign out clears the token, wipes the local name, and announces the auth change — which drops
  // the app back to the same Connect screen used on first launch (see App.tsx / useAuth).
  const handleSignOut = async () => {
    await window.api.auth.signOut()
    clearStoredName()
    setIdentity(null)
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
  }

  const handleCopyLogs = async () => {
    const r = await window.api.diagnostics.recent()
    if (!r.ok) { showToast("Couldn't read logs."); return }
    if (!r.text.trim()) { showToast('No activity logged yet — the log fills as you use the app.'); return }
    await navigator.clipboard.writeText(r.text)
    showToast('Logs copied to clipboard.')
  }

  const handleRevealLogs = () => { window.api.diagnostics.reveal() }

  const handleReport = async () => {
    const r = await window.api.diagnostics.recent()
    if (r.ok) await navigator.clipboard.writeText(r.text)
    if (shouldOpenForm(SUPPORT_FORM_URL)) window.open(SUPPORT_FORM_URL)
    else showToast('Logs copied — attach them to a GitHub issue.')
  }

  // Step 1: user clicks Re-sync on a system row.
  const handleResyncClick = async (sys: SystemConfig) => {
    if (!sys.folderPath) return
    const r = await window.api.git.hasUnpublishedWork(sys.folderPath)
    if (r.ok && r.hasWork) { setResyncFor(sys); return }  // ask what to do first
    void confirmAndResync(sys)                             // clean: straight to strong-warning confirm
  }

  // Steps 3–4: strong-warning confirm, then hard reset.
  const confirmAndResync = async (sys: SystemConfig) => {
    if (!sys.folderPath) return
    const ok = window.confirm(
      `This replaces everything in "${sys.name}" with the Live Version from GitHub.\n\n` +
      `Any unpublished changes will be gone. This can't be undone.`,
    )
    if (!ok) return
    const r = await window.api.git.resyncFromLive(sys.folderPath)
    if (r.ok) showToast(`${sys.name} is back in sync with the Live Version.`)
    else showToast("Couldn't re-sync.", { label: 'Retry', onClick: () => { void confirmAndResync(sys) } })
  }

  const handleAddSystem = () => setShowAddSystem(true)

  const handleRemoveSystem = (systemId: string, systemName: string) => {
    const confirmed = window.confirm(`Remove "${systemName}"?\n\nThis only removes it from AMP Atlas — your files won't be deleted.`)
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
                <div className="settings-system-color" style={{ background: softTint(primaryColor(sys.gradient)) }}>
                  {(() => { const Icon = iconMap[sys.icon]; return Icon ? <Icon size={20} /> : sys.name.charAt(0) })()}
                </div>

                <div className="settings-system-info">
                  <div className="settings-system-name">{sys.name}</div>
                  {sys.folderPath ? (
                    <div className="settings-system-path">{sys.folderPath}</div>
                  ) : (
                    <div className="settings-system-path empty">No folder connected</div>
                  )}
                </div>

                <div className="settings-system-actions">
                  <button
                    className="settings-btn danger"
                    onClick={() => handleRemoveSystem(sys.id, sys.name)}
                  >
                    Remove
                  </button>
                  {sys.folderPath && (
                    <button className="settings-btn subtle" onClick={() => handleResyncClick(sys)}>
                      <RefreshIcon size={14} /> Re-sync
                    </button>
                  )}
                  <button className="settings-btn" onClick={() => setEditSystem(sys)}>
                    <PencilIcon size={14} /> Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title" style={{ marginBottom: '14px' }}>GitHub</div>
          <div className="settings-info-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="settings-info-label">Publishing &amp; review</div>
              <div className="settings-info-value">{identity ? `Connected as ${profile.name ? `${profile.name} · ` : ''}@${identity.login}` : 'Connected to GitHub.'}</div>
            </div>
            <button className="settings-btn danger" onClick={handleSignOut}>Sign out</button>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title" style={{ marginBottom: '14px' }}>About</div>
          <div className="settings-info-card">
            <div className="settings-info-label">Version</div>
            <div className="settings-info-value">AMP Atlas{appVersion ? ` v${appVersion}` : ''}</div>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title" style={{ marginBottom: '14px' }}>Diagnostics</div>
          <div className="settings-info-card">
            <div className="settings-info-label">Something not working?</div>
            <div className="settings-info-value">Copy your logs or send a report so we can help.</div>
            <div className="settings-diagnostics-actions">
              <button className="settings-btn" onClick={handleCopyLogs}>Copy logs</button>
              <button className="settings-btn" onClick={handleRevealLogs}>Reveal log file</button>
              <button className="settings-btn primary" onClick={handleReport}>Report a problem</button>
            </div>
          </div>
        </div>
      </div>

      <ResyncModal
        isOpen={resyncFor !== null}
        systemName={resyncFor?.name ?? ''}
        onPublishFirst={() => { const s = resyncFor; setResyncFor(null); if (s) showToast(`Open ${s.name} and publish your draft first.`) }}
        onDiscard={() => { const s = resyncFor; setResyncFor(null); if (s) void confirmAndResync(s) }}
        onClose={() => setResyncFor(null)}
      />
      <NewSystemModal
        isOpen={showAddSystem || !!editSystem}
        system={editSystem}
        onClose={() => { setShowAddSystem(false); setEditSystem(null) }}
        onCreated={() => setSystems(getSystems())}
      />
    </div>
  )
}
