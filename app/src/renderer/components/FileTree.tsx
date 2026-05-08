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
      // Collapse: remove all children deeper than this node
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
      // Expand: load children first, then update state once
      const children = await loadDirectory(node.path, node.depth + 1)
      setNodes(prev => {
        const idx = prev.findIndex(n => n.path === node.path)
        if (idx === -1) return prev
        // Check if already expanded (double-click guard)
        if (prev[idx].expanded) return prev
        const updated = [...prev]
        updated[idx] = { ...node, expanded: true }
        updated.splice(idx + 1, 0, ...children)
        return updated
      })
    }
  }

  return (
    <div className="file-tree">
      {nodes.map((node) => (
        <div
          key={node.path}
          className={`tree-item ${selectedFile === node.path ? 'active' : ''}`}
          style={{ paddingLeft: `${18 + node.depth * 16}px` }}
          onClick={() => handleClick(node)}
        >
          <span className="tree-item-icon">
            {node.isDirectory ? (node.expanded ? '▾' : '▸') : '📄'}
          </span>
          <span className="tree-item-name">{node.name}</span>
        </div>
      ))}
      {nodes.length === 0 && (
        <div style={{ padding: '18px', fontSize: '13px', color: '#B5B1AC' }}>
          No files found
        </div>
      )}
    </div>
  )
}
