import { describe, it, expect } from 'vitest'
import { cardMeta } from '../systemCardMeta'

describe('cardMeta', () => {
  it('is Not connected when there is no folder', () => {
    expect(cardMeta(false, null, '')).toBe('Not connected')
  })

  it('joins playbook count and last-updated', () => {
    expect(cardMeta(true, 40, '2h ago')).toBe('40 playbooks · Updated 2h ago')
  })

  it('uses singular for one playbook', () => {
    expect(cardMeta(true, 1, '3d ago')).toBe('1 playbook · Updated 3d ago')
  })

  it('shows only the update when the count is unavailable', () => {
    expect(cardMeta(true, null, '2h ago')).toBe('Updated 2h ago')
  })

  it('shows only the count when there is no update time', () => {
    expect(cardMeta(true, 40, '')).toBe('40 playbooks')
  })

  it('falls back to Connected when nothing is known yet', () => {
    expect(cardMeta(true, null, '')).toBe('Connected')
  })
})
