import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSystems } from '../utils/systemStore'
import { iconMap, BookIcon, RefreshIcon } from '../components/SystemIcons'
import { useOnline } from '../hooks/useOnline'
import { useProfile } from '../hooks/useProfile'
import { classifyInboxPR, InboxTab } from '../utils/inboxClassify'
import { listActive, removeDraft } from '../utils/draftStore'
import { logCrumb } from '../utils/breadcrumb'
import InboxRow from '../components/InboxRow'
import PublishConfirmModal from '../components/PublishConfirmModal'
import './Inbox.css'

interface Item {
  systemId: string
  systemName: string
  systemColor: string
  systemIcon: string
  repoPath: string
  number?: number          // absent for a local draft not yet submitted for review
  title: string
  authorName: string
  headRefName: string
  createdAt: string
  changedFiles?: number
  url?: string
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
  const [loading, setLoading] = useState(itemsCache.length === 0)   // cold load only (empty cache)
  const [refreshing, setRefreshing] = useState(false)               // any load in flight (incl. warm/manual)
  const [publishTarget, setPublishTarget] = useState<Item | null>(null)  // item whose publish modal is open
  const online = useOnline()
  const profile = useProfile()
  const navigate = useNavigate()

  const load = async () => {
    if (!online) { setLoading(false); return }
    if (!profile.login) return   // wait for identity; keep whatever we're already showing
    // No setLoading(true) here: on repeat visits we already have cached items and refresh in
    // place. `loading` (the skeleton) is cold-load only; `refreshing` drives the subtle in-place
    // hint and the manual refresh button's spinner.
    setRefreshing(true)
    try {
    const all: Item[] = []
    for (const sys of getSystems()) {
      if (!sys.folderPath) continue
      const prBranches = new Set<string>()   // branches that already have a PR, so we don't double-list them
      try {
        const result = await window.api.git.listPRs(sys.folderPath)
        if (result.ok && result.prs) {
          for (const pr of result.prs) {
            prBranches.add(pr.headRefName)
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
      // Local drafts not yet submitted for review (no open PR) — shown in "Your drafts" with a Draft status.
      for (const d of listActive(sys.id)) {
        if (prBranches.has(d.branch)) continue
        all.push({
          systemId: sys.id, systemName: sys.name, systemColor: sys.gradient, systemIcon: sys.icon,
          repoPath: sys.folderPath, title: d.title, authorName: profile.name || profile.login,
          headRefName: d.branch, createdAt: d.lastOpenedAt || d.createdAt,
          tab: 'drafts', action: 'make-edits', badge: 'draft',
        })
      }
    }
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    itemsCache = all
    setItems(all)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { void load() }, [online, profile.login])

  const count = (t: InboxTab) => items.filter(i => i.tab === t).length
  const shown = items.filter(i => i.tab === tab)

  const metaFor = (i: Item) => {
    if (i.number === undefined) return `${i.systemName} · not submitted yet · ${timeAgo(i.createdAt)}`
    const files = `${i.changedFiles} file${i.changedFiles === 1 ? '' : 's'}`
    return i.tab === 'review'
      ? `${i.authorName} · ${i.systemName} · ${files} · ${timeAgo(i.createdAt)}`
      : `${i.systemName} · ${files} · ${timeAgo(i.createdAt)}`
  }

  // Merge the target PR to Live, then clean up the draft in Atlas immediately (remote branch is
  // deleted by mergePR; local branch delete is best-effort). Returns the outcome for the modal.
  const doMerge = async (): Promise<{ ok: boolean; error?: string }> => {
    const i = publishTarget
    if (!i || i.number === undefined) return { ok: false, error: 'No pull request to publish.' }
    logCrumb(`published "${i.title}" (#${i.number}) from Inbox`)
    const r = await window.api.git.mergePR(i.repoPath, i.number)
    if (r.ok) {
      removeDraft(i.systemId, i.headRefName)
      try { await window.api.git.deleteBranch(i.repoPath, i.headRefName) } catch { /* best-effort */ }
    }
    return r
  }
  const seeItLive = async () => {
    const i = publishTarget
    setPublishTarget(null)
    if (!i) return
    await window.api.git.switchBranch(i.repoPath, 'main')
    navigate(`/system/${i.systemId}`)
  }
  const closePublish = () => { setPublishTarget(null); void load() }

  const makeEdits = async (i: Item) => {
    await window.api.git.switchBranch(i.repoPath, i.headRefName)
    navigate(`/system/${i.systemId}`)
  }

  return (
    <div className="inbox-page">
      <div className="inbox-inner">
        <h1 className="inbox-title">Inbox</h1>
        <p className="inbox-subtitle">Reviews waiting on you, and your work in progress.</p>

        <div className="inbox-tabs-row">
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
          {online && (
            <button
              className={`inbox-refresh${refreshing ? ' spinning' : ''}`}
              onClick={() => { void load() }}
              disabled={refreshing}
              title="Check for new items"
              aria-label="Refresh inbox"
            >
              <RefreshIcon size={16} />
            </button>
          )}
        </div>

        <div className="inbox-list">
          {!online && <div className="inbox-empty">You're offline — your inbox will refresh when you reconnect.</div>}
          {online && loading && (
            <div className="inbox-skeleton">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="inbox-skeleton-row">
                  <div className="inbox-skeleton-chip" />
                  <div className="inbox-skeleton-lines">
                    <div className="inbox-skeleton-bar title" />
                    <div className="inbox-skeleton-bar meta" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {online && !loading && shown.length === 0 && <div className="inbox-empty">{EMPTY[tab]}</div>}
          {online && !loading && shown.map(i => (
            <InboxRow
              key={`${i.systemId}-${i.number ?? i.headRefName}`}
              to={i.number !== undefined ? `/review/${i.systemId}/${i.number}` : `/system/${i.systemId}`}
              title={i.title}
              meta={metaFor(i)}
              color={i.systemColor}
              icon={(() => { const Icon = iconMap[i.systemIcon] || BookIcon; return <Icon size={17} /> })()}
              action={i.action}
              badge={i.badge}
              url={i.url ?? ''}
              publishing={false}
              onPublish={() => setPublishTarget(i)}
              onMakeEdits={() => makeEdits(i)}
            />
          ))}
        </div>
      </div>
      <PublishConfirmModal
        isOpen={!!publishTarget}
        itemName={publishTarget?.title ?? 'this version'}
        onConfirm={doMerge}
        onSeeItLive={seeItLive}
        onClose={closePublish}
      />
    </div>
  )
}
