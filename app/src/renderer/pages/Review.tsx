import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import { getSystem } from '../utils/systemStore'
import { editorExtensions } from '../utils/markdownSerializer'
import { parseDocument } from '../utils/fileDocument'
import { useOnline } from '../hooks/useOnline'
import { useProfile } from '../hooks/useProfile'
import { iconMap, BookIcon } from '../components/SystemIcons'
import { primaryColor, softTint } from '../utils/appearance'
import Badge, { BadgeVariant } from '../components/Badge'
import { logCrumb } from '../utils/breadcrumb'
import './Review.css'

interface DiffLine { type: string; content: string }
interface PRInfo {
  title: string
  author: { login: string; name: string }
  createdAt: string
  reviewDecision: string | null
  requestedReviewers: string[]
  url: string
  body: string
  headRefName: string
}
interface Feedback { state: string; body: string; authorName: string }

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(diff / 86400000)
  return `${days}d ago`
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 140ms ease' }}>
      <path d="M7 5l6 5-6 5" />
    </svg>
  )
}

export default function Review() {
  const { systemId, prNumber } = useParams<{ systemId: string; prNumber: string }>()
  const navigate = useNavigate()
  const profile = useProfile()
  const [pr, setPr] = useState<PRInfo | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [files, setFiles] = useState<string[]>([])
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  const [fileDiffs, setFileDiffs] = useState<Record<string, DiffLine[]>>({})
  const [fileContents, setFileContents] = useState<Record<string, string>>({})
  const [viewMode, setViewMode] = useState<Record<string, 'changes' | 'final'>>({})
  const [reviewedFiles, setReviewedFiles] = useState<Set<string>>(new Set())
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle')
  const [action, setAction] = useState<'approve' | 'request-changes' | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [descOpen, setDescOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const online = useOnline()

  const system = systemId ? getSystem(systemId) : undefined
  const repoPath = system?.folderPath || ''
  const prNum = parseInt(prNumber || '0')
  const isAuthor = !!pr && !!profile.login && pr.author.login === profile.login

  const editor = useEditor({ extensions: editorExtensions(), editable: false, content: '' })
  // Separate read-only editor for the PR description (markdown), independent of the file view.
  const descEditor = useEditor({ extensions: editorExtensions(), editable: false, content: '' })

  useEffect(() => {
    if (descEditor && pr?.body) descEditor.commands.setContent(pr.body, { contentType: 'markdown' })
  }, [descEditor, pr?.body])

  useEffect(() => {
    if (!repoPath || !prNum) return
    window.api.git.listPRs(repoPath).then(result => {
      if (result.ok) {
        const found = result.prs.find(p => p.number === prNum)
        if (found) setPr({ title: found.title, author: found.author, createdAt: found.createdAt, reviewDecision: found.reviewDecision, requestedReviewers: found.requestedReviewers, url: found.url, body: found.body, headRefName: found.headRefName })
      }
    })
    window.api.git.prDiff(repoPath, prNum).then(result => {
      if (result.ok && result.files.length > 0) setFiles(result.files)   // no auto-open; the user opens files themselves
    })
    window.api.git.latestReview(repoPath, prNum).then(result => {
      if (result.ok && result.review) setFeedback(result.review)
    })
  }, [repoPath, prNum])

  const getViewMode = (file: string) => viewMode[file] || 'final'

  // Load diff + content when a file is expanded (cached).
  useEffect(() => {
    if (!expandedFile || !repoPath || !prNum) return
    if (!fileDiffs[expandedFile]) {
      window.api.git.prFileDiff(repoPath, prNum, expandedFile).then(result => {
        if (result.ok) setFileDiffs(prev => ({ ...prev, [expandedFile]: result.lines }))
      })
    }
    if (!fileContents[expandedFile]) {
      window.api.git.prFileContent(repoPath, prNum, expandedFile).then(result => {
        if (result.ok) {
          setFileContents(prev => ({ ...prev, [expandedFile]: result.content }))
          if (getViewMode(expandedFile) === 'final' && editor) {
            const isMarkdown = expandedFile.endsWith('.md') || expandedFile.endsWith('.mdx')
            if (isMarkdown) editor.commands.setContent(parseDocument(result.content).body, { contentType: 'markdown' })
            else editor.commands.setContent(`<pre><code>${result.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`)
          }
        }
      })
    }
  }, [expandedFile, repoPath, prNum])

  // Update TipTap when switching to the Updated-version view.
  useEffect(() => {
    if (!expandedFile || !editor) return
    const mode = getViewMode(expandedFile)
    const content = fileContents[expandedFile]
    if (mode === 'final' && content) {
      const isMarkdown = expandedFile.endsWith('.md') || expandedFile.endsWith('.mdx')
      if (isMarkdown) editor.commands.setContent(parseDocument(content).body, { contentType: 'markdown' })
      else editor.commands.setContent(`<pre><code>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`)
    }
  }, [viewMode, expandedFile, fileContents, editor])

  const toggleFile = (file: string) => setExpandedFile(expandedFile === file ? null : file)
  const toggleViewMode = (file: string) => setViewMode(prev => ({ ...prev, [file]: prev[file] === 'changes' ? 'final' : 'changes' }))

  const toggleReviewed = (file: string) => {
    setReviewedFiles(prev => {
      const next = new Set(prev)
      if (next.has(file)) next.delete(file)
      else next.add(file)
      return next
    })
  }

  const allReviewed = files.length > 0 && files.every(f => reviewedFiles.has(f))
  const hasComment = comment.trim().length > 0

  const handleSubmitReview = async (reviewAction: 'approve' | 'request-changes') => {
    if (!repoPath) return
    if (!online) { alert("You're offline — keep editing; publishing and review need a connection."); return }
    setAction(reviewAction)
    setStatus('submitting')
    logCrumb(`${reviewAction === 'approve' ? 'approved' : 'requested changes on'} review #${prNum}${pr ? ` ("${pr.title}")` : ''}`)
    const result = await window.api.git.reviewPR(repoPath, prNum, reviewAction, comment)
    if (result.ok) setStatus('done')
    else { alert(`Couldn't submit review: ${result.error}`); setStatus('idle') }
  }

  const makeEdits = async () => {
    if (!pr) return
    logCrumb(`opened draft to make edits (review #${prNum})`)
    await window.api.git.switchBranch(repoPath, pr.headRefName)
    navigate(`/system/${systemId}`)
  }

  const publish = async () => {
    setPublishing(true)
    logCrumb(`published review #${prNum}${pr ? ` ("${pr.title}")` : ''}`)
    const r = await window.api.git.mergePR(repoPath, prNum)
    setPublishing(false)
    if (r.ok) navigate('/inbox')
    else alert(`Couldn't publish: ${r.error}`)
  }

  const fileNameOf = (path: string) => path.split('/').pop() || path
  const filePathOf = (path: string) => { const p = path.split('/'); return p.length > 1 ? p.slice(0, -1).join('/') + '/' : '' }

  // A pending re-review request means the author re-submitted after changes — it's back in
  // review, which takes precedence over the (now stale) prior decision. Mirrors inboxClassify.
  const pendingReReview = (pr?.requestedReviewers?.length ?? 0) > 0

  const badge: { variant: BadgeVariant; label: string } =
    !isAuthor ? { variant: 'brand', label: 'Needs your review' }
    : pendingReReview ? { variant: 'neutral', label: 'In review' }
    : pr?.reviewDecision === 'APPROVED' ? { variant: 'success', label: 'Approved' }
    : pr?.reviewDecision === 'CHANGES_REQUESTED' ? { variant: 'warning', label: 'Changes requested' }
    : { variant: 'neutral', label: 'In review' }

  const Icon = system ? (iconMap[system.icon] || BookIcon) : BookIcon
  const chipTint = system ? softTint(primaryColor(system.gradient)) : undefined

  return (
    <div className="review-page">
      <div className="review-inner">
        <Link to="/inbox" className="review-back">← Inbox</Link>

        {status === 'done' ? (
          <div className="review-header">
            <div className="review-success">
              {action === 'approve' ? '✓ Approved — the author can publish when ready.' : '✓ Changes requested — the author will be notified.'}
            </div>
            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <Link to="/inbox" style={{ color: 'var(--amp-violet-700)', fontSize: '13px' }}>Back to Inbox</Link>
            </div>
          </div>
        ) : pr ? (
          <>
            <div className="review-header">
              <div className="review-header-chip" style={{ background: chipTint }}><Icon size={20} /></div>
              <div className="review-header-main">
                <div className="review-title">{pr.title}</div>
                <div className="review-meta">
                  {pr.author.name || pr.author.login} · {system?.name} · {files.length} file{files.length !== 1 ? 's' : ''} · {timeAgo(pr.createdAt)}
                </div>
              </div>
              <Badge variant={badge.variant}>{badge.label}</Badge>
              <div className="review-menu-wrap">
                <button className="review-kebab" onClick={() => setMenuOpen(o => !o)} aria-label="More actions">⋯</button>
                {menuOpen && (
                  <>
                    <div className="review-menu-scrim" onClick={() => setMenuOpen(false)} />
                    <div className="review-menu">
                      <button className="review-menu-item" onClick={() => { setMenuOpen(false); window.open(pr.url) }}>View on GitHub</button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {isAuthor && !pendingReReview && feedback && feedback.state === 'CHANGES_REQUESTED' && feedback.body && (
              <div className="review-feedback">
                <div className="review-feedback-avatar">{feedback.authorName.charAt(0).toUpperCase()}</div>
                <div>
                  <div className="review-feedback-name">{feedback.authorName} asked for changes</div>
                  <div className="review-feedback-text">{feedback.body}</div>
                </div>
              </div>
            )}

            {pr.body && (
              <div className="review-desc">
                <button className="review-desc-head" onClick={() => setDescOpen(o => !o)}>
                  <span className="review-desc-chev"><Chevron open={descOpen} /></span>
                  <span className="review-desc-label">Description</span>
                </button>
                {descOpen && <EditorContent editor={descEditor} className="review-tiptap-body review-desc-body" />}
              </div>
            )}

            <div className="review-files-label">{files.length} file{files.length !== 1 ? 's' : ''} changed</div>
            <div className="review-files">
              {files.map(file => {
                const isExpanded = expandedFile === file
                const diff = fileDiffs[file]
                const mode = getViewMode(file)
                return (
                  <div key={file} className={`review-file-card ${isExpanded ? 'expanded' : ''}`}>
                    <div className="review-file-header" onClick={() => toggleFile(file)}>
                      <span className="review-file-chevron"><Chevron open={isExpanded} /></span>
                      <div className="review-file-info">
                        <span className="review-file-name-label">{fileNameOf(file)}</span>
                        <span className="review-file-path">{filePathOf(file)}</span>
                      </div>
                      {isAuthor ? (
                        <span className="review-file-readonly">Read-only</span>
                      ) : (
                        <button className={`review-file-reviewed ${reviewedFiles.has(file) ? 'reviewed' : ''}`} onClick={e => { e.stopPropagation(); toggleReviewed(file) }}>
                          {reviewedFiles.has(file) ? '✓ Reviewed' : 'Mark reviewed'}
                        </button>
                      )}
                    </div>
                    {isExpanded && (
                      <div className="review-file-content">
                        <div className="review-file-toolbar">
                          <button className={`review-view-toggle ${mode === 'final' ? 'active' : ''}`} onClick={() => { if (mode !== 'final') toggleViewMode(file) }}>Updated version</button>
                          <button className={`review-view-toggle ${mode === 'changes' ? 'active' : ''}`} onClick={() => { if (mode !== 'changes') toggleViewMode(file) }}>What changed</button>
                        </div>
                        {mode === 'final' ? (
                          <div className="review-tiptap-container">
                            {fileContents[file] ? <EditorContent editor={editor} className="review-tiptap-body" /> : <div style={{ padding: '20px', color: 'var(--color-text-tertiary)' }}>Loading…</div>}
                          </div>
                        ) : (
                          <div className="review-diff-doc">
                            {!diff && <div style={{ padding: '20px', color: 'var(--color-text-tertiary)' }}>Loading…</div>}
                            {diff && diff.filter(l => l.type !== 'header').map((line, i) => (
                              <div key={i} className={`review-diff-doc-line ${line.type}`}>{line.content || ' '}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {isAuthor ? (
              <div className="review-actionbar">
                <span className="review-actionbar-note">
                  {pr.reviewDecision === 'CHANGES_REQUESTED' ? 'Make your changes, then it goes back for another look.'
                    : pr.reviewDecision === 'APPROVED' ? 'Approved — ready to publish.'
                    : 'Waiting on your reviewer.'}
                </span>
                <div className="review-actionbar-btns">
                  <button className="review-btn ghost" onClick={makeEdits}>Make edits</button>
                  {pr.reviewDecision === 'APPROVED' && (
                    <button className="review-btn publish" onClick={publish} disabled={publishing || !online}>{publishing ? 'Publishing…' : 'Publish'}</button>
                  )}
                </div>
              </div>
            ) : (
              <div className="review-actionbar reviewer">
                <textarea
                  className="review-ta"
                  placeholder="Optional note — or say what should change if you're requesting changes…"
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                />
                <div className="review-actionbar-row">
                  <span className="review-actionbar-hint">{reviewedFiles.size} of {files.length} file{files.length === 1 ? '' : 's'} reviewed</span>
                  <div className="review-actionbar-btns">
                    <button className="review-btn req" onClick={() => handleSubmitReview('request-changes')} disabled={!hasComment || status === 'submitting' || !online}
                      title={!online ? "You're offline — reconnect to submit" : !hasComment ? 'Add a note describing what should change' : ''}>
                      {status === 'submitting' && action === 'request-changes' ? 'Submitting…' : 'Request changes'}
                    </button>
                    <button className="review-btn approve" onClick={() => handleSubmitReview('approve')} disabled={!allReviewed || status === 'submitting' || !online}
                      title={!online ? "You're offline — reconnect to submit" : !allReviewed ? 'Mark all files as reviewed first' : ''}>
                      {status === 'submitting' && action === 'approve' ? 'Approving…' : allReviewed ? 'Approve' : `Approve (${reviewedFiles.size}/${files.length})`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="review-header"><div style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '20px' }}>Loading…</div></div>
        )}
      </div>
    </div>
  )
}
