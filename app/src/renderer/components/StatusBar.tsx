import './StatusBar.css'

interface StatusBarProps {
  editedCount: number
  savedCount: number
  newCount: number
  isDirty: boolean
  onSave: () => void
  onDiscard: () => void
  onPublish: () => void
}

export default function StatusBar({ editedCount, savedCount, newCount, isDirty, onSave, onDiscard, onPublish }: StatusBarProps) {
  const hasChanges = editedCount > 0 || savedCount > 0 || newCount > 0

  return (
    <div className="status-bar">
      <div className="status-left">
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
