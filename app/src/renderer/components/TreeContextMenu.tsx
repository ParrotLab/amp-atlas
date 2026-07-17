import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './TreeContextMenu.css'

export interface ContextTarget { path: string; isDirectory: boolean; relPath: string }

interface TreeContextMenuProps {
  x: number
  y: number
  target: ContextTarget
  canEdit?: boolean   // read-only (Live Version) → only Copy path is offered
  onNewFile: (t: ContextTarget) => void
  onNewFolder: (t: ContextTarget) => void
  onRename: (t: ContextTarget) => void
  onMove: (t: ContextTarget) => void
  onCopyPath: (t: ContextTarget) => void
  onDelete: (t: ContextTarget) => void
  onClose: () => void
}

export default function TreeContextMenu(p: TreeContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: p.x, top: p.y })

  // Flip the menu up/left when it would overflow the viewport (measured before paint, no flicker).
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const margin = 8
    let left = p.x
    let top = p.y
    if (top + height > window.innerHeight - margin) top = Math.max(margin, p.y - height)
    if (left + width > window.innerWidth - margin) left = Math.max(margin, p.x - width)
    setPos({ left, top })
  }, [p.x, p.y])

  useEffect(() => {
    const h = () => p.onClose()
    window.addEventListener('click', h)
    return () => window.removeEventListener('click', h)
  }, [p])

  const item = (label: string, fn: () => void, danger = false) => (
    <button className={`tcm-item ${danger ? 'danger' : ''}`} onClick={(e) => { e.stopPropagation(); fn(); p.onClose() }}>{label}</button>
  )

  const canEdit = p.canEdit ?? true
  return (
    <div ref={ref} className="tcm" style={{ left: pos.left, top: pos.top }} onClick={e => e.stopPropagation()}>
      {canEdit && p.target.isDirectory && item('New file here', () => p.onNewFile(p.target))}
      {canEdit && p.target.isDirectory && item('New folder here', () => p.onNewFolder(p.target))}
      {canEdit && item('Rename', () => p.onRename(p.target))}
      {canEdit && item('Move to…', () => p.onMove(p.target))}
      {item('Copy path', () => p.onCopyPath(p.target))}
      {canEdit && item('Delete', () => p.onDelete(p.target), true)}
    </div>
  )
}
