import { useState, useEffect } from 'react'
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
    editable: false,
    content: '',
  })

  useEffect(() => {
    if (!filePath || !editor) return
    setLoading(true)
    window.api.fs.readFile(filePath).then(result => {
      if (result.ok && result.content !== undefined) {
        const isMarkdown = filePath.endsWith('.md') || filePath.endsWith('.mdx')
        if (isMarkdown) {
          const html = markdownToHtml(result.content)
          editor.commands.setContent(html)
        } else {
          editor.commands.setContent(`<pre><code>${result.content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`)
        }
      } else {
        editor.commands.setContent(`<p>Error reading file: ${result.error}</p>`)
      }
      setLoading(false)
    })
  }, [filePath, editor])

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
        <div className="file-viewer-breadcrumb">{dirPath}</div>
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
