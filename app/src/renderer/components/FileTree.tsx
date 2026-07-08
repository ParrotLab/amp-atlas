import { useState, useEffect, useCallback } from 'react'
import './FileTree.css'

interface TreeNode {
  name: string
  isDirectory: boolean
  path: string
  expanded?: boolean
  depth: number
}

interface FileTreeProps {
  rootPath: string
  onFileSelect?: (path: string) => void
  selectedFile?: string
  gitModified?: Set<string>
  gitNew?: Set<string>
  gitDeleted?: Set<string>
  refreshToken?: number
}

interface CategorizedTree {
  instructions: TreeNode[]
  playbooks: TreeNode[]
  files: TreeNode[]
}

export default function FileTree({ rootPath, onFileSelect, selectedFile, gitModified, gitNew, gitDeleted, refreshToken }: FileTreeProps) {
  const [categories, setCategories] = useState<CategorizedTree>({ instructions: [], playbooks: [], files: [] })
  const [expandedNodes, setExpandedNodes] = useState<Map<string, TreeNode[]>>(new Map())
  const [search, setSearch] = useState('')

  const loadDirectory = useCallback(async (dirPath: string): Promise<TreeNode[]> => {
    const result = await window.api.fs.readDirectory(dirPath)
    if (!result.ok || !result.entries) return []
    return result.entries.map(entry => ({ ...entry, depth: 0, expanded: false }))
  }, [])

  const loadCategories = useCallback(async () => {
    const rootEntries = await loadDirectory(rootPath)

    const instructions: TreeNode[] = []
    const files: TreeNode[] = []
    let playbooks: TreeNode[] = []

    for (const entry of rootEntries) {
      if (!entry.isDirectory) instructions.push(entry)
      else if (entry.name === '.claude') continue
      else files.push(entry)
    }

    const skillsResult = await window.api.fs.readDirectory(`${rootPath}/.claude/skills`)
    if (skillsResult.ok && skillsResult.entries) {
      playbooks = skillsResult.entries
        .filter(e => e.isDirectory)
        .map(entry => ({ ...entry, depth: 0, expanded: false }))
    }

    setCategories({ instructions, playbooks, files })
  }, [rootPath, loadDirectory])

  // Initial load
  useEffect(() => { if (rootPath) loadCategories() }, [rootPath, loadCategories])

  // Non-destructive external refresh: re-load categories + re-fetch children of
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
      // Collapse
      setExpandedNodes(prev => {
        const next = new Map(prev)
        next.delete(node.path)
        // Also remove any children that were expanded
        for (const key of prev.keys()) {
          if (key.startsWith(node.path + '/')) next.delete(key)
        }
        return next
      })
    } else {
      // Expand
      const children = await loadDirectory(node.path)
      setExpandedNodes(prev => {
        const next = new Map(prev)
        next.set(node.path, children)
        return next
      })
    }
  }, [expandedNodes, loadDirectory])

  const handleClick = useCallback((node: TreeNode) => {
    if (node.isDirectory) {
      toggleExpand(node)
    } else {
      onFileSelect?.(node.path)
    }
  }, [toggleExpand, onFileSelect])

  // Count git changes in a directory
  const getChangeCount = useCallback((dirRelPath: string): number => {
    let count = 0
    const prefix = dirRelPath + '/'
    gitModified?.forEach(p => { if (p.startsWith(prefix)) count++ })
    gitNew?.forEach(p => { if (p.startsWith(prefix)) count++ })
    return count
  }, [gitModified, gitNew])

  // Render a tree item
  const renderItem = (node: TreeNode, depth: number, isPlaybook?: boolean) => {
    const isExpanded = expandedNodes.has(node.path)
    const relativePath = node.path.replace(rootPath + '/', '')
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

  const hasPlaybooks = categories.playbooks.length > 0
  const hasInstructions = categories.instructions.length > 0
  const hasFiles = categories.files.length > 0

  return (
    <>
      <div className="file-tree-search">
        <input
          type="text"
          placeholder="Search files... (Cmd+K)"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className="file-tree">
        {hasInstructions && (
          <>
            <div className="tree-section-label">Instructions</div>
            {categories.instructions.map(node => renderItem(node, 0))}
          </>
        )}

        {hasPlaybooks && (
          <>
            <div className="tree-section-label">Playbooks</div>
            {categories.playbooks.map(node => renderItem(node, 0, true))}
          </>
        )}

        {hasFiles && (
          <>
            <div className="tree-section-label">Files</div>
            {categories.files.map(node => renderItem(node, 0))}
          </>
        )}

        {!hasInstructions && !hasPlaybooks && !hasFiles && (
          <div style={{ padding: '18px', fontSize: '13px', color: '#B5B1AC', textAlign: 'center' }}>
            {search ? 'No matches' : 'No files found'}
          </div>
        )}
      </div>
    </>
  )
}
