import { useState, useEffect, useRef } from 'react'
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
  readOnly?: boolean
  onContentLoad?: (content: string) => void
  onToggleProperties?: () => void
  propsOpen?: boolean
}

export default function FileViewer({ filePath, rootPath, readOnly, onContentLoad, onToggleProperties, propsOpen }: FileViewerProps) {
  const [loading, setLoading] = useState(false)
  const [lastModified, setLastModified] = useState<string>('')
  const [writeStatus, setWriteStatus] = useState<'idle' | 'writing' | 'written'>('idle')
  const currentFilePath = useRef<string | undefined>()
  const isLoadingContent = useRef(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>()
  const onDirtyChangeRef = useRef(onDirtyChange)
  onDirtyChangeRef.current = onDirtyChange
  const onContentLoadRef = useRef(onContentLoad)
  onContentLoadRef.current = onContentLoad

  // Write current editor content to disk
  const writeToDisk = async (editorInstance: ReturnType<typeof useEditor>) => {
    if (!currentFilePath.current || !editorInstance) return
    const path = currentFilePath.current
    const isMarkdown = path.endsWith('.md') || path.endsWith('.mdx')

    let content: string
    if (isMarkdown) {
      content = htmlToMarkdown(editorInstance.getHTML())
    } else {
      content = editorInstance.getHTML()
    }

    setWriteStatus('writing')
    const result = await window.api.fs.writeFile(path, content)
    if (result.ok) {
      setWriteStatus('written')
      setLastModified('Just now')
      onDirtyChangeRef.current?.(true) // Mark as dirty = uncommitted changes exist
      setTimeout(() => setWriteStatus('idle'), 1500)
    } else {
      setWriteStatus('idle')
    }
  }

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
    editable: !readOnly,
    content: '',
    onUpdate: ({ editor: ed }) => {
      if (isLoadingContent.current || readOnly) return

      // Debounce: write to disk after 800ms of no typing
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        writeToDisk(ed)
      }, 800)
    },
  })

  // Update editable state when readOnly changes
  useEffect(() => {
    if (editor) editor.setEditable(!readOnly)
  }, [readOnly, editor])

  // Load file content when filePath changes
  useEffect(() => {
    if (!filePath || !editor) return
    currentFilePath.current = filePath
    setLoading(true)
    setWriteStatus('idle')

    // Clear any pending writes from previous file
    if (debounceTimer.current) clearTimeout(debounceTimer.current)

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
        onContentLoadRef.current?.(result.content)
        const isMarkdown = filePath.endsWith('.md') || filePath.endsWith('.mdx')

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

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  if (!filePath) {
    return (
      <div className="file-viewer">
        <div className="file-viewer-empty">Select a file to view its contents</div>
      </div>
    )
  }

  const fileName = filePath.split('/').pop() || ''
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
          {writeStatus === 'writing' && <span className="file-viewer-saving">· Saving to disk...</span>}
          {writeStatus === 'written' && <span className="file-viewer-saved">· Saved</span>}
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
