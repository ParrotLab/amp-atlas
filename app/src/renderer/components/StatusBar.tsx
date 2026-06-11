import { useState } from 'react'
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
}

function humanize(branch: string): string {
  return branch
    .replace(/^(draft|feature|fix|hotfix)\//i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export default function StatusBar({
  editedCount, savedCount, newCount, isDirty,
  branchName, isMain, branches,
  onSave, onDiscard, onPublish, onSwitchBranch, onNewDraft
}: StatusBarProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const hasChanges = editedCount > 0 || savedCount > 0 || newCount > 0
  const displayBranch = isMain ? 'Current Version' : branchName ? `Draft: ${humanize(branchName)}` : ''

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

              {showDropdown && (
                <>
                  <div className="status-dropdown-overlay" onClick={() => setShowDropdown(false)} />
                  <div className="status-dropdown">
                    <div className="status-dropdown-label">Switch version</div>

                    {branches?.map(b => {
                      const isMainBranch = b.name === 'main' || b.name === 'master'
                      const label = isMainBranch ? 'Current Version' : `Draft: ${humanize(b.name)}`
                      return (
                        <button
                          key={b.name}
                          className={`status-dropdown-item ${b.current ? 'active' : ''}`}
                          onClick={() => {
                            onSwitchBranch?.(b.name)
                            setShowDropdown(false)
                          }}
                        >
                          <span className={`status-dot ${isMainBranch ? 'green' : 'violet'}`} />
                          {label}
                          {b.current && <span className="status-dropdown-check">✓</span>}
                        </button>
                      )
                    })}

                    <div className="status-dropdown-divider" />
                    <button
                      className="status-dropdown-item new-draft"
                      onClick={() => {
                        onNewDraft?.()
                        setShowDropdown(false)
                      }}
                    >
                      <span style={{ fontSize: '14px', color: '#8B2BFF' }}>+</span>
                      New Draft
                    </button>
                  </div>
                </>
              )}
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
