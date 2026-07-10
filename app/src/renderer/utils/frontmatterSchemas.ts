export type Widget = 'text' | 'select' | 'tags'

export interface FieldSchema {
  key: string
  label: string
  widget: Widget
  options?: string[]
}

// Playbook grades — how a live playbook's quality is rated (or its build state).
export const STATUS_OPTIONS = ['Not Yet Graded', 'A (Great)', 'B (Useful)', 'C (Not Useful)', 'F (Not Usable)', 'Future']

const SCHEMAS: Record<string, FieldSchema[]> = {
  playbook: [
    { key: 'name', label: 'Name', widget: 'text' },
    { key: 'description', label: 'Description', widget: 'text' },
    { key: 'system', label: 'System', widget: 'text' },
    { key: 'sub-system', label: 'Sub-system', widget: 'text' },
    { key: 'status', label: 'Status', widget: 'select', options: STATUS_OPTIONS },
  ],
}

export function getSchema(type: string | null): FieldSchema[] | null {
  if (!type) return null
  return SCHEMAS[type] ?? null
}

/** Determine a file's type: explicit `type` frontmatter wins, else SKILL.md under .claude/skills. */
export function detectFileType(filePath: string, data: Record<string, unknown>): string | null {
  const explicit = data?.type
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim()

  const normalized = filePath.replace(/\\/g, '/')
  if (/\/\.claude\/skills\/.*\/SKILL\.md$/.test(normalized) || /\/\.claude\/skills\/SKILL\.md$/.test(normalized)) {
    return 'playbook'
  }
  return null
}
