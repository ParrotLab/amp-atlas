import Modal from './Modal'
import Button from './Button'

interface ConflictModalProps {
  isOpen: boolean
  files: string[]
  onClose: () => void
}

/** Calm, non-technical recovery when the Live Version changed in a way that overlaps the draft. */
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
        To finish publishing, bring your draft up to date with those edits:
        <strong>Refresh</strong> the Live Version, then re-apply your changes in a new draft on
        top of the latest. Comfortable with GitHub? You can also resolve the overlap directly there.
      </p>
    </Modal>
  )
}
