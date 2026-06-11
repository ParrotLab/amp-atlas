import { useState, useEffect, useRef } from 'react'
import './StatusBar.css'

interface BranchInfo {
  name: string
  current: boolean
}

interface StatusBarProps {
  editedCount: number
  savedCount: number
  newCount: number
  isDirty: boolean
  branchName?: string
  isMain?: boolean
  branches?: BranchInfo[]
  onSave: () => void
  onDiscard: () => void
  onPublish: () => void
  onSwitchBranch?: (branch: string) => void
  onNewDraft?: () => void
  onArchiveBranch?: (branch: string) => void
}

function humanize(branch: string): string {
  return branch
    .replace(/^(draft|feature|fix|hotfix)\//i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

const RECENT_BRANCHES_KEY = 'amp-up-recent-branches'

function getRecentBranches(): Set<string> {
  try {
    const stored = localStorage.getItem(RECENT_BRANCHES_KEY)
    if (stored) return new Set(JSON.parse(stored))
  } catch { /* ignore */ }
  return new Set()
}

function addRecentBranch(branch: string): void {
  const recent = getRecentBranches()
  if (branch !== 'main' && branch !== 'master') {
    recent.add(branch)
    localStorage.setItem(RECENT_BRANCHES_KEY, JSON.stringify([...recent]))
  }
}

export default function StatusBar({
  editedCount, savedCount, newCount, isDirty,
  branchName, isMain, branches,
  onSave, onDiscard, onPublish, onSwitchBranch, onNewDraft, onArchiveBranch
}: StatusBarProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [showAllBranches, setShowAllBranches] = useState(false)
  const hasChanges = editedCount > 0 || savedCount > 0 || newCount > 0
  const displayBranch = isMain ? 'Live Version' : branchName ? `Draft: ${humanize(branchName)}` : ''
  const recentBranches = useRef(getRecentBranches())

  // Track current branch as recently used
  useEffect(() => {
    if (branchName && branchName !== 'main' && branchName !== 'master') {
      addRecentBranch(branchName)
      recentBranches.current = getRecentBranches()
    }
  }, [branchName])

  return (
    <div className="status-bar">
      <div className="status-left">
        {displayBranch && (
          <>
            <div className="status-branch-wrapper">
              <button
                className="status-branch-btn"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <span className={`status-dot ${isMain ? 'green' : 'violet'}`} />
                <span className="branch-label">{displayBranch}</span>
                <span className="status-branch-chevron">▾</span>
              </button>

              {showDropdown && (() => {
                const recent = recentBranches.current
                const mainBranches = branches?.filter(b => b.name === 'main' || b.name === 'master') || []
                // "Your Drafts" = draft/ prefix OR recently used OR currently active
                const draftBranches = branches?.filter(b =>
                  b.name !== 'main' && b.name !== 'master' &&
                  (b.name.startsWith('draft/') || b.current || recent.has(b.name))
                ) || []
                const draftNames = new Set(draftBranches.map(b => b.name))
                const otherBranches = branches?.filter(b =>
                  b.name !== 'main' && b.name !== 'master' && !draftNames.has(b.name)
                ) || []

                return (
                  <>
                    <div className="status-dropdown-overlay" onClick={() => setShowDropdown(false)} />
                    <div className="status-dropdown">
                      <div className="status-dropdown-label">Switch version</div>

                      {mainBranches.map(b => (
                        <button
                          key={b.name}
                          className={`status-dropdown-item ${b.current ? 'active' : ''}`}
                          onClick={() => { onSwitchBranch?.(b.name); setShowDropdown(false) }}
                        >
                          <span className="status-dot green" />
                          Live Version
                          {b.current && <span className="status-dropdown-check">✓</span>}
                        </button>
                      ))}

                      {draftBranches.length > 0 && (
                        <>
                          <div className="status-dropdown-divider" />
                          <div className="status-dropdown-label">Your Drafts</div>
                          {draftBranches.map(b => (
                            <div key={b.name} className={`status-dropdown-item ${b.current ? 'active' : ''}`}>
                              <span className="status-dot violet" />
                              <span className="status-dropdown-item-name" onClick={() => { onSwitchBranch?.(b.name); setShowDropdown(false) }}>
                                Draft: {humanize(b.name)}
                              </span>
                              {b.current && <span className="status-dropdown-check">✓</span>}
                              {!b.current && (
                                <button className="status-archive-btn" title="Archive this draft" onClick={(e) => { e.stopPropagation(); onArchiveBranch?.(b.name); setShowDropdown(false) }}>
                                  ✕
                                </button>
                              )}
                            </div>
                          ))}
                        </>
                      )}

                      {otherBranches.length > 0 && (
                        <>
                          <div className="status-dropdown-divider" />
                          <div className="status-dropdown-label">{otherBranches.length} other branch{otherBranches.length !== 1 ? 'es' : ''}</div>
                          {showAllBranches && otherBranches.map(b => (
                            <div key={b.name} className="status-dropdown-item" style={{ color: '#8E8B87' }}>
                              <span className="status-dot" style={{ background: '#B5B1AC' }} />
                              <span className="status-dropdown-item-name" onClick={() => { onSwitchBranch?.(b.name); setShowDropdown(false) }}>
                                {humanize(b.name)}
                              </span>
                              <button className="status-archive-btn" title="Archive this branch" onClick={(e) => { e.stopPropagation(); onArchiveBranch?.(b.name); setShowDropdown(false) }}>
                                ✕
                              </button>
                            </div>
                          ))}
                          {!showAllBranches && (
                            <button className="status-dropdown-item" onClick={() => setShowAllBranches(true)} style={{ color: '#8E8B87', fontSize: '12px' }}>
                              Show all...
                            </button>
                          )}
                        </>
                      )}

                      <div className="status-dropdown-divider" />
                      <button
                        className="status-dropdown-item new-draft"
                        onClick={() => { onNewDraft?.(); setShowDropdown(false) }}
                      >
                        <span style={{ fontSize: '14px', color: '#8B2BFF' }}>+</span>
                        New Draft
                      </button>
                    </div>
                  </>
                )
              })()}
            </div>
            <span className="status-sep">&middot;</span>
          </>
        )}
        {hasChanges ? (
          <>
            {editedCount > 0 && (
              <span className="status-item">
                <span className="status-dot orange" />
                {editedCount} unsaved edit{editedCount !== 1 ? 's' : ''}
              </span>
            )}
            {editedCount > 0 && (savedCount > 0 || newCount > 0) && <span className="status-sep">&middot;</span>}
            {savedCount > 0 && (
              <span className="status-item">
                <span className="status-dot violet" />
                {savedCount} saved, not published
              </span>
            )}
            {savedCount > 0 && newCount > 0 && <span className="status-sep">&middot;</span>}
            {newCount > 0 && (
              <span className="status-item">
                <span className="status-dot green" />
                {newCount} new file{newCount !== 1 ? 's' : ''}
              </span>
            )}
          </>
        ) : (
          <span style={{ color: '#16A34A' }}>All changes published</span>
        )}
      </div>
      <div className="status-right">
        <button className="status-btn secondary" disabled={!isDirty} onClick={onDiscard}>
          Discard
        </button>
        <button className="status-btn primary" disabled={!isDirty} onClick={onSave}>
          Save
        </button>
        <button className="status-btn outline" onClick={onPublish}>
          Publish
        </button>
      </div>
    </div>
  )
}
