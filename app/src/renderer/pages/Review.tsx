import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getSystem } from '../utils/systemStore'
import './Review.css'

interface DiffLine {
  type: string
  content: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(diff / 86400000)
  return `${days}d ago`
}

function avatarColor(name: string): string {
  const colors = ['#8B2BFF', '#FF7B00', '#3D0052', '#16A34A', '#2563EB', '#E11D48']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function Review() {
  const { systemId, prNumber } = useParams<{ systemId: string; prNumber: string }>()
  const [pr, setPr] = useState<{ title: string; author: { login: string; name: string }; createdAt: string; reviewDecision: string | null; additions: number; deletions: number } | null>(null)
  const [files, setFiles] = useState<string[]>([])
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  const [fileDiffs, setFileDiffs] = useState<Record<string, DiffLine[]>>({})
  const [viewMode, setViewMode] = useState<Record<string, 'changes' | 'final'>>({})
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle')
  const [action, setAction] = useState<'approve' | 'request-changes' | null>(null)

  const system = systemId ? getSystem(systemId) : undefined
  const repoPath = system?.folderPath || ''
  const prNum = parseInt(prNumber || '0')

  useEffect(() => {
    if (!repoPath || !prNum) return
    window.api.git.listPRs(repoPath).then(result => {
      if (result.ok) {
        const found = result.prs.find(p => p.number === prNum)
        if (found) setPr(found)
      }
    })
    window.api.git.prDiff(repoPath, prNum).then(result => {
      if (result.ok) {
        setFiles(result.files)
        // Auto-expand first file
        if (result.files.length > 0) {
          setExpandedFile(result.files[0])
        }
      }
    })
  }, [repoPath, prNum])

  // Load diff when a file is expanded
  useEffect(() => {
    if (!expandedFile || !repoPath || !prNum || fileDiffs[expandedFile]) return
    window.api.git.prFileDiff(repoPath, prNum, expandedFile).then(result => {
      if (result.ok) {
        setFileDiffs(prev => ({ ...prev, [expandedFile]: result.lines }))
      }
    })
  }, [expandedFile, repoPath, prNum, fileDiffs])

  const toggleFile = (file: string) => {
    setExpandedFile(expandedFile === file ? null : file)
  }

  const getViewMode = (file: string) => viewMode[file] || 'changes'
  const toggleViewMode = (file: string) => {
    setViewMode(prev => ({ ...prev, [file]: prev[file] === 'final' ? 'changes' : 'final' }))
  }

  const handleSubmitReview = async (reviewAction: 'approve' | 'request-changes') => {
    if (!repoPath) return
    setAction(reviewAction)
    setStatus('submitting')
    const result = await window.api.git.reviewPR(repoPath, prNum, reviewAction, comment)
    if (result.ok) {
      setStatus('done')
    } else {
      alert(`Couldn't submit review: ${result.error}`)
      setStatus('idle')
    }
  }

  const fileName = (path: string) => path.split('/').pop() || path
  const filePath = (path: string) => {
    const parts = path.split('/')
    return parts.length > 1 ? parts.slice(0, -1).join('/') + '/' : ''
  }

  return (
    <div className="review-page">
      <div className="review-inner">
        <Link to="/inbox" className="review-back">&#8592; Back to Inbox</Link>

        {status === 'done' ? (
          <div className="review-header">
            <div className="review-success">
              {action === 'approve' ? '✓ Review approved!' : '✓ Changes requested — the author will be notified.'}
            </div>
            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <Link to="/inbox" style={{ color: '#8B2BFF', fontSize: '13px' }}>Back to Inbox</Link>
            </div>
          </div>
        ) : pr ? (
          <>
            <div className="review-header">
              <div className="review-title">{pr.title}</div>
              <div className="review-meta">
                <div className="review-meta-avatar" style={{ background: avatarColor(pr.author.login) }}>
                  {(pr.author.name || pr.author.login).charAt(0).toUpperCase()}
                </div>
                <span>{pr.author.name || pr.author.login}</span>
                <span>·</span>
                <span>{system?.name}</span>
                <span>·</span>
                <span>{timeAgo(pr.createdAt)}</span>
                <span>·</span>
                <span style={{ color: '#16A34A' }}>+{pr.additions}</span>
                <span style={{ color: '#DC2626' }}>-{pr.deletions}</span>
              </div>
              <div className="review-actions">
                <button className="review-action-btn approve" onClick={() => handleSubmitReview('approve')} disabled={status === 'submitting'}>
                  {status === 'submitting' && action === 'approve' ? 'Approving...' : '✓ Approve'}
                </button>
                <button className="review-action-btn request-changes" onClick={() => handleSubmitReview('request-changes')} disabled={status === 'submitting'}>
                  {status === 'submitting' && action === 'request-changes' ? 'Submitting...' : 'Request Changes'}
                </button>
              </div>
            </div>

            <div className="review-files-label">{files.length} file{files.length !== 1 ? 's' : ''} changed</div>
            <div className="review-files">
              {files.map(file => {
                const isExpanded = expandedFile === file
                const diff = fileDiffs[file]
                const mode = getViewMode(file)

                return (
                  <div key={file} className={`review-file-card ${isExpanded ? 'expanded' : ''}`}>
                    <div className="review-file-header" onClick={() => toggleFile(file)}>
                      <span className="review-file-chevron">{isExpanded ? '▾' : '▸'}</span>
                      <div className="review-file-info">
                        <span className="review-file-name">{fileName(file)}</span>
                        <span className="review-file-path">{filePath(file)}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="review-file-content">
                        <div className="review-file-toolbar">
                          <button className={`review-view-toggle ${mode === 'changes' ? 'active' : ''}`} onClick={() => toggleViewMode(file)}>Changes</button>
                          <button className={`review-view-toggle ${mode === 'final' ? 'active' : ''}`} onClick={() => toggleViewMode(file)}>Final</button>
                        </div>

                        {!diff && <div style={{ padding: '20px', color: '#B5B1AC', fontSize: '13px' }}>Loading diff...</div>}

                        {diff && (
                          <div className="review-diff">
                            {diff.filter(line => {
                              if (mode === 'final') return line.type !== 'removed' && line.type !== 'header'
                              return true
                            }).map((line, i) => (
                              <div key={i} className={`review-diff-line ${line.type}`}>
                                {mode === 'changes' && line.type === 'added' && <span className="review-diff-marker">+</span>}
                                {mode === 'changes' && line.type === 'removed' && <span className="review-diff-marker">−</span>}
                                {mode === 'changes' && line.type === 'context' && <span className="review-diff-marker"> </span>}
                                {line.type === 'header' ? (
                                  <span className="review-diff-header-text">{line.content}</span>
                                ) : (
                                  <span className="review-diff-text">{line.content || ' '}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="review-comment">
              <textarea placeholder="Leave a comment (optional)..." value={comment} onChange={e => setComment(e.target.value)} />
            </div>
          </>
        ) : (
          <div className="review-header">
            <div style={{ color: '#B5B1AC', textAlign: 'center', padding: '20px' }}>Loading...</div>
          </div>
        )}
      </div>
    </div>
  )
}
