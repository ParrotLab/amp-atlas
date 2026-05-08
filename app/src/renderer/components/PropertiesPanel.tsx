import { useState, useEffect } from 'react'
import './PropertiesPanel.css'

interface PropertiesPanelProps {
  isOpen: boolean
  onClose: () => void
  filePath: string | undefined
  rawContent: string
}

interface Properties {
  status?: string
  description?: string
  owner?: string
  tags?: string[]
  priority?: string
}

function parseFrontmatter(content: string): Properties {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}

  const yaml = match[1]
  const props: Properties = {}

  // Simple YAML parser for our specific fields
  const lines = yaml.split('\n')
  for (const line of lines) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.substring(0, colonIdx).trim().toLowerCase()
    const value = line.substring(colonIdx + 1).trim()

    switch (key) {
      case 'status':
        props.status = value
        break
      case 'description':
        props.description = value
        break
      case 'owner':
        props.owner = value
        break
      case 'priority':
        props.priority = value
        break
      case 'tags':
        // Handle both "tags: foo, bar" and "tags: [foo, bar]"
        props.tags = value
          .replace(/^\[/, '').replace(/\]$/, '')
          .split(',')
          .map(t => t.trim().replace(/^["']|["']$/g, ''))
          .filter(Boolean)
        break
    }
  }

  return props
}

export default function PropertiesPanel({ isOpen, onClose, filePath, rawContent }: PropertiesPanelProps) {
  const [properties, setProperties] = useState<Properties>({})

  useEffect(() => {
    if (rawContent) {
      setProperties(parseFrontmatter(rawContent))
    } else {
      setProperties({})
    }
  }, [rawContent, filePath])

  const hasProperties = Object.values(properties).some(v => v !== undefined && v !== '' && (!Array.isArray(v) || v.length > 0))
  const fileName = filePath?.split('/').pop() || ''
  const dirPath = filePath?.split('/').slice(-3, -1).join('/') || ''

  return (
    <div className={`properties-panel ${isOpen ? 'open' : ''}`}>
      <div className="properties-header">
        <span className="properties-title">Properties</span>
        <button className="properties-close" onClick={onClose}>&times;</button>
      </div>
      <div className="properties-body">
        {hasProperties ? (
          <>
            {properties.status !== undefined && (
              <div className="prop-group">
                <div className="prop-label">Status</div>
                <select className="prop-select" value={properties.status} readOnly>
                  <option>{properties.status || 'None'}</option>
                </select>
              </div>
            )}
            {properties.description !== undefined && (
              <div className="prop-group">
                <div className="prop-label">Description</div>
                <input className="prop-input" type="text" value={properties.description} readOnly />
              </div>
            )}
            {properties.owner !== undefined && (
              <div className="prop-group">
                <div className="prop-label">Owner</div>
                <input className="prop-input" type="text" value={properties.owner} readOnly />
              </div>
            )}
            {properties.tags && properties.tags.length > 0 && (
              <div className="prop-group">
                <div className="prop-label">Tags</div>
                <div>
                  {properties.tags.map(tag => (
                    <span key={tag} className="prop-tag">{tag}</span>
                  ))}
                </div>
              </div>
            )}
            {properties.priority !== undefined && (
              <div className="prop-group">
                <div className="prop-label">Priority</div>
                <select className="prop-select" value={properties.priority} readOnly>
                  <option>{properties.priority || 'None'}</option>
                </select>
              </div>
            )}
          </>
        ) : (
          <div className="prop-empty">
            No properties found in this file.
            <div style={{ marginTop: '8px', fontSize: '11px' }}>
              Add YAML frontmatter to set properties.
            </div>
          </div>
        )}

        <div className="prop-divider" />

        <div className="prop-group">
          <div className="prop-label">File Info</div>
          <div className="prop-meta">
            {fileName}<br />
            Path: {dirPath}/{fileName}
          </div>
        </div>
      </div>
    </div>
  )
}
