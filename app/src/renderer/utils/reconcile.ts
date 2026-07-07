export type ReconcileDecision = 'ignore' | 'reload' | 'prompt'

/**
 * Decide what to do when an open file may have changed on disk.
 * - disk === lastWritten  → nothing really changed (or it was our own autosave)
 * - editor === lastWritten → editor is clean → adopt disk silently
 * - otherwise             → editor and disk both diverged → ask the user
 */
export function reconcileDecision(diskContent: string, lastWritten: string, editorContent: string): ReconcileDecision {
  if (diskContent === lastWritten) return 'ignore'
  if (editorContent === lastWritten) return 'reload'
  return 'prompt'
}
