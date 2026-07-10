import { useState, useEffect } from 'react'
import Button from './Button'
import Badge, { reviewVariant, reviewLabel } from './Badge'
import SplitButton from './SplitButton'
import { RefreshIcon } from './SystemIcons'
import './StatusBar.css'

interface DraftItem {
  branch: string
  title: string
}

interface StatusBarProps {
  editedCount: number
  savedCount: number
  newCount: number
  isDirty: boolean
  branchName?: string
  isMain?: boolean
  activeDrafts: DraftItem[]
  archivedDrafts: DraftItem[]
  lastSaved?: string
  lastRefreshedLabel?: string
  onSave: () => void
  onDiscard: () => void
  onPublish: () => void
  onRefresh?: () => void
  onSwitchBranch?: (branch: string) => void
  onNewDraft?: () => void
  onArchiveBranch?: (branch: string) => void
  onUnarchive?: (branch: string) => void
  onAddExistingWork?: (branch: string) => void
  repoPath?: string
  prStatus?: { hasPR: boolean; state?: string; reviewDecision?: string | null }
  canUseGit?: boolean
  canUseGitHub?: boolean
  onNeedGit?: () => void
  onNeedGitHub?: () => void
}

function humanize(branch: string): string {
  return branch
    .replace(/^(draft|feature|fix|hotfix)\//i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export default function StatusBar({
  editedCount, newCount, isDirty,
  branchName, isMain,
  activeDrafts, archivedDrafts, lastSaved, lastRefreshedLabel,
  onSave, onDiscard, onPublish, onRefresh, onSwitchBranch, onNewDraft, onArchiveBranch, onUnarchive,
  onAddExistingWork, repoPath, prStatus,
  canUseGit = true, canUseGitHub = true, onNeedGit, onNeedGitHub,
}: StatusBarProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [showAdopt, setShowAdopt] = useState(false)
  const [adoptable, setAdoptable] = useState<{ name: string; isRemoteOnly: boolean }[]>([])
  const displayBranch = isMain ? 'Live Version' : branchName ? `Draft: ${humanize(branchName)}` : ''
  const unsaved = editedCount + newCount
  const prOpen = prStatus?.hasPR && prStatus.state === 'OPEN'
  const publishLabel = prOpen ? 'Update Review' : 'Publish'

  useEffect(() => {
    if (!showAdopt || !repoPath) return
    window.api.git.listAdoptableBranches(repoPath).then(r => {
      if (r.ok) {
        const known = new Set([...activeDrafts, ...archivedDrafts].map(d => d.branch))
        setAdoptable(r.branches.filter(b => !known.has(b.name)))
      }
    })
  }, [showAdopt, repoPath, activeDrafts, archivedDrafts])

  const prBadge = prOpen && (
    <Badge variant={reviewVariant(prStatus?.reviewDecision)}>{reviewLabel(prStatus?.reviewDecision)}</Badge>
  )

  const doPublish = () => { canUseGitHub ? onPublish() : onNeedGitHub?.() }
  const doDiscard = () => {
    if (!canUseGit) { onNeedGit?.(); return }
    if (window.confirm('Discard all unsaved changes? This can’t be undone.')) onDiscard()
  }

  return (
    <div className="status-bar">
      <div className="status-left">
        {displayBranch && (
          <>
            <div className="status-branch-wrapper">
              <button className="status-branch-btn" onClick={() => setShowDropdown(!showDropdown)}>
                <span className={`status-dot ${isMain ? 'green' : 'violet'}`} />
                <span className="branch-label">{displayBranch}</span>
                {prBadge}
                <span className="status-branch-chevron">▾</span>
              </button>

              {showDropdown && (
                <>
                  <div className="status-dropdown-overlay" onClick={() => setShowDropdown(false)} />
                  <div className="status-dropdown">
                    <div className="status-dropdown-label">Switch version</div>
                    <button
                      className={`status-dropdown-item ${isMain ? 'active' : ''}`}
                      onClick={() => { onSwitchBranch?.('main'); setShowDropdown(false) }}
                    >
                      <span className="status-dot green" />
                      Live Version
                      {isMain && <span className="status-dropdown-check">✓</span>}
                    </button>

                    {activeDrafts.length > 0 && (
                      <>
                        <div className="status-dropdown-divider" />
                        <div className="status-dropdown-label">Your Drafts</div>
                        {activeDrafts.map(d => (
                          <div key={d.branch} className={`status-dropdown-item ${d.branch === branchName ? 'active' : ''}`}>
                            <span className="status-dot violet" />
                            <span className="status-dropdown-item-name" onClick={() => { onSwitchBranch?.(d.branch); setShowDropdown(false) }}>
                              Draft: {d.title}
                            </span>
                            {d.branch === branchName && prBadge}
                            {d.branch === branchName && <span className="status-dropdown-check">✓</span>}
                            {d.branch !== branchName && (
                              <button className="status-archive-btn" title="Archive this draft" onClick={(e) => { e.stopPropagation(); onArchiveBranch?.(d.branch); setShowDropdown(false) }}>✕</button>
                            )}
                          </div>
                        ))}
                      </>
                    )}

                    {archivedDrafts.length > 0 && (
                      <>
                        <div className="status-dropdown-divider" />
                        <div className="status-dropdown-label">Archived</div>
                        {archivedDrafts.map(d => (
                          <div key={d.branch} className="status-dropdown-item" style={{ color: '#8E8B87' }}>
                            <span className="status-dot" style={{ background: '#B5B1AC' }} />
                            <span className="status-dropdown-item-name">Draft: {d.title}</span>
                            <button className="status-archive-btn" title="Restore this draft" onClick={(e) => { e.stopPropagation(); onUnarchive?.(d.branch); setShowDropdown(false) }}>↩</button>
                          </div>
                        ))}
                      </>
                    )}

                    <div className="status-dropdown-divider" />
                    <button className="status-dropdown-item new-draft" onClick={() => { onNewDraft?.(); setShowDropdown(false) }}>
                      <span style={{ fontSize: '14px', color: '#8B2BFF' }}>+</span>
                      New Draft
                    </button>
                    <button className="status-dropdown-item" style={{ color: '#6B6966' }} onClick={() => { setShowAdopt(true); setShowDropdown(false) }}>
                      Add existing work…
                    </button>
                  </div>
                </>
              )}
            </div>
            <span className="status-sep">&middot;</span>
          </>
        )}

        {!isMain && (
          <span className="status-item" style={{ color: '#8E8B87' }}>
            {unsaved > 0 ? `${unsaved} unsaved edit${unsaved !== 1 ? 's' : ''}` : 'all changes saved'}
            {lastSaved && ` · saved ${lastSaved}`}
          </span>
        )}
        {isMain && <span className="status-readonly-tag">Read only</span>}
      </div>

      {showAdopt && (
        <div className="status-dropdown-overlay" onClick={() => setShowAdopt(false)}>
          <div className="status-dropdown" style={{ left: 20, bottom: 56 }} onClick={e => e.stopPropagation()}>
            <div className="status-dropdown-label">Add existing work</div>
            {adoptable.length === 0 && <div className="status-dropdown-item" style={{ color: '#B5B1AC' }}>Nothing to add</div>}
            {adoptable.map(b => (
              <button key={b.name} className="status-dropdown-item" onClick={() => { onAddExistingWork?.(b.name); setShowAdopt(false) }}>
                <span className="status-dot violet" />
                {humanize(b.name)}{b.isRemoteOnly ? ' (on GitHub)' : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="status-right">
        {isMain ? (
          <div className="status-freshness">
            {lastRefreshedLabel && <span className="status-updated">{lastRefreshedLabel}</span>}
            <Button variant="outline" size="sm" icon={<RefreshIcon />} onClick={() => onRefresh?.()} title="Pull the latest Live Version from GitHub">
              Refresh
            </Button>
          </div>
        ) : (
          <SplitButton
            label="Save"
            title="Save (⌘S)"
            disabled={canUseGit && !isDirty}
            onClick={() => canUseGit ? onSave() : onNeedGit?.()}
            items={[
              { label: publishLabel, kbd: '⌘↵', onClick: doPublish },
              { label: 'Discard changes', danger: true, onClick: doDiscard },
            ]}
          />
        )}
      </div>
    </div>
  )
}
