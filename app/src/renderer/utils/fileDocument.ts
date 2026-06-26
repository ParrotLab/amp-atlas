import matter from 'gray-matter'

export interface FileDocument {
  data: Record<string, unknown>
  body: string
}

export function parseDocument(raw: string): FileDocument {
  const parsed = matter(raw)
  return { data: { ...parsed.data }, body: parsed.content }
}

/** Recombine frontmatter + body. Empty data => no frontmatter fence. */
export function composeDocument(data: Record<string, unknown>, body: string): string {
  const hasData = data && Object.keys(data).length > 0
  if (!hasData) {
    return body.endsWith('\n') ? body : body + '\n'
  }
  // matter.stringify writes the fence + a trailing newline after body.
  return matter.stringify(body, data)
}
