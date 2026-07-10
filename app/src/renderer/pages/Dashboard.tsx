import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import SystemCard from '../components/SystemCard'
import { getSystems, SystemConfig } from '../utils/systemStore'
import './Dashboard.css'

const BookIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h5a3.5 3.5 0 013.5 3.5V18a2.5 2.5 0 00-2.5-2.5H2V3z"/>
    <path d="M18 3h-5a3.5 3.5 0 00-3.5 3.5V18a2.5 2.5 0 012.5-2.5H18V3z"/>
  </svg>
)

const MonitorIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3H3a1 1 0 00-1 1v10a1 1 0 001 1h14a1 1 0 001-1V4a1 1 0 00-1-1z"/>
    <path d="M2 8h16"/><path d="M6 15v3M14 15v3M4 18h12"/>
  </svg>
)

const LayersIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 2L2 6l8 4 8-4-8-4z"/><path d="M2 14l8 4 8-4"/><path d="M2 10l8 4 8-4"/>
  </svg>
)

const iconMap: Record<string, React.FC> = { book: BookIcon, monitor: MonitorIcon, layers: LayersIcon }

function humanize(branch: string): string {
  return branch
    .replace(/^(draft|feature|fix|hotfix)\//i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

interface DraftInfo {
  systemId: string
  systemName: string
  branchName: string
  displayName: string
  modifiedCount: number
  isClean: boolean
  prStatus: string | null // 'OPEN', null
  reviewDecision: string | null
}

export default function Dashboard() {
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const [systems, setSystems] = useState<SystemConfig[]>([])
  const [drafts, setDrafts] = useState<DraftInfo[]>([])

  useEffect(() => {
    setSystems(getSystems())
  }, [])

  useEffect(() => {
    const loadDrafts = async () => {
      const allDrafts: DraftInfo[] = []

      for (const sys of systems) {
        if (!sys.folderPath) continue
        try {
          const statusResult = await window.api.git.status(sys.folderPath)
          if (!statusResult.ok || !statusResult.status) continue

          const branch = statusResult.status.current
          if (!branch || branch === 'main' || branch === 'master') continue

          // Check PR status
          let prState: string | null = null
          let reviewDecision: string | null = null
          try {
            const prResult = await window.api.git.prStatus(sys.folderPath)
            if (prResult.ok && prResult.hasPR) {
              prState = prResult.pr?.state || null
              reviewDecision = prResult.pr?.reviewDecision || null
            }
          } catch { /* ignore */ }

          allDrafts.push({
            systemId: sys.id,
            systemName: sys.name,
            branchName: branch,
            displayName: humanize(branch),
            modifiedCount: statusResult.status.modified.length + statusResult.status.not_added.length,
            isClean: statusResult.status.isClean,
            prStatus: prState,
            reviewDecision
          })
        } catch { /* ignore */ }
      }

      setDrafts(allDrafts)
    }

    if (systems.length > 0) loadDrafts()
  }, [systems])

  return (
    <div className="dashboard">
      <h1 className="dashboard-greeting">{greeting}, Rose</h1>
      <p className="dashboard-subtitle">Here's what's happening across your systems.</p>

      <div className="section-label">Your Systems</div>
      <div className="systems-grid">
        {systems.map(sys => {
          const Icon = iconMap[sys.icon] || BookIcon
          return (
            <SystemCard
              key={sys.id}
              name={sys.name}
              path={`/system/${sys.id}`}
              gradient={sys.gradient}
              meta={sys.folderPath ? 'Connected' : 'Not connected'}
              connected={!!sys.folderPath}
              icon={<Icon />}
            />
          )
        })}
      </div>

      {drafts.length > 0 && (
        <>
          <div className="section-label">Jump Back In</div>
          <div className="drafts-list">
            {drafts.map(draft => (
              <Link
                key={`${draft.systemId}-${draft.branchName}`}
                to={`/system/${draft.systemId}`}
                className="draft-card"
              >
                <div className="draft-card-left">
                  <span className="draft-card-dot" />
                  <div>
                    <div className="draft-card-name">Draft: {draft.displayName}</div>
                    <div className="draft-card-system">{draft.systemName}{draft.modifiedCount > 0 ? ` · ${draft.modifiedCount} edited` : ''}</div>
                  </div>
                </div>
                <div className="draft-card-right">
                  {draft.prStatus === 'OPEN' ? (
                    <span className={`draft-card-badge ${draft.reviewDecision === 'APPROVED' ? 'approved' : draft.reviewDecision === 'CHANGES_REQUESTED' ? 'changes' : 'review'}`}>
                      {draft.reviewDecision === 'APPROVED' ? 'Approved' : draft.reviewDecision === 'CHANGES_REQUESTED' ? 'Changes Requested' : 'In Review'}
                    </span>
                  ) : (
                    <span className="draft-card-badge editing">Editing</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
