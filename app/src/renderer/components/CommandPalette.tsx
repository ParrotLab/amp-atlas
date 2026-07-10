import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { SearchIcon, DocIcon } from './SystemIcons'
import './CommandPalette.css'

interface CommandPaletteProps {
  isOpen: boolean
  rootPath: string
  onClose: () => void
  onSelect: (absPath: string) => void
}

interface Match {
  rel: string
  name: string
  dir: string
  score: number
}

/** Subsequence fuzzy match. Returns a score (higher = better) or -1 for no match. */
function fuzzyScore(query: string, target: string): number {
  if (!query) return 0
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  let qi = 0
  let score = 0
  let streak = 0
  let prevIdx = -1
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      streak = prevIdx === ti - 1 ? streak + 1 : 0
      score += 1 + streak * 2                       // reward consecutive runs
      if (ti === 0 || '/-_ .'.includes(t[ti - 1])) score += 4  // reward word-boundary hits
      prevIdx = ti
      qi++
    }
  }
  return qi === q.length ? score : -1
}

export default function CommandPalette({ isOpen, rootPath, onClose, onSelect }: CommandPaletteProps) {
  const [files, setFiles] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Load the file list fresh each time the palette opens.
  useEffect(() => {
    if (!isOpen || !rootPath) return
    setQuery('')
    setActive(0)
    // Guard: listFiles is a newer preload API — if the bundle is stale it may be
    // missing. Never let that throw and blank the whole app.
    const listFiles = window.api?.fs?.listFiles
    if (typeof listFiles === 'function') {
      listFiles(rootPath).then(r => { if (r.ok) setFiles(r.files) }).catch(() => setFiles([]))
    } else {
      setFiles([])
      console.warn('[CommandPalette] window.api.fs.listFiles unavailable — restart the app to load the new preload API.')
    }
    // Focus after paint so the caret lands in the input.
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [isOpen, rootPath])

  const results = useMemo<Match[]>(() => {
    const scored: Match[] = []
    for (const rel of files) {
      const s = fuzzyScore(query, rel)
      if (s < 0) continue
      const slash = rel.lastIndexOf('/')
      const name = slash >= 0 ? rel.slice(slash + 1) : rel
      const dir = slash >= 0 ? rel.slice(0, slash) : ''
      // A hit in the filename beats a hit only in the folder path.
      const nameBonus = fuzzyScore(query, name) >= 0 ? 20 : 0
      scored.push({ rel, name, dir, score: s + nameBonus })
    }
    scored.sort((a, b) => b.score - a.score || a.rel.localeCompare(b.rel))
    return scored.slice(0, 50)
  }, [files, query])

  useEffect(() => { setActive(0) }, [query])

  const choose = useCallback((m: Match | undefined) => {
    if (!m) return
    onSelect(`${rootPath}/${m.rel}`)
    onClose()
  }, [onSelect, onClose, rootPath])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  // Keep the active row scrolled into view.
  useEffect(() => {
    if (!isOpen) return
    listRef.current?.querySelector<HTMLElement>('.cmdk-item.active')?.scrollIntoView({ block: 'nearest' })
  }, [active, isOpen])

  if (!isOpen) return null

  return (
    <div className="cmdk-overlay" onClick={onClose}>
      <div className="cmdk" onClick={e => e.stopPropagation()} role="dialog" aria-label="Search files">
        <div className="cmdk-input-row">
          <span className="cmdk-input-icon"><SearchIcon size={18} /></span>
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="Search files by name…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
          />
          <kbd className="cmdk-esc">esc</kbd>
        </div>
        <div className="cmdk-list" ref={listRef}>
          {results.length === 0 ? (
            <div className="cmdk-empty">{query ? 'No files match' : 'No files found'}</div>
          ) : (
            results.map((m, i) => (
              <button
                key={m.rel}
                className={`cmdk-item ${i === active ? 'active' : ''}`}
                onMouseMove={() => setActive(i)}
                onClick={() => choose(m)}
              >
                <span className="cmdk-item-icon"><DocIcon size={16} /></span>
                <span className="cmdk-item-name">{m.name}</span>
                {m.dir && <span className="cmdk-item-dir">{m.dir.split('/').join(' / ')}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
