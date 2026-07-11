import { Extension, Editor } from '@tiptap/core'
import { Suggestion } from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import SlashMenu, { SlashMenuRef } from './SlashMenu'
import {
  ListBulletIcon, ListOrderedIcon, CheckSquareIcon, QuoteIcon, CodeIcon, DividerIcon, TableIcon,
} from './SystemIcons'

type Range = { from: number; to: number }

export interface SlashItem {
  title: string
  keywords: string[]
  icon: React.ReactNode
  run: (opts: { editor: Editor; range: Range }) => void
}

const heading = (label: string) => <span className="slash-h">{label}</span>

export const SLASH_ITEMS: SlashItem[] = [
  { title: 'Heading 1', keywords: ['h1', 'title', 'heading', 'big'], icon: heading('H1'), run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run() },
  { title: 'Heading 2', keywords: ['h2', 'heading', 'subtitle'], icon: heading('H2'), run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run() },
  { title: 'Heading 3', keywords: ['h3', 'heading'], icon: heading('H3'), run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run() },
  { title: 'Bullet list', keywords: ['bullet', 'unordered', 'list', 'ul'], icon: <ListBulletIcon size={17} />, run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run() },
  { title: 'Numbered list', keywords: ['numbered', 'ordered', 'list', 'ol'], icon: <ListOrderedIcon size={17} />, run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run() },
  { title: 'Checklist', keywords: ['todo', 'task', 'check', 'checkbox'], icon: <CheckSquareIcon size={17} />, run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run() },
  { title: 'Quote', keywords: ['quote', 'blockquote', 'callout'], icon: <QuoteIcon size={17} />, run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run() },
  { title: 'Code block', keywords: ['code', 'snippet', 'fence'], icon: <CodeIcon size={17} />, run: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run() },
  { title: 'Table', keywords: ['table', 'grid'], icon: <TableIcon size={17} />, run: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { title: 'Divider', keywords: ['divider', 'rule', 'hr', 'separator', 'line'], icon: <DividerIcon size={17} />, run: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run() },
]

/** Notion-style "/" menu to insert blocks. Only added to the editable FileViewer editor. */
export const SlashCommand = Extension.create({
  name: 'slashCommand',
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        char: '/',
        allowSpaces: false,
        command: ({ editor, range, props }) => props.run({ editor, range }),
        items: ({ query }) => {
          const q = query.toLowerCase()
          return SLASH_ITEMS.filter(
            i => i.title.toLowerCase().includes(q) || i.keywords.some(k => k.includes(q)),
          ).slice(0, 10)
        },
        render: () => {
          let component: ReactRenderer<SlashMenuRef> | null = null
          let el: HTMLElement | null = null
          const place = (clientRect?: (() => DOMRect | null) | null) => {
            if (!el || !clientRect) return
            const rect = clientRect()
            if (!rect) return
            const gap = 6
            const pad = 8
            const menuH = el.offsetHeight
            const menuW = el.offsetWidth
            el.style.position = 'fixed'
            el.style.left = `${Math.max(pad, Math.min(rect.left, window.innerWidth - menuW - pad))}px`
            // Flip above the caret when it would overflow the bottom (Notion-style).
            const belowOverflows = rect.bottom + gap + menuH > window.innerHeight - pad
            const roomAbove = rect.top - gap - menuH > pad
            el.style.top = belowOverflows && roomAbove
              ? `${rect.top - gap - menuH}px`
              : `${rect.bottom + gap}px`
          }
          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashMenu, { props, editor: props.editor })
              el = component.element as HTMLElement
              el.style.zIndex = '2000'
              document.body.appendChild(el)
              requestAnimationFrame(() => place(props.clientRect))
            },
            onUpdate: (props) => { component?.updateProps(props); requestAnimationFrame(() => place(props.clientRect)) },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') return false
              return component?.ref?.onKeyDown(props) ?? false
            },
            onExit: () => { el?.remove(); component?.destroy(); el = null; component = null },
          }
        },
      }),
    ]
  },
})
