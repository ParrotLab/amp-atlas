import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getSystem } from '../utils/systemStore'
import './Review.css'

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
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle')
  const [action, setAction] = useState<'approve' | 'request-changes' | null>(null)

  const system = systemId ? getSystem(systemId) : undefined
  const repoPath = system?.folderPath || ''
  const prNum = parseInt(prNumber || '0')

  useEffect(() => {
    if (!repoPath || !prNum) return

    // Load PR details
    window.api.git.listPRs(repoPath).then(result => {
      if (result.ok) {
        const found = result.prs.find(p => p.number === prNum)
        if (found) setPr(found)
      }
    })

    // Load changed files
    window.api.git.prDiff(repoPath, prNum).then(result => {
      if (result.ok) setFiles(result.files)
    })
  }, [repoPath, prNum])

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

  return (
    <div className="review-page">
      <div className="review-inner">
        <Link to="/inbox" className="review-back">← Back to Inbox</Link>

        {status === 'done' ? (
          <div className="review-header">
            <div className="review-success">
              {action === 'approve' ? '✓ Review approved!' : '✓ Changes requested — the author will be notified.'}
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
                <button
                  className="review-action-btn approve"
                  onClick={() => handleSubmitReview('approve')}
                  disabled={status === 'submitting'}
                >
                  {status === 'submitting' && action === 'approve' ? 'Approving...' : '✓ Approve'}
                </button>
                <button
                  className="review-action-btn request-changes"
                  onClick={() => handleSubmitReview('request-changes')}
                  disabled={status === 'submitting'}
                >
                  {status === 'submitting' && action === 'request-changes' ? 'Submitting...' : 'Request Changes'}
                </button>
              </div>
            </div>

            <div className="review-files-label">{files.length} file{files.length !== 1 ? 's' : ''} changed</div>
            <div className="review-files">
              {files.map(file => (
                <div key={file} className="review-file">
                  <span className="review-file-icon">📄</span>
                  <span className="review-file-name">{file}</span>
                </div>
              ))}
            </div>

            <div className="review-comment">
              <textarea
                placeholder="Leave a comment (optional)..."
                value={comment}
                onChange={e => setComment(e.target.value)}
              />
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
