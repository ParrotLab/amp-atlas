import { useState, useEffect } from 'react'
import SystemCard from '../components/SystemCard'
import JumpBackInCard from '../components/JumpBackInCard'
import { iconMap, BookIcon, GlobeIcon } from '../components/SystemIcons'
import { getSystems, SystemConfig, SYSTEMS_CHANGED_EVENT } from '../utils/systemStore'
import { listActive } from '../utils/draftStore'
import { getLastPull, setLastPull, relativeTime } from '../utils/pullStatus'
import { getPlaybookCount } from '../utils/playbookCount'
import { cardMeta } from '../utils/systemCardMeta'
import { useProfile } from '../hooks/useProfile'
import NewSystemModal from '../components/NewSystemModal'
import { reviewVariant, reviewLabel, BadgeVariant } from '../components/Badge'
import './Dashboard.css'

function humanize(branch: string): string {
  return branch
    .replace(/^(draft|feature|fix|hotfix)\//i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

interface DraftInfo {
  systemId: string
  systemName: string
  systemColor: string
  systemIcon: string
  branchName: string
  displayName: string
  modifiedCount: number
  badgeVariant: BadgeVariant
  badgeLabel: string
}

export default function Dashboard() {
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const profile = useProfile()
  const firstName = profile.name ? profile.name.split(' ')[0] : ''
  const [systems, setSystems] = useState<SystemConfig[]>([])
  const [drafts, setDrafts] = useState<DraftInfo[]>([])
  const [metas, setMetas] = useState<Record<string, string>>({})
  const [showAddSystem, setShowAddSystem] = useState(false)

  useEffect(() => {
    setSystems(getSystems())
    const reread = () => setSystems(getSystems())
    window.addEventListener('focus', reread)
    window.addEventListener(SYSTEMS_CHANGED_EVENT, reread)
    return () => { window.removeEventListener('focus', reread); window.removeEventListener(SYSTEMS_CHANGED_EVENT, reread) }
  }, [])

  // Silently refresh connected systems on open (throttled), then build each card's meta
  // line: "N playbooks · Updated 2h ago" (last-updated comes from the latest commit, not
  // the local refresh time, which would always read "just now").
  useEffect(() => {
    const load = async () => {
      const connected = getSystems().filter(s => s.folderPath)
      for (const sys of connected) {
        const folder = sys.folderPath
        const last = getLastPull(folder)
        if (!last || Date.now() - last >= 60_000) {
          const r = await window.api.git.refreshMain(folder)
          if (r.ok) setLastPull(folder, Date.now())
        }
      }
      const nextMetas: Record<string, string> = {}
      for (const sys of getSystems()) {
        if (!sys.folderPath) { nextMetas[sys.id] = cardMeta(false, null, ''); continue }
        const playbooks = await getPlaybookCount(sys.folderPath)
        let updatedRel = ''
        try {
          const lg = await window.api.git.log(sys.folderPath, 1)
          const date = lg.ok && lg.log && lg.log[0] ? lg.log[0].date : null
          if (date) updatedRel = relativeTime(Date.parse(date), Date.now())
        } catch { /* ignore */ }
        nextMetas[sys.id] = cardMeta(true, playbooks, updatedRel)
      }
      setMetas(nextMetas)
    }
    void load()
  }, [systems.length])

  useEffect(() => {
    const loadDrafts = async () => {
      const allDrafts: DraftInfo[] = []
      for (const sys of systems) {
        if (!sys.folderPath) continue
        const registered = listActive(sys.id)
        if (registered.length === 0) continue

        let current: string | null = null
        let modifiedCount = 0
        try {
          const statusResult = await window.api.git.status(sys.folderPath)
          if (statusResult.ok && statusResult.status) {
            current = statusResult.status.current
            modifiedCount = statusResult.status.modified.length + statusResult.status.not_added.length
          }
        } catch { /* ignore */ }

        for (const d of registered) {
          let variant: BadgeVariant = 'neutral'
          let label = 'Draft'
          if (d.branch === current) {
            try {
              const prResult = await window.api.git.prStatus(sys.folderPath)
              if (prResult.ok && prResult.hasPR) {
                variant = reviewVariant(prResult.pr?.reviewDecision)
                label = reviewLabel(prResult.pr?.reviewDecision)
              }
            } catch { /* ignore */ }
          }
          allDrafts.push({
            systemId: sys.id,
            systemName: sys.name,
            systemColor: sys.gradient,
            systemIcon: sys.icon,
            branchName: d.branch,
            displayName: d.title || humanize(d.branch),
            modifiedCount: d.branch === current ? modifiedCount : 0,
            badgeVariant: variant,
            badgeLabel: label,
          })
        }
      }
      setDrafts(allDrafts)
    }
    if (systems.length > 0) loadDrafts()
  }, [systems])

  if (systems.length === 0) {
    return (
      <div className="dashboard">
        <div className="dashboard-empty">
          <div className="dashboard-empty-badge"><GlobeIcon size={30} /></div>
          <h1 className="dashboard-empty-title">Welcome to Atlas{firstName ? `, ${firstName}` : ''}</h1>
          <p className="dashboard-empty-sub">Your systems live here — each one holds a set of playbooks you can write, refine, and publish. Add your first to get started.</p>
          <button className="dashboard-empty-btn" onClick={() => setShowAddSystem(true)}>+ Add your first system</button>
        </div>
        <NewSystemModal
          isOpen={showAddSystem}
          onClose={() => setShowAddSystem(false)}
          onCreated={() => setSystems(getSystems())}
        />
      </div>
    )
  }

  return (
    <div className="dashboard">
      <h1 className="dashboard-greeting">{greeting}{firstName ? `, ${firstName}` : ''}</h1>
      <p className="dashboard-subtitle">Here's what's happening across your systems.</p>

      <div className="dashboard-columns">
        <div className="dashboard-main">
          <div className="section-label">Your Systems</div>
          <div className="systems-grid">
            {systems.map(sys => {
              const Icon = iconMap[sys.icon] || BookIcon
              return (
                <SystemCard
                  key={sys.id}
                  name={sys.name}
                  path={`/system/${sys.id}`}
                  color={sys.gradient}
                  meta={metas[sys.id] ?? (sys.folderPath ? 'Connected' : 'Not connected')}
                  connected={!!sys.folderPath}
                  icon={<Icon size={22} />}
                />
              )
            })}
            <button className="system-add-tile" onClick={() => setShowAddSystem(true)}>
              <span className="system-add-plus">+</span>
              <span className="system-add-label">Add system</span>
            </button>
          </div>
        </div>

        <div className="dashboard-rail">
          <div className="section-label">Jump Back In</div>
          {drafts.length === 0 ? (
            <div className="rail-empty">Nothing in progress yet. Open a system to start a draft.</div>
          ) : (
            <div className="drafts-list">
              {drafts.map(draft => {
                const Icon = iconMap[draft.systemIcon] || BookIcon
                const sub = `${draft.systemName}${draft.modifiedCount > 0 ? ` · ${draft.modifiedCount} edited` : ''}`
                return (
                  <JumpBackInCard
                    key={`${draft.systemId}-${draft.branchName}`}
                    to={`/system/${draft.systemId}`}
                    title={draft.displayName}
                    subtitle={sub}
                    color={draft.systemColor}
                    icon={<Icon size={16} />}
                    badgeVariant={draft.badgeVariant}
                    badgeLabel={draft.badgeLabel}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>

      <NewSystemModal
        isOpen={showAddSystem}
        onClose={() => setShowAddSystem(false)}
        onCreated={() => setSystems(getSystems())}
      />
    </div>
  )
}
