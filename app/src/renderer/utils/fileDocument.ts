import yaml from 'js-yaml'

export interface FileDocument {
  data: Record<string, unknown>
  body: string
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/**
 * Split a markdown file into its YAML frontmatter (`data`) and `body`.
 * Uses js-yaml directly so it runs in the browser/renderer (no Node Buffer).
 */
export function parseDocument(raw: string): FileDocument {
  const match = raw.match(FRONTMATTER_RE)
  if (!match) return { data: {}, body: raw }
  let data: Record<string, unknown> = {}
  try {
    const loaded = yaml.load(match[1])
    if (loaded && typeof loaded === 'object') data = loaded as Record<string, unknown>
  } catch {
    // Malformed YAML: treat as no frontmatter rather than lose the file.
    return { data: {}, body: raw }
  }
  return { data, body: raw.slice(match[0].length) }
}

/** Recombine frontmatter + body. Empty data => no frontmatter fence. Unknown keys are preserved. */
export function composeDocument(data: Record<string, unknown>, body: string): string {
  const hasData = data && Object.keys(data).length > 0
  if (!hasData) {
    return body.endsWith('\n') ? body : body + '\n'
  }
  const yamlStr = yaml.dump(data, { lineWidth: -1 }).replace(/\n$/, '')
  const sep = body.startsWith('\n') ? '' : '\n'
  let out = `---\n${yamlStr}\n---\n${sep}${body}`
  if (!out.endsWith('\n')) out += '\n'
  return out
}
