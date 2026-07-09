import { describe, it, expect } from 'vitest'
import { shouldOpenForm } from '../support'

describe('shouldOpenForm', () => {
  it('returns true when a form URL is configured', () => {
    expect(shouldOpenForm('https://airtable.com/form')).toBe(true)
  })
  it('returns false when the URL is empty', () => {
    expect(shouldOpenForm('')).toBe(false)
  })
  it('returns false for whitespace-only', () => {
    expect(shouldOpenForm('   ')).toBe(false)
  })
})
