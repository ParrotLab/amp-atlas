import { useState, useEffect } from 'react'
import './GitStatusBar.css'

interface GitStatusBarProps {
  repoPath: string
}

/**
 * Humanize a git branch name for display.
 * - "main" / "master" → "Live Version"
 * - anything else → "Draft: Foo Bar" (strip prefixes, replace separators, title-case)
 */
function humanizeBranch(raw: string): { label: string; isMain: boolean } {
  const lower = raw.trim().toLowerCase()
  if (lower === 'main' || lower === 'master') {
    return { label: 'Live Version', isMain: true }
  }

  // Strip common prefixes like "draft/", "feature/", "fix/", "bugfix/", "hotfix/"
  let name = raw.replace(/^(draft|feature|fix|bugfix|hotfix)\//i, '')

  // Replace hyphens and underscores with spaces, then title-case each word
  name = name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())

  return { label: `Draft: ${name}`, isMain: false }
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

  const { label: branchLabel, isMain } = humanizeBranch(branch)

  return (
    <div className="git-status-bar">
      <div className="git-branch">
        <span className={`git-branch-dot ${isMain ? 'dot-main' : 'dot-draft'}`} />
        {branchLabel}
      </div>

      {isClean ? (
        <div className="git-clean">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          {isMain ? 'All changes published' : 'No unsaved edits'}
        </div>
      ) : (
        <div className="git-changes">
          {modified > 0 && <span className="git-change-item modified">{modified} edited</span>}
          {added > 0 && <span className="git-change-item added">{added} new files</span>}
          {deleted > 0 && <span className="git-change-item deleted">{deleted} deleted</span>}
        </div>
      )}

      {(ahead > 0 || behind > 0) && (
        <div className="git-sync">
          {ahead > 0 && <span className="git-ahead">{ahead} saves not published</span>}
          {behind > 0 && <span className="git-behind">{behind} updates available</span>}
        </div>
      )}
    </div>
  )
}
