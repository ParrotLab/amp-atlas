import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import { Markdown } from '@tiptap/markdown'
import { JoinInPlaceBackspace, SelectionHighlight, MarkdownEscapeFix, applyMarkdownEscapeFix } from './editorKeymap'

/** Single source of truth for the editor's extension set (used by FileViewer, Review, and tests). */
export function editorExtensions() {
  return [
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
    Markdown,
    JoinInPlaceBackspace,
    SelectionHighlight,
    MarkdownEscapeFix,
  ]
}

/** Headless round-trip: markdown -> doc -> markdown. Used in tests. */
export function roundTrip(markdown: string): string {
  const editor = new Editor({
    extensions: editorExtensions(),
    content: markdown,
    contentType: 'markdown',
  })
  applyMarkdownEscapeFix(editor)   // onCreate is async; apply synchronously for the headless round-trip
  const out = editor.getMarkdown()
  editor.destroy()
  return out
}
