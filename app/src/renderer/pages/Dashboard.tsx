import { useState, useEffect } from 'react'
import SystemCard from '../components/SystemCard'
import JumpBackInCard from '../components/JumpBackInCard'
import { iconMap, BookIcon, GlobeIcon } from '../components/SystemIcons'
import { getSystems, SystemConfig, SYSTEMS_CHANGED_EVENT } from '../utils/systemStore'
import { listActive } from '../utils/draftStore'
import { getLastPull, setLastPull } from '../utils/pullStatus'
import { getPlaybookCount } from '../utils/playbookCount'
import { describeSystemStatus, metaLine, SystemStatus } from '../utils/systemStatus'
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
  const [counts, setCounts] = useState<Record<string, number | null>>({})
  const [statuses, setStatuses] = useState<Record<string, SystemStatus>>({})
  const [showAddSystem, setShowAddSystem] = useState(false)

  useEffect(() => {
    setSystems(getSystems())
    const reread = () => setSystems(getSystems())
    window.addEventListener('focus', reread)
    window.addEventListener(SYSTEMS_CHANGED_EVENT, reread)
    return () => { window.removeEventListener('focus', reread); window.removeEventListener(SYSTEMS_CHANGED_EVENT, reread) }
  }, [])

  // Silently refresh connected systems on open (throttled), then read status + playbook counts.
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
      const nextCounts: Record<string, number | null> = {}
      const nextStatuses: Record<string, SystemStatus> = {}
      for (const sys of getSystems()) {
        if (!sys.folderPath) {
          nextCounts[sys.id] = null
          nextStatuses[sys.id] = describeSystemStatus(false, false)
          continue
        }
        nextCounts[sys.id] = await getPlaybookCount(sys.folderPath)
        let hasWork = false
        try {
          const w = await window.api.git.hasUnpublishedWork(sys.folderPath)
          hasWork = !!(w.ok && w.hasWork)
        } catch { /* ignore */ }
        nextStatuses[sys.id] = describeSystemStatus(true, hasWork)
      }
      setCounts(nextCounts)
      setStatuses(nextStatuses)
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
              const status = statuses[sys.id] || describeSystemStatus(!!sys.folderPath, false)
              return (
                <SystemCard
                  key={sys.id}
                  name={sys.name}
                  path={`/system/${sys.id}`}
                  color={sys.gradient}
                  meta={metaLine(status, counts[sys.id] ?? null)}
                  tone={status.tone}
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
