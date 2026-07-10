import Modal from './Modal'
import Button from './Button'

interface ConfirmSwitchModalProps {
  isOpen: boolean
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export default function ConfirmSwitchModal({ isOpen, onSave, onDiscard, onCancel }: ConfirmSwitchModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="You have unsaved edits in this draft"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onDiscard}>Discard</Button>
          <Button variant="primary" onClick={onSave}>Save &amp; switch</Button>
        </>
      }
    >
      <p>Save them before switching, or discard them? Discarding can’t be undone.</p>
    </Modal>
  )
}
