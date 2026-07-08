import { TEMPLATES } from './templates'

export type ScaffoldType = 'playbook' | 'project' | 'sub-system'
export const CANONICAL_FOLDERS = ['readmes', 'reference', 'work', '.claude']

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function render(tpl: string, name: string, date: string): string {
  return tpl.split('{{name}}').join(name).split('{{date}}').join(date)
}

export interface ScaffoldFile { path: string; content: string }

/** Map a scaffold type + name to system-relative files with rendered content. */
export function scaffoldFor(type: ScaffoldType, name: string, date: string): { folder: string; files: ScaffoldFile[] } {
  const slug = slugify(name)
  if (type === 'playbook') {
    const folder = `.claude/skills/${slug}`
    return { folder, files: [{ path: `${folder}/SKILL.md`, content: render(TEMPLATES.playbookSkill, name, date) }] }
  }
  if (type === 'project') {
    const folder = `work/${slug}`
    return {
      folder,
      files: [
        { path: `${folder}/pitch.md`, content: render(TEMPLATES.projectPitch, name, date) },
        { path: `${folder}/braindump.md`, content: render(TEMPLATES.projectBraindump, name, date) },
      ],
    }
  }
  const folder = `reference/${slug}`
  return { folder, files: [{ path: `${folder}/README.md`, content: render(TEMPLATES.subsystemReadme, name, date) }] }
}

/** True if a system-relative path IS one of the protected top-level folders. */
export function isProtectedPath(relPath: string): boolean {
  return CANONICAL_FOLDERS.includes(relPath.replace(/^\/+|\/+$/g, ''))
}
