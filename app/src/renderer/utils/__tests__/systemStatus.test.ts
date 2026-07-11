import { describe, it, expect } from 'vitest'
import { describeSystemStatus, metaLine } from '../systemStatus'

describe('describeSystemStatus', () => {
  it('is Not connected when there is no folder', () => {
    expect(describeSystemStatus(false, false)).toEqual({ label: 'Not connected', tone: 'idle' })
  })
  it('is Unpublished changes when connected with work', () => {
    expect(describeSystemStatus(true, true)).toEqual({ label: 'Unpublished changes', tone: 'attention' })
  })
  it('is Up to date when connected and clean', () => {
    expect(describeSystemStatus(true, false)).toEqual({ label: 'Up to date', tone: 'ok' })
  })
})

describe('metaLine', () => {
  it('joins label and count', () => {
    expect(metaLine({ label: 'Up to date', tone: 'ok' }, 12)).toBe('Up to date · 12 playbooks')
  })
  it('uses singular for one', () => {
    expect(metaLine({ label: 'Up to date', tone: 'ok' }, 1)).toBe('Up to date · 1 playbook')
  })
  it('shows only the label when count is null', () => {
    expect(metaLine({ label: 'Not connected', tone: 'idle' }, null)).toBe('Not connected')
  })
})
