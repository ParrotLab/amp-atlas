import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { SlashItem } from './slashCommand'
import './SlashMenu.css'

export interface SlashMenuRef {
  onKeyDown: (p: { event: KeyboardEvent }) => boolean
}

interface Props {
  items: SlashItem[]
  command: (item: SlashItem) => void
}

/** The "/" insert menu — rendered into a popup by the SlashCommand extension. */
const SlashMenu = forwardRef<SlashMenuRef, Props>(({ items, command }, ref) => {
  const [selected, setSelected] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setSelected(0) }, [items])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('.slash-item.active')?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (!items.length) return false
      if (event.key === 'ArrowDown') { setSelected(s => (s + 1) % items.length); return true }
      if (event.key === 'ArrowUp') { setSelected(s => (s - 1 + items.length) % items.length); return true }
      if (event.key === 'Enter') { const it = items[selected]; if (it) command(it); return true }
      return false
    },
  }), [items, selected, command])

  if (!items.length) return <div className="slash-menu"><div className="slash-empty">No matches</div></div>

  return (
    <div className="slash-menu" ref={listRef}>
      {items.map((item, i) => (
        <button
          key={item.title}
          className={`slash-item ${i === selected ? 'active' : ''}`.trim()}
          onMouseEnter={() => setSelected(i)}
          onMouseDown={e => { e.preventDefault(); command(item) }}
        >
          <span className="slash-icon">{item.icon}</span>
          <span className="slash-title">{item.title}</span>
        </button>
      ))}
    </div>
  )
})
SlashMenu.displayName = 'SlashMenu'
export default SlashMenu
