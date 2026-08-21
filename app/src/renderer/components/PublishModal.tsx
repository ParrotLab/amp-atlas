import { useState, useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import Modal from './Modal'
import Button from './Button'
import Input from './Input'
import { editorExtensions } from '../utils/markdownSerializer'
import './PublishModal.css'

interface PublishModalProps {
  isOpen: boolean
  onClose: () => void
  onPublish: (title: string, description: string, reviewers: string[]) => Promise<boolean>
  draftName: string
  modifiedCount: number
  newCount: number
  repoPath: string
  hasPR?: boolean
  draft?: boolean
  existingTitle?: string
  existingBody?: string
  /** Reviewers who requested changes: pre-selected, not de-selectable, and re-requested on submit. */
  lockedReviewers?: string[]
  /** Reviewers already on the review: pre-selected on open (but can be de-selected, unlike locked). */
  preselectedReviewers?: string[]
}

const AVATAR_COLORS = ['#8B2BFF', '#FF7B00', '#7A3D8F', '#16A34A', '#2563EB', '#E11D48']
function avatarColor(login: string): string {
  let hash = 0
  for (let i = 0; i < login.length; i++) hash = login.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export default function PublishModal({ isOpen, onClose, onPublish, draftName, modifiedCount, newCount, repoPath, hasPR = false, draft = false, existingTitle, existingBody, lockedReviewers = [], preselectedReviewers = [] }: PublishModalProps) {
  // hasPR drives prefill (reuse the existing PR's title/body); inReview drives the labels —
  // a pulled-back draft PR is "Submit for review", not "Add to review".
  const inReview = hasPR && !draft
  const [title, setTitle] = useState('')
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([])
  const descEditor = useEditor({ extensions: editorExtensions(), editable: true, content: '' })
  const [members, setMembers] = useState<{ login: string; name: string }[]>([])
  const [draftCommits, setDraftCommits] = useState<{ hash: string; message: string; date: string }[]>([])
  const [draftFiles, setDraftFiles] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'publishing' | 'done'>('idle')
  const [submittedPR, setSubmittedPR] = useState<{ number: number; title: string; url: string } | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const prevOpen = useRef(false)

  // Initialize ONLY when the modal transitions closed→open. Guarding on the
  // open transition (not every prop change) prevents a mid-submit prop refresh
  // — e.g. prStatus updating after "Add to review" — from resetting the form
  // and flashing it between the publishing and success states.
  useEffect(() => {
    const justOpened = isOpen && !prevOpen.current
    prevOpen.current = isOpen
    if (!justOpened) return

    setTitle(hasPR ? (existingTitle || draftName || '') : (draftName || ''))
    descEditor?.commands.setContent(hasPR ? (existingBody || '') : '', { contentType: 'markdown' })
    // Pre-select everyone already on the review (locked ones are always included); keep them so a
    // re-submit doesn't silently drop reviewers. The author can still de-select the non-locked ones.
    setSelectedReviewers(preselectedReviewers.filter(r => !lockedReviewers.includes(r)))
    setStatus('idle')
    setSubmittedPR(null)
    setDraftCommits([])
    setDraftFiles([])
    setTimeout(() => titleRef.current?.focus(), 100)

    // Fetch what this draft adds vs Live Version
    if (repoPath) {
      window.api.git.draftChanges(repoPath).then(result => {
        if (result.ok) {
          setDraftCommits(result.commits || [])
          setDraftFiles(result.filesChanged || [])
        }
      })
      window.api.github.collaborators(repoPath).then(r => { if (r.ok) setMembers(r.collaborators) })
    }
  }, [isOpen, draftName, repoPath, hasPR, existingTitle, existingBody, descEditor])


  const toggleReviewer = (name: string) => {
    if (lockedReviewers.includes(name)) return   // locked reviewers can't be de-selected
    setSelectedReviewers(prev =>
      prev.includes(name) ? prev.filter(r => r !== name) : [...prev, name]
    )
  }

  // Locked reviewers (who requested changes) are always included, plus anyone the user adds.
  const finalReviewers = Array.from(new Set([...lockedReviewers, ...selectedReviewers]))

  const handlePublish = async () => {
    if (!title.trim() || status !== 'idle') return
    setStatus('publishing')
    const description = (descEditor?.getMarkdown() || '').trim()
    const ok = await onPublish(title.trim(), description, finalReviewers)
    if (!ok) { setStatus('idle'); return }   // failure → stay on the form (error toast shown upstream)
    // Surface the resulting PR so the user knows what to reference later.
    try {
      const s = await window.api.git.prStatus(repoPath)
      if (s.ok && s.hasPR && s.pr) setSubmittedPR({ number: s.pr.number, title: s.pr.title, url: s.pr.url })
    } catch { /* ignore */ }
    setStatus('done')
  }

  if (status === 'done') {
    return (
      <Modal isOpen={isOpen} onClose={onClose} maxWidth={520}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#10003;</div>
          <div className="publish-title">{hasPR ? 'Added to review' : 'Submitted for review'}</div>
          <div className="publish-subtitle">
            {finalReviewers.length > 0 ? `${finalReviewers.join(' and ')} will be notified.` : 'Your work is ready for a reviewer.'}
          </div>
          {submittedPR && (
            <div className="publish-pr-ref">
              <div className="publish-pr-title">{submittedPR.title}</div>
              <button className="publish-pr-link" onClick={() => window.open(submittedPR.url)}>Review #{submittedPR.number} · View on GitHub</button>
            </div>
          )}
          <div style={{ marginTop: '18px' }}>
            <Button variant="ghost" onClick={onClose}>Done</Button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth={520}
      title={inReview ? 'Add to review' : 'Submit for review'}
      subtitle={inReview ? 'Update the title or description, and request more reviewers.' : 'Share your work and request a review.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!title.trim() || status === 'publishing'} onClick={handlePublish}>
            {status === 'publishing' ? 'Submitting…' : inReview ? 'Add to review' : 'Submit for review'}
          </Button>
        </>
      }
    >
            <div className="publish-summary">
              <div className="publish-summary-label">What you're publishing</div>
              {draftCommits.length > 0 || draftFiles.length > 0 || modifiedCount > 0 || newCount > 0 ? (
                <>
                  <div className="publish-summary-stats">
                    {draftCommits.length > 0 && (
                      <span className="publish-summary-stat">
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#8B2BFF' }} />
                        {draftCommits.length} save{draftCommits.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    {draftFiles.length > 0 && (
                      <span className="publish-summary-stat">
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#16A34A' }} />
                        {draftFiles.length} file{draftFiles.length !== 1 ? 's' : ''} changed
                      </span>
                    )}
                    {modifiedCount > 0 && (
                      <span className="publish-summary-stat">
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#C47A0A' }} />
                        {modifiedCount} unsaved edit{modifiedCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {draftCommits.length > 0 && (
                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {draftCommits.slice(0, 5).map(c => (
                        <div key={c.hash} style={{ fontSize: '12px', color: '#6B6966', display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#D4D0CC', flexShrink: 0 }} />
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.message}</span>
                          <span style={{ color: '#B5B1AC', fontSize: '11px', flexShrink: 0 }}>{new Date(c.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        </div>
                      ))}
                      {draftCommits.length > 5 && (
                        <div style={{ fontSize: '11px', color: '#B5B1AC' }}>+ {draftCommits.length - 5} more</div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color: '#B5B1AC', fontSize: '13px' }}>No changes to publish</div>
              )}
            </div>

            <div className="publish-field">
              <div className="publish-label">Title</div>
              <Input
                ref={titleRef}
                type="text"
                placeholder="What did you work on?"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            <div className="publish-field">
              <div className="publish-label">Description (optional)</div>
              <EditorContent editor={descEditor} className="publish-editor" />
            </div>

            <div className="publish-field">
              <div className="publish-label">{hasPR ? 'Request additional reviewers' : 'Request review from'}</div>
              {lockedReviewers.length > 0 && (
                <div className="publish-reviewers-hint">
                  Reviewer{lockedReviewers.length !== 1 ? 's' : ''} who requested changes {lockedReviewers.length !== 1 ? 'are' : 'is'} included automatically — add more if you like.
                </div>
              )}
              <div className="publish-reviewers">
                {members.length === 0 && <div style={{ fontSize: '12px', color: '#B5B1AC' }}>No collaborators found for this system.</div>}
                {members.map(member => {
                  const isLocked = lockedReviewers.includes(member.login)
                  const isSelected = isLocked || selectedReviewers.includes(member.login)
                  return (
                    <button
                      key={member.login}
                      className={`publish-reviewer ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}`}
                      onClick={() => toggleReviewer(member.login)}
                      aria-disabled={isLocked}
                      title={isLocked ? 'They requested changes, so they’ll automatically be asked to re-review.' : undefined}
                    >
                      <div className="publish-reviewer-avatar" style={{ background: avatarColor(member.login) }}>
                        {member.login.charAt(0).toUpperCase()}
                      </div>
                      @{member.login}
                      {isLocked && <span className="publish-reviewer-tag">Re-review</span>}
                    </button>
                  )
                })}
              </div>
            </div>

    </Modal>
  )
}
