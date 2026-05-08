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
import './FileViewer.css'

interface FileViewerProps {
  filePath: string | undefined
}

export default function FileViewer({ filePath }: FileViewerProps) {
  const [loading, setLoading] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const originalContent = useRef<string>('')
  const currentFilePath = useRef<string | undefined>()

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
      setIsDirty(true)
      setSaveStatus('idle')
    },
  })

  useEffect(() => {
    if (!filePath || !editor) return
    currentFilePath.current = filePath
    setLoading(true)
    setIsDirty(false)
    setSaveStatus('idle')
    window.api.fs.readFile(filePath).then(result => {
      if (result.ok && result.content !== undefined) {
        originalContent.current = result.content
        const isMarkdown = filePath.endsWith('.md') || filePath.endsWith('.mdx')
        if (isMarkdown) {
          editor.commands.setContent(markdownToHtml(result.content))
        } else {
          editor.commands.setContent(
            `<pre><code>${result.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
          )
        }
      } else {
        editor.commands.setContent(`<p>Error reading file: ${result.error}</p>`)
      }
      setLoading(false)
    })
  }, [filePath, editor])

  const handleSave = useCallback(async () => {
    if (!currentFilePath.current || !editor) return
    setSaveStatus('saving')

    // TODO: Proper HTML-to-markdown conversion. For now, save the raw text
    // for markdown files and HTML for others. A real implementation would
    // serialize the TipTap document back to markdown.
    const path = currentFilePath.current
    const isMarkdown = path.endsWith('.md') || path.endsWith('.mdx')

    let content: string
    if (isMarkdown) {
      // Save raw text for now — preserves readability even without proper md serialization
      content = editor.getText()
    } else {
      content = editor.getHTML()
    }

    const result = await window.api.fs.writeFile(path, content)
    if (result.ok) {
      setIsDirty(false)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } else {
      setSaveStatus('idle')
    }
  }, [editor])

  // Cmd+S to save
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
  const dirPath = filePath.split('/').slice(-3, -1).join(' / ')

  return (
    <div className="file-viewer">
      <div className="file-viewer-content">
        <div className="file-viewer-breadcrumb">
          <span>{dirPath}</span>
          {isDirty && <span className="file-viewer-unsaved">Unsaved changes</span>}
          {saveStatus === 'saving' && <span className="file-viewer-saving">Saving...</span>}
          {saveStatus === 'saved' && <span className="file-viewer-saved">Saved</span>}
        </div>
        <div className="file-viewer-title">{fileName}</div>
        {loading ? (
          <div style={{ color: '#B5B1AC' }}>Loading...</div>
        ) : (
          <EditorContent editor={editor} className="file-viewer-body" />
        )}
      </div>
    </div>
  )
}
