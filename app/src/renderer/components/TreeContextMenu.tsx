import { useEffect } from 'react'
import './TreeContextMenu.css'

export interface ContextTarget { path: string; isDirectory: boolean; relPath: string }

interface TreeContextMenuProps {
  x: number
  y: number
  target: ContextTarget
  onNewFile: (t: ContextTarget) => void
  onNewFolder: (t: ContextTarget) => void
  onRename: (t: ContextTarget) => void
  onMove: (t: ContextTarget) => void
  onCopyPath: (t: ContextTarget) => void
  onDelete: (t: ContextTarget) => void
  onClose: () => void
}

export default function TreeContextMenu(p: TreeContextMenuProps) {
  useEffect(() => {
    const h = () => p.onClose()
    window.addEventListener('click', h)
    return () => window.removeEventListener('click', h)
  }, [p])

  const item = (label: string, fn: () => void, danger = false) => (
    <button className={`tcm-item ${danger ? 'danger' : ''}`} onClick={(e) => { e.stopPropagation(); fn(); p.onClose() }}>{label}</button>
  )

  return (
    <div className="tcm" style={{ left: p.x, top: p.y }} onClick={e => e.stopPropagation()}>
      {p.target.isDirectory && item('New file here', () => p.onNewFile(p.target))}
      {p.target.isDirectory && item('New folder here', () => p.onNewFolder(p.target))}
      {item('Rename', () => p.onRename(p.target))}
      {item('Move to…', () => p.onMove(p.target))}
      {item('Copy path', () => p.onCopyPath(p.target))}
      {item('Delete', () => p.onDelete(p.target), true)}
    </div>
  )
}
