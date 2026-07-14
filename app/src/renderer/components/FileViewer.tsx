import { useState, useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { editorExtensions } from '../utils/markdownSerializer'
import { useFileWatchers } from '../hooks/useFileWatchers'
import { ExpandIcon, CompressIcon, PanelIcon, EyeIcon } from './SystemIcons'
import { displayName } from '../utils/naming'
import EditorBubbleMenu from './EditorBubbleMenu'
import EditorLinkMenu from './EditorLinkMenu'
import { SlashCommand } from './slashCommand'
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
  onRenameTitle?: (newName: string) => void
  externalPrompt?: boolean
  onReloadExternal?: () => void
  onKeepExternal?: () => void
}

export default function FileViewer({
  filePath, rootPath, readOnly, body, onBodyChange, writeStatus, onToggleProperties, propsOpen,
  hasProperties, focusMode, onToggleFocus, onRenameTitle,
  externalPrompt, onReloadExternal, onKeepExternal,
}: FileViewerProps) {
  const [lastModified, setLastModified] = useState<string>('')
  const [titleDraft, setTitleDraft] = useState('')
  const [tableMenu, setTableMenu] = useState<{ x: number; y: number } | null>(null)

  // Keep the editable title in sync with the open file.
  useEffect(() => { setTitleDraft(displayName(filePath?.split('/').pop() || '')) }, [filePath])

  // Only meaningful while editing a Draft — never on the read-only Live Version (nothing to
  // coordinate there, and it can't publish). Passing !readOnly also skips the GitHub call on Live.
  const watchers = useFileWatchers(filePath, rootPath ?? '', !readOnly)
  const [dismissedFile, setDismissedFile] = useState<string>('')
  const showWatchers = !readOnly && watchers.length > 0 && dismissedFile !== filePath

  const editor = useEditor({
    extensions: [...editorExtensions(), SlashCommand],
    editable: !readOnly,
    content: '',
    editorProps: {
      // ⌘/Ctrl-click a link to open it in the browser (plain click keeps editing).
      handleClick(view, pos, event) {
        if (!(event.metaKey || event.ctrlKey)) return false
        const href = view.state.doc.resolve(pos).marks().find(m => m.type.name === 'link')?.attrs.href as string | undefined
        if (href) { window.open(href, '_blank'); return true }
        return false
      },
    },
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

  // Right-click inside a table → open the table editing menu (targets the clicked cell).
  const handleTableContextMenu = (e: React.MouseEvent) => {
    if (!editor || readOnly) return
    if (!(e.target as HTMLElement).closest('.tiptap')) return
    const pos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY })
    if (!pos) return
    editor.commands.setTextSelection(pos.pos)
    if (editor.isActive('table')) {
      e.preventDefault()
      setTableMenu({ x: Math.min(e.clientX, window.innerWidth - 200), y: e.clientY })
    }
  }
  const tableCmd = (run: () => void) => { run(); setTableMenu(null) }

  return (
    <div className={`file-viewer ${focusMode ? 'focus' : ''}`}>
      <div className="file-viewer-content" onContextMenu={handleTableContextMenu}>
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
                  Heads up — <strong>{watchers[0].author}</strong> is also editing this file in a draft
                  that’s in review{watchers[0].title ? <> (“{watchers[0].title}”)</> : null}. Check with
                  them before you publish so your versions don’t overwrite each other.
                </>
              ) : (
                <>
                  Heads up — <strong>{watchers[0].author}</strong> and{' '}
                  <strong>{watchers.length - 1} {watchers.length - 1 === 1 ? 'other' : 'others'}</strong>{' '}
                  are also editing this file in drafts that are in review. Check with them before you
                  publish so your versions don’t overwrite each other.
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
        {!readOnly && onRenameTitle ? (
          <input
            className="file-viewer-title file-viewer-title-input"
            value={titleDraft}
            placeholder="Untitled"
            spellCheck={false}
            aria-label="File title"
            onChange={e => setTitleDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
              else if (e.key === 'Escape') { setTitleDraft(displayName(fileName)); e.currentTarget.blur() }
            }}
            onBlur={() => {
              const clean = titleDraft.trim()
              if (clean && clean !== displayName(fileName)) onRenameTitle(clean)
              else setTitleDraft(displayName(fileName))
            }}
          />
        ) : (
          <div className="file-viewer-title">{displayName(fileName)}</div>
        )}
        <div className="file-viewer-meta">
          {lastModified && <span>Last edited {lastModified}</span>}
          {readOnly && <span className="file-viewer-readonly">· Read only</span>}
          {writeStatus === 'writing' && <span className="file-viewer-saving">· Saving...</span>}
          {writeStatus === 'written' && <span className="file-viewer-saved">· Saved</span>}
        </div>
        {editor && !readOnly && <EditorBubbleMenu editor={editor} />}
        {editor && !readOnly && <EditorLinkMenu editor={editor} />}
        <EditorContent editor={editor} className="file-viewer-body" />
        {tableMenu && editor && (
          <>
            <div className="tcm-overlay" onClick={() => setTableMenu(null)} onContextMenu={e => { e.preventDefault(); setTableMenu(null) }} />
            <div className="tcm" style={{ left: tableMenu.x, top: tableMenu.y }}>
              <button className="tcm-item" onClick={() => tableCmd(() => editor.chain().focus().addColumnBefore().run())}>Insert column left</button>
              <button className="tcm-item" onClick={() => tableCmd(() => editor.chain().focus().addColumnAfter().run())}>Insert column right</button>
              <button className="tcm-item" onClick={() => tableCmd(() => editor.chain().focus().addRowBefore().run())}>Insert row above</button>
              <button className="tcm-item" onClick={() => tableCmd(() => editor.chain().focus().addRowAfter().run())}>Insert row below</button>
              <div className="tcm-sep" />
              <button className="tcm-item" onClick={() => tableCmd(() => editor.chain().focus().toggleHeaderRow().run())}>Toggle header row</button>
              <div className="tcm-sep" />
              <button className="tcm-item danger" onClick={() => tableCmd(() => editor.chain().focus().deleteColumn().run())}>Delete column</button>
              <button className="tcm-item danger" onClick={() => tableCmd(() => editor.chain().focus().deleteRow().run())}>Delete row</button>
              <button className="tcm-item danger" onClick={() => tableCmd(() => editor.chain().focus().deleteTable().run())}>Delete table</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
