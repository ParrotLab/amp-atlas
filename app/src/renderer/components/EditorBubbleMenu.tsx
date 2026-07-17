import { useState, ReactNode } from 'react'
import { BubbleMenu } from '@tiptap/react/menus'
import { Editor } from '@tiptap/core'
import { CodeIcon, IndentIcon, LinkIcon, ListBulletIcon, ListOrderedIcon, OutdentIcon, QuoteIcon, TextIcon } from './SystemIcons'
import './EditorBubbleMenu.css'

/** Floating format toolbar shown on text selection (Medium/Notion-style). */
export default function EditorBubbleMenu({ editor }: { editor: Editor }) {
  const [linkMode, setLinkMode] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  const openLink = () => {
    setLinkUrl((editor.getAttributes('link').href as string) || '')
    setLinkMode(true)
  }
  const applyLink = () => {
    const url = linkUrl.trim()
    const chain = editor.chain().focus().extendMarkRange('link')
    if (url) chain.setLink({ href: url }).run()
    else chain.unsetLink().run()
    setLinkMode(false)
  }
  const removeLink = () => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); setLinkMode(false) }

  // Indent / un-indent for list items — works for bullet, numbered, and checklists.
  // sink/liftListItem take the item node's name, which differs for task lists.
  const inList = editor.isActive('bulletList') || editor.isActive('orderedList') || editor.isActive('taskList')
  const listItemType = editor.isActive('taskItem') ? 'taskItem' : 'listItem'
  const indent = () => editor.chain().focus().sinkListItem(listItemType).run()
  const outdent = () => editor.chain().focus().liftListItem(listItemType).run()

  // onMouseDown + preventDefault keeps the text selection alive when clicking a button.
  const btn = (active: boolean, onClick: () => void, title: string, content: ReactNode) => (
    <button
      className={`bm-btn ${active ? 'active' : ''}`.trim()}
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick() }}
    >
      {content}
    </button>
  )

  return (
    <BubbleMenu
      editor={editor}
      className="bubble-menu"
      shouldShow={({ editor }) => editor.isEditable && !editor.state.selection.empty}
      options={{ placement: 'top', offset: 8 }}
    >
      {linkMode ? (
        <div className="bm-link">
          <input
            autoFocus
            className="bm-link-input"
            placeholder="Paste or type a link…"
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); applyLink() }
              else if (e.key === 'Escape') { e.preventDefault(); setLinkMode(false) }
            }}
          />
          <button className="bm-btn" title="Apply link" onMouseDown={e => { e.preventDefault(); applyLink() }}>↵</button>
          {editor.isActive('link') && (
            <button className="bm-btn" title="Remove link" onMouseDown={e => { e.preventDefault(); removeLink() }}>✕</button>
          )}
        </div>
      ) : (
        <>
          {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Bold', <b>B</b>)}
          {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Italic', <i>I</i>)}
          {btn(editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), 'Strikethrough', <s>S</s>)}
          {btn(editor.isActive('code'), () => editor.chain().focus().toggleCode().run(), 'Inline code', <CodeIcon size={15} />)}
          {btn(editor.isActive('link'), openLink, 'Link', <LinkIcon size={15} />)}
          <span className="bm-sep" />
          {btn(editor.isActive('paragraph'), () => editor.chain().focus().setParagraph().run(), 'Text', <TextIcon size={16} />)}
          {btn(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), 'Heading 1', <span className="bm-h">H1</span>)}
          {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'Heading 2', <span className="bm-h">H2</span>)}
          {btn(editor.isActive('heading', { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), 'Heading 3', <span className="bm-h">H3</span>)}
          <span className="bm-sep" />
          {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Bullet list', <ListBulletIcon size={15} />)}
          {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Numbered list', <ListOrderedIcon size={15} />)}
          {btn(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), 'Quote', <QuoteIcon size={15} />)}
          {inList && (
            <>
              <span className="bm-sep" />
              {btn(false, outdent, 'Un-indent  (Shift+Tab)', <OutdentIcon size={15} />)}
              {btn(false, indent, 'Indent  (Tab)', <IndentIcon size={15} />)}
            </>
          )}
        </>
      )}
    </BubbleMenu>
  )
}
