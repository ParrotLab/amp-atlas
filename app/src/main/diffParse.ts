export type DiffLine = { type: 'added' | 'removed' | 'context' | 'header'; content: string }

/** Parse a unified diff patch (as returned by the REST files endpoint) into typed lines. */
export function parsePatch(patch: string | undefined): DiffLine[] {
  if (!patch) return []
  const lines: DiffLine[] = []
  for (const line of patch.split('\n')) {
    if (line.startsWith('@@')) lines.push({ type: 'header', content: line })
    else if (line.startsWith('+') && !line.startsWith('+++')) lines.push({ type: 'added', content: line.substring(1) })
    else if (line.startsWith('-') && !line.startsWith('---')) lines.push({ type: 'removed', content: line.substring(1) })
    else if (!line.startsWith('diff ') && !line.startsWith('index ') && !line.startsWith('---') && !line.startsWith('+++')) {
      if (line.length > 0) lines.push({ type: 'context', content: line.startsWith(' ') ? line.substring(1) : line })
    }
  }
  return lines
}
