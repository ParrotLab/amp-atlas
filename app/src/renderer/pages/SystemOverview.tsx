import { useParams } from 'react-router-dom'
import FileTree from '../components/FileTree'
import FileViewer from '../components/FileViewer'
import { useState } from 'react'

const systemPaths: Record<string, string> = {
  learning: '/Users/kristidowns/Documents/Projects/amp-up-app',
  marketing: '',
  'ai-ops': ''
}

const systemNames: Record<string, string> = {
  learning: 'Learning System',
  marketing: 'Marketing System',
  'ai-ops': 'AI Operations'
}

export default function SystemOverview() {
  const { systemId } = useParams<{ systemId: string }>()
  const [selectedFile, setSelectedFile] = useState<string>()
  const rootPath = systemPaths[systemId || ''] || ''
  const systemName = systemNames[systemId || ''] || 'Unknown System'

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
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#1a1a2e' }}>{systemName}</div>
          <div style={{ fontSize: '11px', color: '#8E8B87', marginTop: '2px' }}>
            {rootPath ? rootPath.split('/').pop() : 'No folder configured'}
          </div>
        </div>
        {rootPath && <FileTree rootPath={rootPath} onFileSelect={setSelectedFile} selectedFile={selectedFile} />}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F5F0EB', overflow: 'hidden', minWidth: 0 }}>
        <FileViewer filePath={selectedFile} />
      </div>
    </div>
  )
}
