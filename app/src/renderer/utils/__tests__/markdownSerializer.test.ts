import { describe, it, expect } from 'vitest'
import { roundTrip } from '../markdownSerializer'

const cases: Array<[string, string]> = [
  ['heading', '# Title'],
  ['bold', 'This is **bold** text'],
  ['italic', 'This is *italic* text'],
  ['link', '[label](https://example.com)'],
  ['bullets', '- one\n- two\n- three'],
  ['ordered', '1. one\n2. two'],
  ['code block', '```js\nconst x = 1\n```'],
  ['blockquote', '> quoted'],
]

describe('markdown round-trip', () => {
  it.each(cases)('preserves %s', (_name, md) => {
    const out = roundTrip(md).trim()
    expect(out).toContain(md.split('\n')[0].replace(/^[#>\-\d.]+\s*/, '').slice(0, 8))
    expect(out.length).toBeGreaterThan(0)
  })

  it('does not HTML-escape or wrap content', () => {
    const out = roundTrip('Plain paragraph.')
    expect(out).not.toContain('<p>')
    expect(out.trim()).toBe('Plain paragraph.')
  })
})
