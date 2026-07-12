import { useState } from 'react'
import { ChevronDownIcon } from './SystemIcons'

export interface SplitMenuItem {
  label: string
  onClick: () => void
  kbd?: string
  danger?: boolean
}

interface SplitButtonProps {
  label: string
  kbd?: string
  onClick: () => void
  disabled?: boolean
  menuDisabled?: boolean
  items: SplitMenuItem[]
  title?: string
}

/** A primary action + a caret that reveals secondary actions. Design system: .split-btn. */
export default function SplitButton({ label, kbd, onClick, disabled, menuDisabled, items, title }: SplitButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="split-btn">
      <button className="split-btn-primary" disabled={disabled} onClick={onClick} title={title}>
        <span>{label}</span>
        {kbd && <span className="split-btn-primary-kbd">{kbd}</span>}
      </button>
      <button
        className="split-btn-caret"
        disabled={menuDisabled}
        onClick={() => { if (!menuDisabled) setOpen(v => !v) }}
        aria-label="More actions"
      >
        <ChevronDownIcon size={15} />
      </button>
      {open && (
        <>
          <div className="split-btn-overlay" onClick={() => setOpen(false)} />
          <div className="split-btn-menu">
            {items.map((it, i) => (
              <button
                key={i}
                className={`split-btn-menu-item ${it.danger ? 'danger' : ''}`.trim()}
                onClick={() => { setOpen(false); it.onClick() }}
              >
                <span>{it.label}</span>
                {it.kbd && <span className="split-btn-kbd">{it.kbd}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
