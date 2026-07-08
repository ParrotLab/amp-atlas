import React, { useState, useEffect, useCallback } from 'react'
import TreeContextMenu, { ContextTarget } from './TreeContextMenu'
import './FileTree.css'

interface TreeNode {
  name: string
  isDirectory: boolean
  path: string
  expanded?: boolean
  depth: number
}

interface Section { key: string; label: string; nodes: TreeNode[]; isPlaybook?: boolean }

interface FileTreeProps {
  rootPath: string
  onFileSelect?: (path: string) => void
  selectedFile?: string
  gitModified?: Set<string>
  gitNew?: Set<string>
  gitDeleted?: Set<string>
  refreshToken?: number
  canEdit?: boolean
  onNeedDraft?: () => void
  onNewScaffold?: (type: 'playbook' | 'project' | 'sub-system') => void
  onNewFile?: (parentAbs: string) => void
  onNewFolder?: (parentAbs: string) => void
  onRename?: (absPath: string, isDir: boolean) => void
  onMove?: (fromAbs: string, toFolderAbs: string) => void
  onDelete?: (absPath: string, isDir: boolean) => void
}

export default function FileTree({
  rootPath, onFileSelect, selectedFile, gitModified, gitNew, gitDeleted, refreshToken,
  canEdit, onNeedDraft, onNewScaffold, onNewFile, onNewFolder, onRename, onMove, onDelete,
}: FileTreeProps) {
  const [sections, setSections] = useState<Section[]>([])
  const [expandedNodes, setExpandedNodes] = useState<Map<string, TreeNode[]>>(new Map())
  const [search, setSearch] = useState('')
  const [menu, setMenu] = useState<{ x: number; y: number; target: ContextTarget } | null>(null)
  const [showNew, setShowNew] = useState(false)

  const loadDirectory = useCallback(async (dirPath: string): Promise<TreeNode[]> => {
    const result = await window.api.fs.readDirectory(dirPath)
    if (!result.ok || !result.entries) return []
    return result.entries.map(entry => ({ ...entry, depth: 0, expanded: false }))
  }, [])

  const loadCategories = useCallback(async () => {
    const readSection = async (folderRel: string): Promise<TreeNode[]> => {
      const res = await window.api.fs.readDirectory(`${rootPath}/${folderRel}`)
      return res.ok && res.entries ? res.entries.map(e => ({ ...e, depth: 0, expanded: false })) : []
    }
    const rootRes = await window.api.fs.readDirectory(rootPath)
    const instructions = (rootRes.ok && rootRes.entries ? rootRes.entries : [])
      .filter(e => !e.isDirectory && (e.name === 'README.md' || e.name === 'CLAUDE.md'))
      .map(e => ({ ...e, depth: 0, expanded: false }))
    const skills = await readSection('.claude/skills')
    const readmes = await readSection('readmes')
    const reference = await readSection('reference')
    const work = await readSection('work')
    setSections([
      { key: 'instructions', label: 'Instructions', nodes: instructions },
      { key: 'playbooks', label: 'Playbooks', nodes: skills, isPlaybook: true },
      { key: 'readmes', label: 'Readmes', nodes: readmes },
      { key: 'reference', label: 'Reference', nodes: reference },
      { key: 'work', label: 'Work', nodes: work },
    ])
  }, [rootPath])

  // Initial load
  useEffect(() => { if (rootPath) loadCategories() }, [rootPath, loadCategories])

  // Non-destructive external refresh: re-load sections + re-fetch children of
  // currently-expanded folders, preserving which folders are open.
  useEffect(() => {
    if (!rootPath || !refreshToken) return
    loadCategories()
    setExpandedNodes(prev => {
      const paths = [...prev.keys()]
      Promise.all(paths.map(async p => [p, await loadDirectory(p)] as const)).then(pairs => {
        setExpandedNodes(cur => {
          const next = new Map(cur)
          for (const [p, children] of pairs) if (next.has(p)) next.set(p, children)
          return next
        })
      })
      return prev
    })
  }, [refreshToken, rootPath, loadCategories, loadDirectory])

  const toggleExpand = useCallback(async (node: TreeNode) => {
    if (expandedNodes.has(node.path)) {
      setExpandedNodes(prev => {
        const next = new Map(prev)
        next.delete(node.path)
        for (const key of prev.keys()) {
          if (key.startsWith(node.path + '/')) next.delete(key)
        }
        return next
      })
    } else {
      const children = await loadDirectory(node.path)
      setExpandedNodes(prev => {
        const next = new Map(prev)
        next.set(node.path, children)
        return next
      })
    }
  }, [expandedNodes, loadDirectory])

  const handleClick = useCallback((node: TreeNode) => {
    if (node.isDirectory) toggleExpand(node)
    else onFileSelect?.(node.path)
  }, [toggleExpand, onFileSelect])

  const getChangeCount = useCallback((dirRelPath: string): number => {
    let count = 0
    const prefix = dirRelPath + '/'
    gitModified?.forEach(p => { if (p.startsWith(prefix)) count++ })
    gitNew?.forEach(p => { if (p.startsWith(prefix)) count++ })
    return count
  }, [gitModified, gitNew])

  const relOf = (abs: string) => abs.replace(rootPath + '/', '')

  const openMenu = (e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault(); e.stopPropagation()
    if (!canEdit) { onNeedDraft?.(); return }
    setMenu({ x: e.clientX, y: e.clientY, target: { path: node.path, isDirectory: node.isDirectory, relPath: relOf(node.path) } })
  }

  const renderItem = (node: TreeNode, depth: number, isPlaybook?: boolean): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.path)
    const relativePath = relOf(node.path)
    const isGitModified = gitModified?.has(relativePath)
    const isGitNew = gitNew?.has(relativePath)
    const isGitDeleted = gitDeleted?.has(relativePath)
    const changeCount = node.isDirectory ? getChangeCount(relativePath) : 0

    const classes = [
      'tree-item',
      selectedFile === node.path ? 'active' : '',
      isExpanded ? 'expanded' : '',
      isGitModified ? 'git-modified' : '',
      isGitNew ? 'git-new' : '',
      isGitDeleted ? 'git-deleted' : ''
    ].filter(Boolean).join(' ')

    const matchesSearch = !search || node.name.toLowerCase().includes(search.toLowerCase())
    if (!matchesSearch && !node.isDirectory) return null

    return (
      <div key={node.path}>
        <div
          className={classes}
          style={{ paddingLeft: `${14 + depth * 16}px` }}
          onClick={() => handleClick(node)}
          onContextMenu={(e) => openMenu(e, node)}
          draggable={canEdit}
          onDragStart={(e) => { e.dataTransfer.setData('text/plain', node.path) }}
          onDragOver={(e) => { if (node.isDirectory && canEdit) e.preventDefault() }}
          onDrop={(e) => {
            if (!node.isDirectory || !canEdit) return
            e.preventDefault(); e.stopPropagation()
            const from = e.dataTransfer.getData('text/plain')
            if (from && from !== node.path) onMove?.(from, node.path)
          }}
        >
          {node.isDirectory ? (
            <span className="tree-item-icon">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M3 1.5L7 5L3 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          ) : isPlaybook ? (
            <span className="tree-item-icon" style={{ color: '#8E8B87', fontSize: '14px' }}>&#x1F4D6;</span>
          ) : (
            <span className="tree-item-icon" style={{ color: '#B5B1AC', fontSize: '14px' }}>&#x1F4C4;</span>
          )}
          <span className="tree-item-name">{node.name}</span>
          {changeCount > 0 && <span className="tree-item-change-count">{changeCount}</span>}
          {isGitModified && <span className="tree-item-git-dot modified" />}
          {isGitNew && <span className="tree-item-git-dot new" />}
          {isGitDeleted && <span className="tree-item-git-dot deleted" />}
        </div>

        {isExpanded && expandedNodes.get(node.path)?.map(child =>
          renderItem(child, depth + 1, isPlaybook)
        )}
      </div>
    )
  }

  const parentOf = (t: ContextTarget) => (t.isDirectory ? t.path : t.path.replace(/\/[^/]+$/, ''))

  return (
    <>
      <div className="file-tree-header">
        <div className="file-tree-newwrap">
          <button className="file-tree-new" onClick={() => canEdit ? setShowNew(v => !v) : onNeedDraft?.()}>+ New</button>
          {showNew && (
            <>
              <div className="tcm-overlay" onClick={() => setShowNew(false)} />
              <div className="tcm" style={{ left: 12, top: 40 }}>
                <button className="tcm-item" onClick={() => { setShowNew(false); onNewScaffold?.('playbook') }}>New Playbook</button>
                <button className="tcm-item" onClick={() => { setShowNew(false); onNewScaffold?.('project') }}>New Project</button>
                <button className="tcm-item" onClick={() => { setShowNew(false); onNewScaffold?.('sub-system') }}>New Sub-system</button>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="file-tree-search">
        <input
          type="text"
          placeholder="Search files... (Cmd+K)"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className="file-tree">
        {sections.map(sec => (
          <div key={sec.key}>
            <div className="tree-section-label">{sec.label}</div>
            {sec.nodes.length > 0
              ? sec.nodes.map(node => renderItem(node, 0, sec.isPlaybook))
              : <div className="tree-empty">Nothing here yet</div>}
          </div>
        ))}
      </div>
      {menu && (
        <TreeContextMenu
          x={menu.x} y={menu.y} target={menu.target}
          onNewFile={(t) => onNewFile?.(parentOf(t))}
          onNewFolder={(t) => onNewFolder?.(parentOf(t))}
          onRename={(t) => onRename?.(t.path, t.isDirectory)}
          onMove={(t) => onMove?.(t.path, '')}
          onCopyPath={(t) => navigator.clipboard.writeText(t.relPath)}
          onDelete={(t) => onDelete?.(t.path, t.isDirectory)}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  )
}
