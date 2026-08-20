import Modal from './Modal'
import Button from './Button'

interface ConflictModalProps {
  isOpen: boolean
  files: string[]
  /** Pull request URL to resolve the overlap on GitHub. Absent if the draft couldn't be pushed (e.g. offline). */
  prUrl?: string | null
  onClose: () => void
}

/** Calm, non-technical recovery when the Live Version changed in a way that overlaps the draft. */
export default function ConflictModal({ isOpen, files, prUrl, onClose }: ConflictModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="The Live Version changed while you were working"
      footer={
        prUrl ? (
          <>
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button variant="primary" onClick={() => window.open(prUrl)}>Resolve on GitHub</Button>
          </>
        ) : (
          <Button variant="primary" onClick={onClose}>Got it</Button>
        )
      }
    >
      <p>
        Someone published edits that overlap yours in{' '}
        {files.map((f, i) => (
          <span key={f}><strong>{f}</strong>{i < files.length - 1 ? ', ' : ''}</span>
        ))}
        . Your draft is safe and unchanged — nothing was lost.
      </p>
      {prUrl ? (
        <p>
          To finish, resolve the overlap on GitHub: open the pull request, use GitHub’s{' '}
          <strong>Resolve conflicts</strong> editor to combine the two versions, and merge.
          Back here, hit <strong>Refresh</strong> and you’re up to date.
        </p>
      ) : (
        <p>
          To finish publishing, bring your draft up to date: <strong>Refresh</strong> the Live
          Version, then re-apply your changes in a new draft. (If you’re offline, reconnect and
          try publishing again to resolve it on GitHub.)
        </p>
      )}
    </Modal>
  )
}
