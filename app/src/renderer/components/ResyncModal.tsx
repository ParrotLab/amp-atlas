import Modal from './Modal'
import Button from './Button'

interface ResyncModalProps {
  isOpen: boolean
  systemName: string
  onPublishFirst: () => void
  onDiscard: () => void
  onClose: () => void
}

/** Shown when Re-sync is requested on a system that has unpublished work. */
export default function ResyncModal({ isOpen, systemName, onPublishFirst, onDiscard, onClose }: ResyncModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`You have unpublished work in ${systemName}`}
      footer={
        <>
          <Button variant="primary" onClick={onPublishFirst}>Publish first</Button>
          <Button variant="ghost" onClick={onClose}>Keep editing</Button>
          <Button variant="danger" onClick={onDiscard}>Discard &amp; re-sync</Button>
        </>
      }
    >
      <p>
        Re-syncing replaces this system with the Live Version from GitHub. What would you like to do with your unpublished work?
      </p>
    </Modal>
  )
}
