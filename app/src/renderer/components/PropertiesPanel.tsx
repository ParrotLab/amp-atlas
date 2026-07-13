import './PropertiesPanel.css'
import { detectFileType, getSchema, FieldSchema } from '../utils/frontmatterSchemas'
import { CloseIcon } from './SystemIcons'
import Select from './Select'

interface PropertiesPanelProps {
  isOpen: boolean
  onClose: () => void
  filePath: string | undefined
  data: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
  readOnly?: boolean
}

export default function PropertiesPanel({ isOpen, onClose, filePath, data, onChange, readOnly }: PropertiesPanelProps) {
  const type = filePath ? detectFileType(filePath, data) : null
  const schema = getSchema(type)

  const setField = (key: string, value: unknown) => {
    onChange({ ...data, [key]: value })
  }

  const renderField = (f: FieldSchema) => {
    const value = data[f.key]
    if (f.widget === 'select') {
      return (
        <Select value={String(value ?? '')} options={f.options ?? []} disabled={readOnly}
          onChange={v => setField(f.key, v)} />
      )
    }
    if (f.widget === 'textarea') {
      return (
        <textarea className="prop-input prop-textarea" value={String(value ?? '')} disabled={readOnly} rows={4}
          onChange={e => setField(f.key, e.target.value)} />
      )
    }
    if (f.widget === 'tags') {
      const tags = Array.isArray(value) ? (value as string[]) : []
      return (
        <input className="prop-input" type="text" value={tags.join(', ')} disabled={readOnly}
          onChange={e => setField(f.key, e.target.value.split(',').map(t => t.trim()).filter(Boolean))} />
      )
    }
    return (
      <input className="prop-input" type="text" value={String(value ?? '')} disabled={readOnly}
        onChange={e => setField(f.key, e.target.value)} />
    )
  }

  const fileName = filePath?.split('/').pop() || ''

  return (
    <div className={`properties-panel ${isOpen ? 'open' : ''}`}>
      <div className="properties-header">
        <span className="properties-title">Properties</span>
        <button className="properties-close" onClick={onClose} aria-label="Close properties"><CloseIcon size={16} /></button>
      </div>
      <div className="properties-body">
        {schema ? (
          schema.map(f => (
            <div className="prop-group" key={f.key}>
              <div className="prop-label">{f.label}</div>
              {renderField(f)}
            </div>
          ))
        ) : (
          <div className="prop-empty">
            No properties for this file.
            <div style={{ marginTop: '8px', fontSize: '11px' }}>
              Properties appear for known file types (e.g. playbooks).
            </div>
          </div>
        )}
        <div className="prop-divider" />
        <div className="prop-group">
          <div className="prop-label">File Info</div>
          <div className="prop-meta">{fileName}</div>
        </div>
      </div>
    </div>
  )
}
