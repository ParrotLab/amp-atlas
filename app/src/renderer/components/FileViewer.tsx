import { useState, useEffect, useCallback, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table'
import { TableHeader } from '@tiptap/extension-table'
import { markdownToHtml } from '../utils/markdown'
import { htmlToMarkdown } from '../utils/htmlToMarkdown'
import './FileViewer.css'

interface FileViewerProps {
  filePath: string | undefined
  rootPath?: string
  onDirtyChange?: (dirty: boolean) => void
  onContentLoad?: (content: string) => void
  onToggleProperties?: () => void
  propsOpen?: boolean
}

export default function FileViewer({ filePath, rootPath, onDirtyChange, onContentLoad, onToggleProperties, propsOpen }: FileViewerProps) {
  const [loading, setLoading] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [lastModified, setLastModified] = useState<string>('')
  const originalContent = useRef<string>('')
  const currentFilePath = useRef<string | undefined>()
  const isLoadingContent = useRef(false)
  const onDirtyChangeRef = useRef(onDirtyChange)
  onDirtyChangeRef.current = onDirtyChange
  const onContentLoadRef = useRef(onContentLoad)
  onContentLoadRef.current = onContentLoad

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        link: { openOnClick: false },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    editable: true,
    content: '',
    onUpdate: () => {
      // Don't mark dirty during programmatic content loads
      if (isLoadingContent.current) return
      setIsDirty(true)
      setSaveStatus('idle')
      onDirtyChangeRef.current?.(true)
    },
  })

  useEffect(() => {
    if (!filePath || !editor) return
    currentFilePath.current = filePath
    setLoading(true)
    setIsDirty(false)
    onDirtyChangeRef.current?.(false)
    setSaveStatus('idle')

    // Get file stat for last modified time
    window.api.fs.stat(filePath).then(statResult => {
      if (statResult.ok && statResult.stats) {
        const date = new Date(statResult.stats.modified)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) setLastModified('Just now')
        else if (diffMins < 60) setLastModified(`${diffMins} min ago`)
        else if (diffHours < 24) setLastModified(`${diffHours}h ago`)
        else if (diffDays < 7) setLastModified(`${diffDays}d ago`)
        else setLastModified(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))
      }
    })

    window.api.fs.readFile(filePath).then(result => {
      if (result.ok && result.content !== undefined) {
        originalContent.current = result.content
        onContentLoadRef.current?.(result.content)
        const isMarkdown = filePath.endsWith('.md') || filePath.endsWith('.mdx')

        // Prevent onUpdate from firing isDirty during setContent
        isLoadingContent.current = true
        if (isMarkdown) {
          let markdownContent = result.content
          const fmMatch = markdownContent.match(/^---\n[\s\S]*?\n---\n?/)
          if (fmMatch) {
            markdownContent = markdownContent.substring(fmMatch[0].length)
          }
          editor.commands.setContent(markdownToHtml(markdownContent))
        } else {
          editor.commands.setContent(
            `<pre><code>${result.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
          )
        }
        // Re-enable dirty tracking after a tick
        requestAnimationFrame(() => {
          isLoadingContent.current = false
        })
      } else {
        editor.commands.setContent(`<p>Error reading file: ${result.error}</p>`)
        onContentLoadRef.current?.('')
      }
      setLoading(false)
    })
  }, [filePath, editor])

  const handleSave = useCallback(async () => {
    if (!currentFilePath.current || !editor) return
    setSaveStatus('saving')

    const path = currentFilePath.current
    const isMarkdown = path.endsWith('.md') || path.endsWith('.mdx')

    let content: string
    if (isMarkdown) {
      content = htmlToMarkdown(editor.getHTML())
    } else {
      content = editor.getHTML()
    }

    const result = await window.api.fs.writeFile(path, content)
    if (result.ok) {
      setIsDirty(false)
      onDirtyChangeRef.current?.(false)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } else {
      setSaveStatus('idle')
    }
  }, [editor])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  if (!filePath) {
    return (
      <div className="file-viewer">
        <div className="file-viewer-empty">Select a file to view its contents</div>
      </div>
    )
  }

  const fileName = filePath.split('/').pop() || ''
  // Build full relative path from root
  const fullPath = rootPath
    ? filePath.replace(rootPath + '/', '').split('/').join(' / ')
    : filePath.split('/').slice(-4).join(' / ')

  return (
    <div className="file-viewer">
      <div className="file-viewer-content">
        <div className="file-viewer-header-row">
          <div className="file-viewer-breadcrumb">
            {fullPath}
          </div>
          {onToggleProperties && (
            <button
              className={`file-viewer-props-btn ${propsOpen ? 'active' : ''}`}
              onClick={onToggleProperties}
              title="Properties"
            >
              ☰
            </button>
          )}
        </div>
        <div className="file-viewer-title">{fileName}</div>
        <div className="file-viewer-meta">
          {lastModified && <span>Last edited {lastModified}</span>}
          {isDirty && <span className="file-viewer-unsaved">· Unsaved changes</span>}
          {saveStatus === 'saving' && <span className="file-viewer-saving">· Saving...</span>}
          {saveStatus === 'saved' && <span className="file-viewer-saved">· Saved</span>}
        </div>
        {loading ? (
          <div style={{ color: '#B5B1AC' }}>Loading...</div>
        ) : (
          <EditorContent editor={editor} className="file-viewer-body" />
        )}
      </div>
    </div>
  )
}
