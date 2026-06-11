import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { getSystem } from '../utils/systemStore'
import { markdownToHtml } from '../utils/markdown'
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
  const [fileContents, setFileContents] = useState<Record<string, string>>({})
  const [viewMode, setViewMode] = useState<Record<string, 'changes' | 'final'>>({})
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle')
  const [action, setAction] = useState<'approve' | 'request-changes' | null>(null)

  const system = systemId ? getSystem(systemId) : undefined
  const repoPath = system?.folderPath || ''
  const prNum = parseInt(prNumber || '0')

  // TipTap editor for Final view
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } })],
    editable: false,
    content: '',
  })

  useEffect(() => {
    if (!repoPath || !prNum) return
    window.api.git.listPRs(repoPath).then(result => {
      if (result.ok) {
        const found = result.prs.find(p => p.number === prNum)
        if (found) setPr(found)
      }
    })
    window.api.git.prDiff(repoPath, prNum).then(result => {
      if (result.ok && result.files.length > 0) {
        setFiles(result.files)
        setExpandedFile(result.files[0])
      }
    })
  }, [repoPath, prNum])

  // Load diff and content when a file is expanded
  useEffect(() => {
    if (!expandedFile || !repoPath || !prNum) return

    // Load diff if not cached
    if (!fileDiffs[expandedFile]) {
      window.api.git.prFileDiff(repoPath, prNum, expandedFile).then(result => {
        if (result.ok) setFileDiffs(prev => ({ ...prev, [expandedFile]: result.lines }))
      })
    }

    // Load file content if not cached (for Final view)
    if (!fileContents[expandedFile]) {
      window.api.git.prFileContent(repoPath, prNum, expandedFile).then(result => {
        if (result.ok) {
          setFileContents(prev => ({ ...prev, [expandedFile]: result.content }))
          // If we're on Final view, update the editor
          if (getViewMode(expandedFile) === 'final' && editor) {
            const isMarkdown = expandedFile.endsWith('.md') || expandedFile.endsWith('.mdx')
            if (isMarkdown) {
              let md = result.content
              const fmMatch = md.match(/^---\n[\s\S]*?\n---\n?/)
              if (fmMatch) md = md.substring(fmMatch[0].length)
              editor.commands.setContent(markdownToHtml(md))
            } else {
              editor.commands.setContent(`<pre><code>${result.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`)
            }
          }
        }
      })
    }
  }, [expandedFile, repoPath, prNum])

  // Update TipTap when switching to Final view
  useEffect(() => {
    if (!expandedFile || !editor) return
    const mode = getViewMode(expandedFile)
    const content = fileContents[expandedFile]
    if (mode === 'final' && content) {
      const isMarkdown = expandedFile.endsWith('.md') || expandedFile.endsWith('.mdx')
      if (isMarkdown) {
        let md = content
        const fmMatch = md.match(/^---\n[\s\S]*?\n---\n?/)
        if (fmMatch) md = md.substring(fmMatch[0].length)
        editor.commands.setContent(markdownToHtml(md))
      } else {
        editor.commands.setContent(`<pre><code>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`)
      }
    }
  }, [viewMode, expandedFile, fileContents, editor])

  const toggleFile = (file: string) => setExpandedFile(expandedFile === file ? null : file)
  const getViewMode = (file: string) => viewMode[file] || 'final'
  const toggleViewMode = (file: string) => setViewMode(prev => ({ ...prev, [file]: prev[file] === 'changes' ? 'final' : 'changes' }))

  const handleSubmitReview = async (reviewAction: 'approve' | 'request-changes') => {
    if (!repoPath) return
    setAction(reviewAction)
    setStatus('submitting')
    const result = await window.api.git.reviewPR(repoPath, prNum, reviewAction, comment)
    if (result.ok) { setStatus('done') } else { alert(`Couldn't submit review: ${result.error}`); setStatus('idle') }
  }

  const fileNameOf = (path: string) => path.split('/').pop() || path
  const filePathOf = (path: string) => { const p = path.split('/'); return p.length > 1 ? p.slice(0, -1).join('/') + '/' : '' }

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
                        <span className="review-file-name-label">{fileNameOf(file)}</span>
                        <span className="review-file-path">{filePathOf(file)}</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="review-file-content">
                        <div className="review-file-toolbar">
                          <button className={`review-view-toggle ${mode === 'final' ? 'active' : ''}`} onClick={() => { if (mode !== 'final') toggleViewMode(file) }}>Final</button>
                          <button className={`review-view-toggle ${mode === 'changes' ? 'active' : ''}`} onClick={() => { if (mode !== 'changes') toggleViewMode(file) }}>Changes</button>
                        </div>

                        {mode === 'final' ? (
                          <div className="review-tiptap-container">
                            {fileContents[file] ? (
                              <EditorContent editor={editor} className="review-tiptap-body" />
                            ) : (
                              <div style={{ padding: '20px', color: '#B5B1AC' }}>Loading...</div>
                            )}
                          </div>
                        ) : (
                          <div className="review-diff-doc">
                            {!diff && <div style={{ padding: '20px', color: '#B5B1AC' }}>Loading...</div>}
                            {diff && diff.filter(l => l.type !== 'header').map((line, i) => (
                              <div key={i} className={`review-diff-doc-line ${line.type}`}>
                                {line.content || '\u00A0'}
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
