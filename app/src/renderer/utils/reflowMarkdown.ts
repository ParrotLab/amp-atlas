/**
 * Collapse "soft wraps" — single newlines inside a prose paragraph — back into one line.
 *
 * Tools that generate markdown (including Claude) hard-wrap prose at ~80 columns. Standard
 * markdown treats a single newline inside a paragraph as a space, but our editor preserves it
 * as a literal mid-sentence line break, so a wrapped paragraph shows breaks every ~80 chars and
 * they have to be deleted one at a time. Reflowing on load joins those wrapped lines back into a
 * single paragraph, which is how the file renders on GitHub anyway.
 *
 * Left untouched: fenced code blocks, indented code, blank lines (paragraph breaks), and every
 * structural line (heading, list item, blockquote, table row, thematic break, HTML). Intentional
 * hard breaks — a line ending in two-or-more spaces or a backslash — are preserved as breaks.
 *
 * Known limitation: wrapped text *inside* a blockquote or list item (every line prefixed with
 * `>` or a list marker) is left as-is; only plain paragraphs are reflowed.
 */
export function reflowMarkdown(md: string): string {
  const lines = md.split('\n')
  const out: string[] = []
  let fenceChar: string | null = null // first char of the active code fence (``` or ~~~), or null

  const fenceCharOf = (line: string): string | null => {
    const m = line.match(/^\s{0,3}(```+|~~~+)/)
    return m ? m[1][0] : null
  }

  // A line that begins a markdown block and therefore must not be merged into the line above it.
  const isStructural = (line: string): boolean =>
    /^\s{0,3}#{1,6}(\s|$)/.test(line) ||           // ATX heading
    /^\s{0,3}>/.test(line) ||                       // blockquote
    /^\s*([-*+])\s/.test(line) ||                   // unordered list item
    /^\s*\d+[.)]\s/.test(line) ||                   // ordered list item
    /^\s*\|/.test(line) ||                          // table row
    /^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line) ||// thematic break
    /^\s{0,3}(=+|-+)\s*$/.test(line) ||             // setext underline (=== / ---)
    /^\s*<[a-zA-Z!/]/.test(line) ||                 // HTML block
    /^( {4,}|\t)/.test(line)                         // indented code

  const endsWithHardBreak = (line: string): boolean => /(\s{2,}|\\)$/.test(line)

  for (const line of lines) {
    const fc = fenceCharOf(line)

    if (fenceChar) {
      out.push(line)
      if (fc === fenceChar) fenceChar = null // matching fence closes the block
      continue
    }
    if (fc) { fenceChar = fc; out.push(line); continue }

    const prev = out.length ? out[out.length - 1] : null
    const canMergeInto =
      prev !== null && prev.trim() !== '' && !isStructural(prev) && !endsWithHardBreak(prev)
    const isPlainProse = line.trim() !== '' && !isStructural(line)

    if (canMergeInto && isPlainProse) {
      out[out.length - 1] = prev!.replace(/\s+$/, '') + ' ' + line.replace(/^\s+/, '')
    } else {
      out.push(line)
    }
  }

  return out.join('\n')
}
