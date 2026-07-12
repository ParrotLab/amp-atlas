import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSystems } from '../utils/systemStore'
import { iconMap, BookIcon } from '../components/SystemIcons'
import { useOnline } from '../hooks/useOnline'
import { useProfile } from '../hooks/useProfile'
import { classifyInboxPR, InboxTab } from '../utils/inboxClassify'
import { logCrumb } from '../utils/breadcrumb'
import InboxRow from '../components/InboxRow'
import './Inbox.css'

interface Item {
  systemId: string
  systemName: string
  systemColor: string
  systemIcon: string
  repoPath: string
  number: number
  title: string
  authorName: string
  headRefName: string
  createdAt: string
  changedFiles: number
  url: string
  tab: InboxTab
  action: ReturnType<typeof classifyInboxPR>['action']
  badge: ReturnType<typeof classifyInboxPR>['badge']
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

const TABS: { key: InboxTab; label: string }[] = [
  { key: 'review', label: 'Needs your review' },
  { key: 'publish', label: 'Ready to publish' },
  { key: 'drafts', label: 'Your drafts' },
]

const EMPTY: Record<InboxTab, string> = {
  review: "You're all caught up — no reviews waiting on you.",
  publish: 'Nothing to publish right now.',
  drafts: 'No drafts in progress.',
}

// Cached across mounts so landing on the Inbox shows the last-known list
// immediately, then refreshes behind the scenes — no visible reload.
let itemsCache: Item[] = []

export default function Inbox() {
  const [items, setItems] = useState<Item[]>(() => itemsCache)
  const [tab, setTab] = useState<InboxTab>('review')
  const [loading, setLoading] = useState(itemsCache.length === 0)
  const [publishing, setPublishing] = useState<number | null>(null)
  const online = useOnline()
  const profile = useProfile()
  const navigate = useNavigate()

  const load = async () => {
    if (!online) { setLoading(false); return }
    if (!profile.login) return   // wait for identity; keep whatever we're already showing
    // No setLoading(true) here: on repeat visits we already have cached items and
    // refresh silently. The visible "Loading…" only appears on a cold first load.
    const all: Item[] = []
    for (const sys of getSystems()) {
      if (!sys.folderPath) continue
      try {
        const result = await window.api.git.listPRs(sys.folderPath)
        if (result.ok && result.prs) {
          for (const pr of result.prs) {
            const c = classifyInboxPR(pr, profile.login)
            if (!c.tab) continue
            all.push({
              systemId: sys.id, systemName: sys.name, systemColor: sys.gradient, systemIcon: sys.icon,
              repoPath: sys.folderPath, number: pr.number, title: pr.title,
              authorName: pr.author.name || pr.author.login, headRefName: pr.headRefName,
              createdAt: pr.createdAt, changedFiles: pr.changedFiles, url: pr.url,
              tab: c.tab, action: c.action, badge: c.badge,
            })
          }
        }
      } catch { /* a single system's PR fetch failing shouldn't drop the rest */ }
    }
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    itemsCache = all
    setItems(all)
    setLoading(false)
  }

  useEffect(() => { void load() }, [online, profile.login])

  const count = (t: InboxTab) => items.filter(i => i.tab === t).length
  const shown = items.filter(i => i.tab === tab)

  const metaFor = (i: Item) =>
    i.tab === 'review'
      ? `${i.authorName} · ${i.systemName} · ${i.changedFiles} file${i.changedFiles === 1 ? '' : 's'} · ${timeAgo(i.createdAt)}`
      : `${i.systemName} · ${i.changedFiles} file${i.changedFiles === 1 ? '' : 's'} · ${timeAgo(i.createdAt)}`

  const publish = async (i: Item) => {
    setPublishing(i.number)
    logCrumb(`published "${i.title}" (#${i.number}) from Inbox`)
    const r = await window.api.git.mergePR(i.repoPath, i.number)
    setPublishing(null)
    if (r.ok) { await load() } else { alert(`Couldn't publish: ${r.error}`) }
  }

  const makeEdits = async (i: Item) => {
    await window.api.git.switchBranch(i.repoPath, i.headRefName)
    navigate(`/system/${i.systemId}`)
  }

  return (
    <div className="inbox-page">
      <div className="inbox-inner">
        <h1 className="inbox-title">Inbox</h1>
        <p className="inbox-subtitle">Reviews waiting on you, and your work in progress.</p>

        <div className="inbox-tabs">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`inbox-tab ${t.key} ${tab === t.key ? 'on' : ''}`.trim()}
              onClick={() => setTab(t.key)}
            >
              {t.label} <span className="inbox-tab-count">{count(t.key)}</span>
            </button>
          ))}
        </div>

        <div className="inbox-list">
          {!online && <div className="inbox-empty">You're offline — your inbox will refresh when you reconnect.</div>}
          {online && loading && <div className="inbox-empty">Loading…</div>}
          {online && !loading && shown.length === 0 && <div className="inbox-empty">{EMPTY[tab]}</div>}
          {online && !loading && shown.map(i => (
            <InboxRow
              key={`${i.systemId}-${i.number}`}
              to={`/review/${i.systemId}/${i.number}`}
              title={i.title}
              meta={metaFor(i)}
              color={i.systemColor}
              icon={(() => { const Icon = iconMap[i.systemIcon] || BookIcon; return <Icon size={17} /> })()}
              action={i.action}
              badge={i.badge}
              url={i.url}
              publishing={publishing === i.number}
              onPublish={() => publish(i)}
              onMakeEdits={() => makeEdits(i)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
