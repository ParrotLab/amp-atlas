import { useEffect } from 'react'
import './ResyncModal.css'

interface ResyncModalProps {
  isOpen: boolean
  systemName: string
  onPublishFirst: () => void
  onDiscard: () => void
  onClose: () => void   // "Keep editing" / cancel
}

/** Shown when Re-sync is requested on a system that has unpublished work. */
export default function ResyncModal({ isOpen, systemName, onPublishFirst, onDiscard, onClose }: ResyncModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="resync-modal-overlay" onClick={onClose}>
      <div className="resync-modal" onClick={e => e.stopPropagation()}>
        <h2 className="resync-modal-title">You have unpublished work in {systemName}</h2>
        <p className="resync-modal-body">
          Re-syncing replaces this system with the Live Version from GitHub. What would you like to do with your unpublished work?
        </p>
        <div className="resync-modal-actions">
          <button className="resync-modal-primary" onClick={onPublishFirst}>Publish first</button>
          <button className="resync-modal-ghost" onClick={onClose}>Keep editing</button>
          <button className="resync-modal-danger" onClick={onDiscard}>Discard &amp; re-sync</button>
        </div>
      </div>
    </div>
  )
}
