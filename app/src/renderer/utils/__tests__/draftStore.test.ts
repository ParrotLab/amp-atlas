import { describe, it, expect, beforeEach } from 'vitest'
import {
  registerDraft, setDraftState, touchDraft, removeDraft,
  getDraft, listActive, listArchived,
} from '../draftStore'

beforeEach(() => localStorage.clear())

describe('draftStore', () => {
  it('registers a draft as active with a title', () => {
    registerDraft('sys1', 'draft/onboarding', 'Onboarding')
    const d = getDraft('sys1', 'draft/onboarding')!
    expect(d.title).toBe('Onboarding')
    expect(d.state).toBe('active')
  })

  it('lists only active drafts under active, archived under archived', () => {
    registerDraft('sys1', 'draft/a', 'A')
    registerDraft('sys1', 'draft/b', 'B')
    setDraftState('sys1', 'draft/b', 'archived')
    expect(listActive('sys1').map(d => d.branch)).toEqual(['draft/a'])
    expect(listArchived('sys1').map(d => d.branch)).toEqual(['draft/b'])
  })

  it('isolates drafts per system', () => {
    registerDraft('sys1', 'draft/a', 'A')
    registerDraft('sys2', 'draft/a', 'A')
    setDraftState('sys1', 'draft/a', 'archived')
    expect(listActive('sys1')).toHaveLength(0)
    expect(listActive('sys2')).toHaveLength(1)
  })

  it('touch updates lastOpenedAt without changing state', () => {
    registerDraft('sys1', 'draft/a', 'A')
    setDraftState('sys1', 'draft/a', 'archived')
    touchDraft('sys1', 'draft/a')
    expect(getDraft('sys1', 'draft/a')!.state).toBe('archived')
  })

  it('removes a draft entirely', () => {
    registerDraft('sys1', 'draft/a', 'A')
    removeDraft('sys1', 'draft/a')
    expect(getDraft('sys1', 'draft/a')).toBeUndefined()
  })

  it('re-registering an existing branch keeps it and refreshes title', () => {
    registerDraft('sys1', 'draft/a', 'Old')
    setDraftState('sys1', 'draft/a', 'archived')
    registerDraft('sys1', 'draft/a', 'New')
    const d = getDraft('sys1', 'draft/a')!
    expect(d.title).toBe('New')
    expect(d.state).toBe('active')
  })
})
