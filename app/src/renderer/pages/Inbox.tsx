import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getSystems } from '../utils/systemStore'
import './Inbox.css'

interface PRItem {
  systemId: string
  systemName: string
  repoPath: string
  number: number
  title: string
  author: { login: string; name: string }
  createdAt: string
  headRefName: string
  reviewDecision: string | null
  url: string
  additions: number
  deletions: number
  changedFiles: number
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(diff / 86400000)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function avatarColor(name: string): string {
  const colors = ['#8B2BFF', '#FF7B00', '#3D0052', '#16A34A', '#2563EB', '#E11D48', '#0D9488', '#D97706']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function Inbox() {
  const [prs, setPrs] = useState<PRItem[]>([])
  const [filter, setFilter] = useState<'all' | 'review' | 'mine'>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPRs = async () => {
      setLoading(true)
      const systems = getSystems()
      const allPRs: PRItem[] = []

      for (const sys of systems) {
        if (!sys.folderPath) continue
        try {
          const result = await window.api.git.listPRs(sys.folderPath)
          if (result.ok && result.prs) {
            for (const pr of result.prs) {
              allPRs.push({ ...pr, systemId: sys.id, systemName: sys.name, repoPath: sys.folderPath })
            }
          }
        } catch { /* ignore */ }
      }

      // Sort by newest first
      allPRs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setPrs(allPRs)
      setLoading(false)
    }

    loadPRs()
  }, [])

  const filteredPRs = prs.filter(pr => {
    if (filter === 'mine') return pr.author.login === 'kristinannedowns'
    if (filter === 'review') return pr.author.login !== 'kristinannedowns'
    return true
  })

  return (
    <div className="inbox-page">
      <div className="inbox-inner">
        <div className="inbox-header">
          <h1 className="inbox-title">Inbox</h1>
          <div className="inbox-filters">
            <button className={`inbox-filter ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
            <button className={`inbox-filter ${filter === 'review' ? 'active' : ''}`} onClick={() => setFilter('review')}>To Review</button>
            <button className={`inbox-filter ${filter === 'mine' ? 'active' : ''}`} onClick={() => setFilter('mine')}>My Drafts</button>
          </div>
        </div>

        <div className="inbox-count">{filteredPRs.length} open</div>

        <div className="inbox-list">
          {loading && <div className="inbox-empty">Loading...</div>}
          {!loading && filteredPRs.length === 0 && <div className="inbox-empty">No open reviews right now.</div>}
          {!loading && filteredPRs.map(pr => (
            <Link
              key={`${pr.systemId}-${pr.number}`}
              to={`/review/${pr.systemId}/${pr.number}`}
              className="inbox-item"
            >
              <div className="inbox-item-avatar" style={{ background: avatarColor(pr.author.login) }}>
                {(pr.author.name || pr.author.login).charAt(0).toUpperCase()}
              </div>
              <div className="inbox-item-body">
                <div className="inbox-item-title">{pr.title}</div>
                <div className="inbox-item-meta">
                  {pr.author.name || pr.author.login} · {pr.systemName} · {timeAgo(pr.createdAt)}
                </div>
              </div>
              <div className="inbox-item-stats">
                <span style={{ color: '#16A34A' }}>+{pr.additions}</span>
                <span style={{ color: '#DC2626' }}>-{pr.deletions}</span>
                <span>{pr.changedFiles} files</span>
              </div>
              <span className={`inbox-item-badge ${pr.reviewDecision === 'APPROVED' ? 'approved' : pr.reviewDecision === 'CHANGES_REQUESTED' ? 'changes' : 'open'}`}>
                {pr.reviewDecision === 'APPROVED' ? 'Approved' : pr.reviewDecision === 'CHANGES_REQUESTED' ? 'Changes Requested' : 'Open'}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
