import { useState, useEffect } from 'react'
import { getSystems, removeSystem, SystemConfig } from '../utils/systemStore'
import { iconMap, RefreshIcon, PencilIcon } from '../components/SystemIcons'
import { primaryColor, softTint } from '../utils/appearance'
import { useToast } from '../components/Toast'
import { SUPPORT_FORM_URL, shouldOpenForm } from '../utils/support'
import ResyncModal from '../components/ResyncModal'
import NewSystemModal from '../components/NewSystemModal'
import { useProfile } from '../hooks/useProfile'
import './Settings.css'

export default function Settings() {
  const [systems, setSystems] = useState<SystemConfig[]>([])
  const [editSystem, setEditSystem] = useState<SystemConfig | null>(null)
  const [identity, setIdentity] = useState<{ login: string } | null>(null)
  const [resyncFor, setResyncFor] = useState<SystemConfig | null>(null)
  const [showAddSystem, setShowAddSystem] = useState(false)
  const profile = useProfile()
  const { showToast } = useToast()

  useEffect(() => {
    setSystems(getSystems())
    window.api.auth.identity().then(r => setIdentity(r.identity))
  }, [])

  const handleConnectGitHub = async () => {
    const d = await window.api.auth.startDeviceFlow()
    if (!d.ok || !d.deviceCode) { showToast(d.error || "Couldn't start GitHub connection"); return }
    navigator.clipboard.writeText(d.userCode!)
    window.open(d.verificationUri!)
    showToast(`Enter code ${d.userCode} on GitHub (copied). Waiting…`)
    const r = await window.api.auth.pollToken(d.deviceCode, d.interval || 5)
    if (r.connected) { const id = await window.api.auth.identity(); setIdentity(id.identity); showToast('Connected to GitHub.') }
    else showToast('GitHub connection did not complete.')
  }

  const handleSignOut = async () => { await window.api.auth.signOut(); setIdentity(null); showToast('Signed out of GitHub.') }

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
    else showToast('Logs copied — paste them to your team lead.')
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
              <div className="settings-info-value">{identity ? `Connected as ${profile.name ? `${profile.name} · ` : ''}@${identity.login}` : 'Connect GitHub to publish drafts and review changes.'}</div>
            </div>
            {identity
              ? <button className="settings-btn danger" onClick={handleSignOut}>Sign out</button>
              : <button className="settings-btn primary" onClick={handleConnectGitHub}>Connect to GitHub</button>}
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title" style={{ marginBottom: '14px' }}>About</div>
          <div className="settings-info-card">
            <div className="settings-info-label">Version</div>
            <div className="settings-info-value">AI Momentum Protocols v0.1.0</div>
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
