import { describe, it, expect } from 'vitest'
import { reflowMarkdown } from '../reflowMarkdown'
import { roundTrip } from '../markdownSerializer'

describe('reflowMarkdown', () => {
  it('joins a hard-wrapped paragraph into one line', () => {
    const wrapped = 'This is a single logical sentence that has\nbeen hard wrapped across several lines by\nthe tool that generated the markdown file.'
    expect(reflowMarkdown(wrapped)).toBe(
      'This is a single logical sentence that has been hard wrapped across several lines by the tool that generated the markdown file.',
    )
  })

  it('keeps separate paragraphs separate', () => {
    const md = 'First paragraph line one\nline two of first.\n\nSecond paragraph line one\nline two of second.'
    expect(reflowMarkdown(md)).toBe(
      'First paragraph line one line two of first.\n\nSecond paragraph line one line two of second.',
    )
  })

  it('preserves an intentional hard break (two trailing spaces)', () => {
    const md = 'line one  \nline two'
    expect(reflowMarkdown(md)).toBe('line one  \nline two')
  })

  it('does not touch fenced code blocks', () => {
    const md = 'intro prose that\nwraps here\n\n```js\nconst a = 1\nconst b = 2\n\nconst c = 3\n```\n\nafter the\ncode block'
    const out = reflowMarkdown(md)
    expect(out).toContain('```js\nconst a = 1\nconst b = 2\n\nconst c = 3\n```')
    expect(out).toContain('intro prose that wraps here')
    expect(out).toContain('after the code block')
  })

  it('leaves list items on their own lines', () => {
    const md = '- first item\n- second item\n- third item'
    expect(reflowMarkdown(md)).toBe(md)
  })

  it('leaves an ordered list untouched', () => {
    const md = '1. one\n2. two\n3. three'
    expect(reflowMarkdown(md)).toBe(md)
  })

  it('does not merge a heading with the following paragraph', () => {
    const md = '# Title\nbody text that\nwraps'
    expect(reflowMarkdown(md)).toBe('# Title\nbody text that wraps')
  })

  it('preserves a setext heading underline', () => {
    const md = 'Title\n=====\n\nbody'
    expect(reflowMarkdown(md)).toBe('Title\n=====\n\nbody')
  })

  it('leaves a table intact', () => {
    const md = '| a | b |\n| - | - |\n| 1 | 2 |'
    expect(reflowMarkdown(md)).toBe(md)
  })

  it('is idempotent', () => {
    const md = 'a wrapped\nsentence here.\n\n- item'
    const once = reflowMarkdown(md)
    expect(reflowMarkdown(once)).toBe(once)
  })

  it('a reflowed wrapped paragraph parses to a single break-free paragraph', () => {
    const wrapped = 'The quick brown fox\njumps over the\nlazy dog.'
    const out = roundTrip(reflowMarkdown(wrapped)).trim()
    expect(out).toBe('The quick brown fox jumps over the lazy dog.')
    expect(out).not.toContain('\n')
  })
})
