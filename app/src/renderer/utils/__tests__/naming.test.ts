import { describe, it, expect } from 'vitest'
import { displayName } from '../naming'

describe('displayName', () => {
  it('hides the .md extension but keeps spaces and capitalization', () => {
    expect(displayName('This File.md')).toBe('This File')
    expect(displayName('admin__executing-clickup-tasks.md')).toBe('admin__executing-clickup-tasks')
  })

  it('leaves folder-like names (no .md) untouched', () => {
    expect(displayName('reference')).toBe('reference')
    expect(displayName('My Folder')).toBe('My Folder')
  })

  it('only strips a trailing .md, not mid-name occurrences', () => {
    expect(displayName('notes.md.backup')).toBe('notes.md.backup')
    expect(displayName('readme.md')).toBe('readme')
  })
})
