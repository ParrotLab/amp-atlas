import './StatusBar.css'

interface StatusBarProps {
  editedCount: number
  savedCount: number
  newCount: number
  isDirty: boolean
  branchName?: string
  isMain?: boolean
  onSave: () => void
  onDiscard: () => void
  onPublish: () => void
}

function humanize(branch: string): string {
  return branch
    .replace(/^(draft|feature|fix|hotfix)\//i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

export default function StatusBar({ editedCount, savedCount, newCount, isDirty, branchName, isMain, onSave, onDiscard, onPublish }: StatusBarProps) {
  const hasChanges = editedCount > 0 || savedCount > 0 || newCount > 0
  const displayBranch = isMain ? 'Current Version' : branchName ? `Draft: ${humanize(branchName)}` : ''

  return (
    <div className="status-bar">
      <div className="status-left">
        {displayBranch && (
          <>
            <span className="status-branch">
              <span className={`status-dot ${isMain ? 'green' : 'violet'}`} />
              {displayBranch}
            </span>
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
