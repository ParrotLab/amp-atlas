import { useState, useEffect } from 'react'
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
  onSave: () => void
  onDiscard: () => void
  onPublish: () => void
  onSwitchBranch?: (branch: string) => void
  onNewDraft?: () => void
  onArchiveBranch?: (branch: string) => void
  onUnarchive?: (branch: string) => void
  onAddExistingWork?: (branch: string) => void
  onMoveChangesToDraft?: (name: string) => void
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
  activeDrafts, archivedDrafts, lastSaved,
  onSave, onDiscard, onPublish, onSwitchBranch, onNewDraft, onArchiveBranch, onUnarchive,
  onAddExistingWork, onMoveChangesToDraft, repoPath, prStatus,
  canUseGit = true, canUseGitHub = true, onNeedGit, onNeedGitHub,
}: StatusBarProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [showAdopt, setShowAdopt] = useState(false)
  const [adoptable, setAdoptable] = useState<{ name: string; isRemoteOnly: boolean }[]>([])
  const displayBranch = isMain ? 'Live Version' : branchName ? `Draft: ${humanize(branchName)}` : ''
  const unsaved = editedCount + newCount

  useEffect(() => {
    if (!showAdopt || !repoPath) return
    window.api.git.listAdoptableBranches(repoPath).then(r => {
      if (r.ok) {
        const known = new Set([...activeDrafts, ...archivedDrafts].map(d => d.branch))
        setAdoptable(r.branches.filter(b => !known.has(b.name)))
      }
    })
  }, [showAdopt, repoPath, activeDrafts, archivedDrafts])

  const prBadge = prStatus?.hasPR && prStatus.state === 'OPEN' && (
    <span className={`status-pr-badge-inline ${prStatus.reviewDecision === 'APPROVED' ? 'approved' : prStatus.reviewDecision === 'CHANGES_REQUESTED' ? 'changes' : 'review'}`}>
      {prStatus.reviewDecision === 'APPROVED' ? 'Approved' : prStatus.reviewDecision === 'CHANGES_REQUESTED' ? 'Changes Requested' : 'In Review'}
    </span>
  )

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
        {isMain && isDirty && (
          <button
            className="status-btn outline"
            onClick={() => { const n = window.prompt('Name this draft:'); if (n && n.trim()) onMoveChangesToDraft?.(n.trim()) }}
          >
            Move changes into a draft
          </button>
        )}
        {isMain && !isDirty && <span className="status-item" style={{ color: '#16A34A' }}>read only</span>}
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
        <button
          className={`status-btn secondary ${!canUseGit ? 'disabled' : ''}`}
          disabled={canUseGit && !isDirty}
          onClick={() => canUseGit ? onDiscard() : onNeedGit?.()}
        >
          Discard
        </button>
        <button
          className={`status-btn primary ${!canUseGit ? 'disabled' : ''}`}
          disabled={canUseGit && !isDirty}
          onClick={() => canUseGit ? onSave() : onNeedGit?.()}
        >
          Save
        </button>
        {prStatus?.hasPR && prStatus.state === 'OPEN' ? (
          <button
            className={`status-btn outline ${!canUseGitHub ? 'disabled' : ''}`}
            disabled={canUseGitHub && !isDirty}
            onClick={() => canUseGitHub ? onPublish() : onNeedGitHub?.()}
          >
            Update Review
          </button>
        ) : (
          <button
            className={`status-btn outline ${!canUseGitHub ? 'disabled' : ''}`}
            onClick={() => canUseGitHub ? onPublish() : onNeedGitHub?.()}
          >
            Publish
          </button>
        )}
      </div>
    </div>
  )
}
