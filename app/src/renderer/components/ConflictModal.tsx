import Modal from './Modal'
import Button from './Button'

interface ConflictModalProps {
  isOpen: boolean
  files: string[]
  onClose: () => void
}

/** Calm, non-technical escalation when the Live Version changed in a way that overlaps the draft. */
export default function ConflictModal({ isOpen, files, onClose }: ConflictModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="The Live Version changed while you were working"
      footer={<Button variant="primary" onClick={onClose}>Got it</Button>}
    >
      <p>
        Someone published edits that overlap yours in{' '}
        {files.map((f, i) => (
          <span key={f}><strong>{f}</strong>{i < files.length - 1 ? ', ' : ''}</span>
        ))}
        . Your draft is safe and unchanged — nothing was lost.
      </p>
      <p>
        To finish publishing, <strong>contact your team lead</strong> and they’ll help merge the two versions.
      </p>
    </Modal>
  )
}
