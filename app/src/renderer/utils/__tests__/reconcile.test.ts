import { describe, it, expect } from 'vitest'
import { reconcileDecision } from '../reconcile'

describe('reconcileDecision', () => {
  it('ignores when disk equals what we last wrote (our own autosave)', () => {
    expect(reconcileDecision('X', 'X', 'X')).toBe('ignore')
    expect(reconcileDecision('X', 'X', 'Y')).toBe('ignore') // even if buffer differs, disk is unchanged
  })

  it('reloads when the editor is clean but disk changed externally', () => {
    // buffer matches lastWritten (clean), disk is different
    expect(reconcileDecision('DISK', 'OLD', 'OLD')).toBe('reload')
  })

  it('prompts when both the editor and disk diverged (true collision)', () => {
    expect(reconcileDecision('DISK', 'OLD', 'MINE')).toBe('prompt')
  })
})
