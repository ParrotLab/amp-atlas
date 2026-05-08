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
}

export default function FileTree({ rootPath, onFileSelect, selectedFile }: FileTreeProps) {
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [search, setSearch] = useState('')

  const loadDirectory = useCallback(async (dirPath: string, depth: number): Promise<TreeNode[]> => {
    const result = await window.api.fs.readDirectory(dirPath)
    if (!result.ok || !result.entries) return []
    return result.entries.map(entry => ({ ...entry, depth, expanded: false }))
  }, [])

  useEffect(() => {
    if (rootPath) loadDirectory(rootPath, 0).then(setNodes)
  }, [rootPath, loadDirectory])

  const handleClick = async (node: TreeNode) => {
    if (!node.isDirectory) {
      onFileSelect?.(node.path)
      return
    }

    if (node.expanded) {
      setNodes(prev => {
        const idx = prev.findIndex(n => n.path === node.path)
        if (idx === -1) return prev
        const updated = [...prev]
        updated[idx] = { ...node, expanded: false }
        let removeCount = 0
        for (let i = idx + 1; i < updated.length; i++) {
          if (updated[i].depth > node.depth) removeCount++
          else break
        }
        updated.splice(idx + 1, removeCount)
        return updated
      })
    } else {
      const children = await loadDirectory(node.path, node.depth + 1)
      setNodes(prev => {
        const idx = prev.findIndex(n => n.path === node.path)
        if (idx === -1) return prev
        if (prev[idx].expanded) return prev
        const updated = [...prev]
        updated[idx] = { ...node, expanded: true }
        updated.splice(idx + 1, 0, ...children)
        return updated
      })
    }
  }

  const filteredNodes = search
    ? nodes.filter(n => n.name.toLowerCase().includes(search.toLowerCase()))
    : nodes

  return (
    <>
      <div className="file-tree-search">
        <input
          type="text"
          placeholder="Search files..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className="file-tree">
        {filteredNodes.map((node) => {
          const isTopLevel = node.depth === 0
          const isExpanded = node.expanded
          const classes = [
            'tree-item',
            selectedFile === node.path ? 'active' : '',
            isTopLevel && node.isDirectory ? 'top-level' : '',
            isExpanded ? 'expanded' : ''
          ].filter(Boolean).join(' ')

          return (
            <div
              key={node.path}
              className={classes}
              style={{ paddingLeft: `${14 + node.depth * 16}px` }}
              onClick={() => handleClick(node)}
            >
              {node.isDirectory ? (
                <span className="tree-item-icon">›</span>
              ) : (
                <span className="tree-item-icon" style={{ opacity: 0.35, fontSize: '13px' }}>📄</span>
              )}
              <span className="tree-item-name">{node.name}</span>
            </div>
          )
        })}
        {filteredNodes.length === 0 && (
          <div style={{ padding: '18px', fontSize: '13px', color: '#B5B1AC', textAlign: 'center' }}>
            {search ? 'No matches' : 'No files found'}
          </div>
        )}
      </div>
    </>
  )
}
