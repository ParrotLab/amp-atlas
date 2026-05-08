import { useParams } from 'react-router-dom'
import FileTree from '../components/FileTree'
import FileViewer from '../components/FileViewer'
import { useState, useEffect } from 'react'
import { getSystem, updateSystemFolder, SystemConfig } from '../utils/systemStore'

export default function SystemOverview() {
  const { systemId } = useParams<{ systemId: string }>()
  const [selectedFile, setSelectedFile] = useState<string>()
  const [system, setSystem] = useState<SystemConfig | undefined>()

  useEffect(() => {
    if (systemId) setSystem(getSystem(systemId))
  }, [systemId])

  const handleSelectFolder = async () => {
    const result = await window.api.dialog.selectFolder()
    if (result.ok && result.path && systemId) {
      const updated = updateSystemFolder(systemId, result.path)
      setSystem(updated.find(s => s.id === systemId))
      setSelectedFile(undefined)
    }
  }

  const rootPath = system?.folderPath || ''

  return (
    <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
      <div style={{
        width: '260px',
        minWidth: '260px',
        background: '#FEFCF9',
        borderRight: '1px solid #EDE8E2',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #EDE8E2', flexShrink: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#1a1a2e' }}>{system?.name || 'System'}</div>
          <div style={{ fontSize: '11px', color: '#8E8B87', marginTop: '2px' }}>
            {rootPath ? rootPath.split('/').pop() : 'No folder selected'}
          </div>
        </div>
        {rootPath ? (
          <FileTree rootPath={rootPath} onFileSelect={setSelectedFile} selectedFile={selectedFile} />
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '16px', opacity: 0.3 }}>📁</div>
            <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a1a2e', marginBottom: '6px' }}>No folder connected</div>
            <div style={{ fontSize: '12px', color: '#B5B1AC', marginBottom: '20px', lineHeight: 1.5 }}>Select a folder on your computer to connect this system.</div>
            <button
              onClick={handleSelectFolder}
              style={{
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 500,
                background: '#8B2BFF',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              Select Folder
            </button>
          </div>
        )}
        {rootPath && (
          <div style={{ padding: '10px 18px', borderTop: '1px solid #EDE8E2', flexShrink: 0 }}>
            <button
              onClick={handleSelectFolder}
              style={{
                width: '100%',
                padding: '6px',
                fontSize: '11px',
                fontWeight: 500,
                color: '#8E8B87',
                background: 'none',
                border: '1px solid #EDE8E2',
                borderRadius: '6px',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              Change Folder
            </button>
          </div>
        )}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F5F0EB', overflow: 'hidden', minWidth: 0 }}>
        <FileViewer filePath={selectedFile} />
      </div>
    </div>
  )
}
