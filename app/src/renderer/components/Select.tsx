import { useState } from 'react'
import { ChevronDownIcon } from './SystemIcons'
import './Select.css'

interface SelectProps {
  value: string
  options: string[]
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}

/** Branded single-select dropdown (matches the version switcher), replacing native <select>. */
export default function Select({ value, options, onChange, disabled, placeholder = 'None' }: SelectProps) {
  const [open, setOpen] = useState(false)

  const pick = (v: string) => { onChange(v); setOpen(false) }

  return (
    <div className="amp-select">
      <button
        type="button"
        className={`amp-select-trigger ${open ? 'open' : ''}`}
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`amp-select-value ${value ? '' : 'placeholder'}`}>{value || placeholder}</span>
        <span className="amp-select-chevron"><ChevronDownIcon size={14} /></span>
      </button>

      {open && !disabled && (
        <>
          <div className="amp-select-overlay" onClick={() => setOpen(false)} />
          <div className="amp-select-menu" role="listbox">
            <button type="button" role="option" aria-selected={!value}
              className={`amp-select-item ${value ? '' : 'active'}`} onClick={() => pick('')}>
              <span className="amp-select-item-label">{placeholder}</span>
              {!value && <span className="amp-select-check">✓</span>}
            </button>
            {options.map(o => (
              <button key={o} type="button" role="option" aria-selected={o === value}
                className={`amp-select-item ${o === value ? 'active' : ''}`} onClick={() => pick(o)}>
                <span className="amp-select-item-label">{o}</span>
                {o === value && <span className="amp-select-check">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
