import { useState, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { editorExtensions } from '../utils/markdownSerializer'
import './FileViewer.css'

interface FileViewerProps {
  filePath: string | undefined
  rootPath?: string
  readOnly?: boolean
  body: string
  onBodyChange: (markdown: string) => void
  writeStatus: 'idle' | 'writing' | 'written'
  onToggleProperties?: () => void
  propsOpen?: boolean
}

export default function FileViewer({
  filePath, rootPath, readOnly, body, onBodyChange, writeStatus, onToggleProperties, propsOpen,
}: FileViewerProps) {
  const [lastModified, setLastModified] = useState<string>('')

  const editor = useEditor({
    extensions: editorExtensions(),
    editable: !readOnly,
    content: '',
    onUpdate: ({ editor: ed }) => {
      if (readOnly) return
      onBodyChange(ed.getMarkdown())
    },
  })

  useEffect(() => { editor?.setEditable(!readOnly) }, [readOnly, editor])

  // Sync the editor when the loaded body changes (file switch, discard, branch switch).
  useEffect(() => {
    if (!editor) return
    const current = editor.getMarkdown()
    if (current.trim() === body.trim()) return
    editor.commands.setContent(body, { contentType: 'markdown' })
  }, [body, editor])

  // Display-only: show "Last edited" from file metadata (does not read content).
  useEffect(() => {
    if (!filePath) { setLastModified(''); return }
    window.api.fs.stat(filePath).then(statResult => {
      if (statResult.ok && statResult.stats) {
        const date = new Date(statResult.stats.modified)
        const now = new Date()
        const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000)
        const diffHours = Math.floor(diffMins / 60)
        const diffDays = Math.floor(diffHours / 24)
        if (diffMins < 1) setLastModified('Just now')
        else if (diffMins < 60) setLastModified(`${diffMins} min ago`)
        else if (diffHours < 24) setLastModified(`${diffHours}h ago`)
        else if (diffDays < 7) setLastModified(`${diffDays}d ago`)
        else setLastModified(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }))
      }
    })
  }, [filePath, writeStatus])

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
          {readOnly && <span className="file-viewer-readonly">· Read only</span>}
          {writeStatus === 'writing' && <span className="file-viewer-saving">· Saving...</span>}
          {writeStatus === 'written' && <span className="file-viewer-saved">· Saved</span>}
        </div>
        <EditorContent editor={editor} className="file-viewer-body" />
      </div>
    </div>
  )
}
