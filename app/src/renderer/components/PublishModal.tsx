import { useState, useEffect, useRef } from 'react'
import './PublishModal.css'

interface PublishModalProps {
  isOpen: boolean
  onClose: () => void
  onPublish: (title: string, description: string, reviewers: string[]) => Promise<void>
  draftName: string
  modifiedCount: number
  newCount: number
  repoPath: string
}

const teamMembers = [
  { name: 'Kristi', initial: 'K', color: '#8B2BFF' },
  { name: 'Rachel', initial: 'R', color: '#FF7B00' },
  { name: 'Rose', initial: 'R', color: '#7A3D8F' },
  { name: 'Hannah', initial: 'H', color: '#16A34A' },
]

export default function PublishModal({ isOpen, onClose, onPublish, draftName, modifiedCount, newCount, repoPath }: PublishModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([])
  const [draftCommits, setDraftCommits] = useState<{ hash: string; message: string; date: string }[]>([])
  const [draftFiles, setDraftFiles] = useState<string[]>([])
  const [status, setStatus] = useState<'idle' | 'publishing' | 'done'>('idle')
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTitle(draftName || '')
      setDescription('')
      setSelectedReviewers([])
      setStatus('idle')
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
      }
    }
  }, [isOpen, draftName, repoPath])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const toggleReviewer = (name: string) => {
    setSelectedReviewers(prev =>
      prev.includes(name) ? prev.filter(r => r !== name) : [...prev, name]
    )
  }

  const handlePublish = async () => {
    if (!title.trim() || status !== 'idle') return
    setStatus('publishing')
    await onPublish(title.trim(), description.trim(), selectedReviewers)
    setStatus('done')
    setTimeout(() => onClose(), 1500)
  }

  if (!isOpen) return null

  const totalChanges = modifiedCount + newCount

  return (
    <div className="publish-overlay" onClick={onClose}>
      <div className="publish-modal" onClick={e => e.stopPropagation()}>
        {status === 'done' ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#10003;</div>
            <div className="publish-title">Published!</div>
            <div className="publish-subtitle">
              Your changes are now visible to the team.
              {selectedReviewers.length > 0 && ` ${selectedReviewers.join(' and ')} will be notified.`}
            </div>
          </div>
        ) : (
          <>
            <div className="publish-title">Publish Your Changes</div>
            <div className="publish-subtitle">
              Share your work with the team and request a review.
            </div>

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
              <input
                ref={titleRef}
                className="publish-input"
                type="text"
                placeholder="What did you work on?"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>

            <div className="publish-field">
              <div className="publish-label">Description (optional)</div>
              <textarea
                className="publish-textarea"
                placeholder="Add any context for your reviewers..."
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            <div className="publish-field">
              <div className="publish-label">Request review from</div>
              <div className="publish-reviewers">
                {teamMembers.map(member => (
                  <button
                    key={member.name}
                    className={`publish-reviewer ${selectedReviewers.includes(member.name) ? 'selected' : ''}`}
                    onClick={() => toggleReviewer(member.name)}
                  >
                    <div className="publish-reviewer-avatar" style={{ background: member.color }}>
                      {member.initial}
                    </div>
                    {member.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="publish-footer">
              <button className="publish-btn cancel" onClick={onClose}>
                Cancel
              </button>
              <button
                className={`publish-btn ${status === 'publishing' ? 'publishing' : 'submit'}`}
                disabled={!title.trim() || status === 'publishing'}
                onClick={handlePublish}
              >
                {status === 'publishing' ? 'Publishing...' : 'Publish & Request Review'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
