import { describe, it, expect } from 'vitest'
import { roundTrip } from '../markdownSerializer'
describe('markdown escaping fix', () => {
  it('does not HTML-encode > < &', () => {
    expect(roundTrip('If count > 0, proceed.').trim()).toBe('If count > 0, proceed.')
    expect(roundTrip('a < b & c').trim()).toBe('a < b & c')
  })
  it('does not backslash-escape ~ _ * in prose', () => {
    expect(roundTrip('HelpScout allows ~200 requests').trim()).toBe('HelpScout allows ~200 requests')
    expect(roundTrip('some_var_name here').trim()).toBe('some_var_name here')
    expect(roundTrip('a * b * c').trim()).toBe('a * b * c')
  })
  it('keeps code spans literal', () => {
    expect(roundTrip('use `pace` param').trim()).toBe('use `pace` param')
  })
  it('preserves real emphasis/bold marks', () => {
    expect(roundTrip('This is **bold** and *italic*').trim()).toContain('**bold**')
    expect(roundTrip('This is **bold** and *italic*').trim()).toContain('*italic*')
  })
  it('preserves headings and lists', () => {
    expect(roundTrip('# Title').trim()).toBe('# Title')
    expect(roundTrip('- one\n- two').trim()).toBe('- one\n- two')
  })
})
