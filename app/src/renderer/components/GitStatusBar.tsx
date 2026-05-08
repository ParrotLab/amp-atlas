import { useState, useEffect } from 'react'
import './GitStatusBar.css'

interface GitStatusBarProps {
  repoPath: string
}

export default function GitStatusBar({ repoPath }: GitStatusBarProps) {
  const [branch, setBranch] = useState<string>('')
  const [modified, setModified] = useState<number>(0)
  const [added, setAdded] = useState<number>(0)
  const [deleted, setDeleted] = useState<number>(0)
  const [ahead, setAhead] = useState<number>(0)
  const [behind, setBehind] = useState<number>(0)
  const [isClean, setIsClean] = useState<boolean>(true)
  const [isRepo, setIsRepo] = useState<boolean>(false)

  useEffect(() => {
    if (!repoPath) return

    const fetchStatus = async () => {
      const result = await window.api.git.status(repoPath)
      if (result.ok && result.status) {
        setIsRepo(true)
        setBranch(result.status.current || 'unknown')
        setModified(result.status.modified.length)
        setAdded(result.status.not_added.length + result.status.staged.length)
        setDeleted(result.status.deleted.length)
        setAhead(result.status.ahead)
        setBehind(result.status.behind)
        setIsClean(result.status.isClean)
      } else {
        setIsRepo(false)
      }
    }

    fetchStatus()
    // Poll every 5 seconds for changes
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [repoPath])

  if (!isRepo) return null

  return (
    <div className="git-status-bar">
      <div className="git-branch">
        <svg className="git-branch-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="6" y1="3" x2="6" y2="15"/>
          <circle cx="18" cy="6" r="3"/>
          <circle cx="6" cy="18" r="3"/>
          <path d="M18 9a9 9 0 01-9 9"/>
        </svg>
        {branch}
      </div>

      {isClean ? (
        <div className="git-clean">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          Clean — no changes
        </div>
      ) : (
        <div className="git-changes">
          {modified > 0 && <span className="git-change-item modified">{modified} modified</span>}
          {added > 0 && <span className="git-change-item added">{added} new</span>}
          {deleted > 0 && <span className="git-change-item deleted">{deleted} deleted</span>}
        </div>
      )}

      {(ahead > 0 || behind > 0) && (
        <div className="git-sync">
          {ahead > 0 && <span className="git-ahead">{ahead} to publish</span>}
          {behind > 0 && <span className="git-behind">{behind} to sync</span>}
        </div>
      )}
    </div>
  )
}
