import { useState, useEffect } from 'react'
import { FolderIcon, ChevronRightIcon } from './SystemIcons'
import './FolderPicker.css'

interface Section { label: string; path: string }

// The app's opinionated top-level structure (mirrors the file tree's sections).
const SECTIONS: Section[] = [
  { label: 'Instructions', path: '' },        // top level
  { label: 'Playbooks', path: '.claude/skills' },
  { label: 'Readmes', path: 'readmes' },
  { label: 'Reference', path: 'reference' },
  { label: 'Work', path: 'work' },
]

interface FolderPickerProps {
  folders: string[]              // flat, system-relative folder paths (e.g. "reference/programs")
  value: string | null          // selected destination ('' = top level; null = nothing picked yet)
  onSelect: (rel: string) => void
  initialBrowse?: string         // where to open the browser (independent of selection); '' = section chooser
}

/** Drill-down folder browser: top level shows the opinionated sections, then real subfolders. */
export default function FolderPicker({ folders, value, onSelect, initialBrowse }: FolderPickerProps) {
  // null = section chooser; else a real path inside a drillable section.
  const [browse, setBrowse] = useState<string | null>(
    initialBrowse ? initialBrowse : (value && value !== '' ? value : null),
  )

  useEffect(() => {
    if (value && value !== '') setBrowse(value)
    else if (value === '') setBrowse(null)
  }, [value])

  const childrenOf = (parent: string): string[] => {
    const prefix = parent ? parent + '/' : ''
    const names = new Set<string>()
    for (const f of folders) {
      if (prefix && !f.startsWith(prefix)) continue
      const rest = prefix ? f.slice(prefix.length) : f
      if (!rest) continue
      names.add(rest.split('/')[0])
    }
    return [...names].sort((a, b) => a.localeCompare(b))
  }

  // Which section a path belongs to (longest matching base; '' only matches exactly).
  const sectionOf = (path: string): Section | undefined =>
    SECTIONS
      .filter(s => (s.path !== '' ? path === s.path || path.startsWith(s.path + '/') : path === ''))
      .sort((a, b) => b.path.length - a.path.length)[0]

  const activeSectionPath = value !== null ? (sectionOf(value)?.path ?? null) : null

  // ---------- Section chooser ----------
  if (browse === null) {
    return (
      <div className="folder-picker">
        <div className="folder-picker-list">
          {SECTIONS.map(s => (
            <button
              key={s.label}
              type="button"
              className={`fp-row ${activeSectionPath === s.path ? 'selected' : ''}`}
              onClick={() => onSelect(s.path)}
            >
              <span className="fp-row-icon"><FolderIcon size={16} /></span>
              <span className="fp-row-name">{s.label}{s.path === '' && <span className="fp-row-note"> · top level</span>}</span>
              {s.path !== '' && <span className="fp-row-chevron"><ChevronRightIcon size={15} /></span>}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ---------- Inside a section ----------
  const section = sectionOf(browse) ?? { label: browse.split('/')[0], path: browse.split('/')[0] }
  const subPath = section.path ? browse.slice(section.path.length).replace(/^\//, '') : browse
  const subsegs = subPath ? subPath.split('/') : []
  const children = childrenOf(browse)

  return (
    <div className="folder-picker">
      <div className="folder-picker-crumbs">
        <button type="button" className="fp-crumb fp-back" onClick={() => setBrowse(null)}>Locations</button>
        <span className="fp-sep">›</span>
        <button type="button" className={`fp-crumb ${value === section.path ? 'current' : ''}`} onClick={() => onSelect(section.path)}>{section.label}</button>
        {subsegs.map((seg, i) => {
          const path = `${section.path ? section.path + '/' : ''}${subsegs.slice(0, i + 1).join('/')}`
          return (
            <span key={path} className="fp-crumb-wrap">
              <span className="fp-sep">›</span>
              <button type="button" className={`fp-crumb ${value === path ? 'current' : ''}`} onClick={() => onSelect(path)}>{seg}</button>
            </span>
          )
        })}
      </div>
      <div className="folder-picker-list">
        {children.length === 0 ? (
          <div className="fp-empty">No subfolders — files land here</div>
        ) : (
          children.map(name => {
            const path = `${browse}/${name}`
            return (
              <button
                key={path}
                type="button"
                className={`fp-row ${value === path ? 'selected' : ''}`}
                onClick={() => onSelect(path)}
              >
                <span className="fp-row-icon"><FolderIcon size={16} /></span>
                <span className="fp-row-name">{name}</span>
                <span className="fp-row-chevron"><ChevronRightIcon size={15} /></span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
