import { useState, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { editorExtensions } from '../utils/markdownSerializer'
import { useFileWatchers } from '../hooks/useFileWatchers'
import { ExpandIcon, CompressIcon, PanelIcon, EyeIcon } from './SystemIcons'
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
  hasProperties?: boolean
  focusMode?: boolean
  onToggleFocus?: () => void
  externalPrompt?: boolean
  onReloadExternal?: () => void
  onKeepExternal?: () => void
}

export default function FileViewer({
  filePath, rootPath, readOnly, body, onBodyChange, writeStatus, onToggleProperties, propsOpen,
  hasProperties, focusMode, onToggleFocus,
  externalPrompt, onReloadExternal, onKeepExternal,
}: FileViewerProps) {
  const [lastModified, setLastModified] = useState<string>('')

  const watchers = useFileWatchers(filePath, rootPath ?? '')
  const [dismissedFile, setDismissedFile] = useState<string>('')
  const showWatchers = watchers.length > 0 && dismissedFile !== filePath

  const editor = useEditor({
    extensions: editorExtensions(),
    editable: !readOnly,
    content: '',
    onUpdate: ({ editor: ed }) => {
      if (readOnly) return
      onBodyChange(ed.getMarkdown())
    },
  })

  // emitUpdate:false — like setContent, setEditable emits onUpdate by default in TipTap v3,
  // which would fire onBodyChange (a spurious write) whenever the editor remounts or readOnly flips.
  useEffect(() => { editor?.setEditable(!readOnly, false) }, [readOnly, editor])

  // Sync the editor when the loaded body changes (file switch, discard, branch switch).
  // emitUpdate:false is critical — TipTap v3's setContent emits onUpdate by default, so
  // loading a file would fire onBodyChange and write a re-serialized copy to disk,
  // marking every file "modified" the moment it's opened.
  useEffect(() => {
    if (!editor) return
    const current = editor.getMarkdown()
    if (current.trim() === body.trim()) return
    editor.commands.setContent(body, { contentType: 'markdown', emitUpdate: false })
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
    <div className={`file-viewer ${focusMode ? 'focus' : ''}`}>
      <div className="file-viewer-content">
        {externalPrompt && (
          <div className="file-updated-banner">
            <span>This file was just updated.</span>
            <div className="file-updated-actions">
              <button onClick={onReloadExternal}>Reload</button>
              <button className="ghost" onClick={onKeepExternal}>Keep editing</button>
            </div>
          </div>
        )}
        {showWatchers && (
          <div className="file-watchers-banner">
            <span className="file-watchers-eye"><EyeIcon size={16} /></span>
            <span>
              {watchers.length === 1 ? (
                <>
                  <strong>{watchers[0].author}</strong> also has edits to this file in review
                  {watchers[0].title ? <> (“{watchers[0].title}”)</> : null}. Coordinate before
                  publishing so your changes don’t clash.
                </>
              ) : (
                <>
                  <strong>{watchers[0].author}</strong> and{' '}
                  <strong>{watchers.length - 1} {watchers.length - 1 === 1 ? 'other' : 'others'}</strong>{' '}
                  also have edits to this file in review. Coordinate before publishing.
                </>
              )}
            </span>
            <button className="ghost" onClick={() => setDismissedFile(filePath || '')}>Dismiss</button>
          </div>
        )}
        <div className="file-viewer-header-row">
          <div className="file-viewer-breadcrumb">
            {fullPath}
          </div>
          <div className="file-viewer-actions">
            {onToggleFocus && (
              <button
                className="file-viewer-icon-btn"
                onClick={onToggleFocus}
                title={focusMode ? 'Exit focus mode  (Esc)' : 'Focus mode'}
                aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
              >
                {focusMode ? <CompressIcon size={17} /> : <ExpandIcon size={17} />}
              </button>
            )}
            {onToggleProperties && hasProperties && (
              <button
                className={`file-viewer-icon-btn ${propsOpen ? 'active' : ''}`}
                onClick={onToggleProperties}
                title="Properties"
                aria-label="Toggle properties"
              >
                <PanelIcon size={17} />
              </button>
            )}
          </div>
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
