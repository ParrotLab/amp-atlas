import { useState, useEffect } from 'react'
import { BubbleMenu } from '@tiptap/react/menus'
import { Editor } from '@tiptap/core'
import { LinkIcon } from './SystemIcons'

const prettyHref = (href: string) => {
  const clean = href.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return clean.length > 34 ? clean.slice(0, 33) + '…' : clean
}

/** Popover shown when the cursor sits inside a link: open · edit · remove. */
export default function EditorLinkMenu({ editor }: { editor: Editor }) {
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState('')
  const href = (editor.getAttributes('link').href as string) || ''

  // Leave edit mode when the active link changes (or clears).
  useEffect(() => { setEditing(false) }, [href])

  const apply = () => {
    const v = url.trim()
    const chain = editor.chain().focus().extendMarkRange('link')
    if (v) chain.setLink({ href: v }).run()
    else chain.unsetLink().run()
    setEditing(false)
  }
  const remove = () => editor.chain().focus().extendMarkRange('link').unsetLink().run()
  const open = () => { if (href) window.open(href, '_blank') }

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="linkBubbleMenu"
      className="bubble-menu"
      shouldShow={({ editor }) => editor.isEditable && editor.state.selection.empty && editor.isActive('link')}
      options={{ placement: 'bottom', offset: 8 }}
    >
      {editing ? (
        <div className="bm-link">
          <input
            autoFocus
            className="bm-link-input"
            placeholder="Edit link…"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); apply() }
              else if (e.key === 'Escape') { e.preventDefault(); setEditing(false) }
            }}
          />
          <button className="bm-btn" title="Apply" onMouseDown={e => { e.preventDefault(); apply() }}>↵</button>
        </div>
      ) : (
        <div className="lm-view">
          <button className="lm-url" title="Open link" onMouseDown={e => { e.preventDefault(); open() }}>
            <LinkIcon size={14} />
            <span className="lm-url-text">{prettyHref(href)}</span>
          </button>
          <span className="bm-sep" />
          <button className="bm-btn lm-text" title="Edit link" onMouseDown={e => { e.preventDefault(); setUrl(href); setEditing(true) }}>Edit</button>
          <button className="bm-btn" title="Remove link" onMouseDown={e => { e.preventDefault(); remove() }}>✕</button>
        </div>
      )}
    </BubbleMenu>
  )
}
