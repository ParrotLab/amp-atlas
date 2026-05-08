import { useParams } from 'react-router-dom'
import FileTree from '../components/FileTree'
import FileViewer from '../components/FileViewer'
import GitStatusBar from '../components/GitStatusBar'
import StatusBar from '../components/StatusBar'
import TabBar, { Tab } from '../components/TabBar'
import { useState, useEffect, useCallback } from 'react'
import { getSystem, updateSystemFolder, SystemConfig } from '../utils/systemStore'

export default function SystemOverview() {
  const { systemId } = useParams<{ systemId: string }>()
  const [selectedFile, setSelectedFile] = useState<string>()
  const [system, setSystem] = useState<SystemConfig | undefined>()
  const [tabs, setTabs] = useState<Tab[]>([])

  useEffect(() => {
    if (systemId) setSystem(getSystem(systemId))
  }, [systemId])

  const handleSelectFolder = async () => {
    const result = await window.api.dialog.selectFolder()
    if (result.ok && result.path && systemId) {
      const updated = updateSystemFolder(systemId, result.path)
      setSystem(updated.find(s => s.id === systemId))
      setSelectedFile(undefined)
      setTabs([])
    }
  }

  const handleFileSelect = useCallback((path: string) => {
    setSelectedFile(path)
    setTabs(prev => {
      if (prev.some(t => t.path === path)) return prev
      const name = path.split('/').pop() || ''
      return [...prev, { path, name }]
    })
  }, [])

  const handleTabClick = useCallback((path: string) => {
    setSelectedFile(path)
  }, [])

  const handleTabClose = useCallback((path: string) => {
    setTabs(prev => {
      const updated = prev.filter(t => t.path !== path)
      if (path === selectedFile) {
        const idx = prev.findIndex(t => t.path === path)
        const next = updated[Math.min(idx, updated.length - 1)]
        setSelectedFile(next?.path)
      }
      return updated
    })
  }, [selectedFile])

  const [gitModified, setGitModified] = useState<Set<string>>(new Set())
  const [gitNew, setGitNew] = useState<Set<string>>(new Set())
  const [gitDeleted, setGitDeleted] = useState<Set<string>>(new Set())
  const [branch, setBranch] = useState<string>('')
  const [isMainBranch, setIsMainBranch] = useState(true)
  const [isDirty, setIsDirty] = useState(false)

  const rootPath = system?.folderPath || ''

  useEffect(() => {
    if (!rootPath) return
    const fetchGitStatus = async () => {
      const result = await window.api.git.status(rootPath)
      if (result.ok && result.status) {
        setGitModified(new Set(result.status.modified))
        setGitNew(new Set([...result.status.not_added]))
        setGitDeleted(new Set(result.status.deleted))
        setBranch(result.status.current || 'main')
        setIsMainBranch(result.status.current === 'main' || result.status.current === 'master')
      }
    }
    fetchGitStatus()
    const interval = setInterval(fetchGitStatus, 5000)
    return () => clearInterval(interval)
  }, [rootPath])

  const handleSave = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true }))
  }

  const handleDiscard = () => {
    if (window.confirm('Discard unsaved edits? You\'ll lose changes since your last save.')) {
      if (selectedFile) {
        const current = selectedFile
        setSelectedFile(undefined)
        setTimeout(() => setSelectedFile(current), 50)
      }
      setIsDirty(false)
    }
  }

  const handlePublish = async () => {
    // TODO: Implement git push
    alert('Publish coming soon — this will push your saves to GitHub.')
  }

  return (
    <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
      {/* File tree panel */}
      <div style={{
        width: '250px',
        minWidth: '250px',
        background: '#FEFCF9',
        borderRight: '1px solid #EDE8E2',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {rootPath ? (
          <>
            <FileTree rootPath={rootPath} onFileSelect={handleFileSelect} selectedFile={selectedFile} gitModified={gitModified} gitNew={gitNew} gitDeleted={gitDeleted} />
            <GitStatusBar repoPath={rootPath} />
          </>
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
      </div>

      {/* Main content: tabs + viewer */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#F5F0EB', overflow: 'hidden', minWidth: 0 }}>
        <TabBar tabs={tabs} activeTab={selectedFile} onTabClick={handleTabClick} onTabClose={handleTabClose} branchName={branch} isMain={isMainBranch} isDirty={isDirty} />
        <FileViewer filePath={selectedFile} onDirtyChange={setIsDirty} />
        <StatusBar
          editedCount={isDirty ? gitModified.size + gitNew.size : 0}
          savedCount={0}
          newCount={gitNew.size}
          isDirty={isDirty}
          onSave={handleSave}
          onDiscard={handleDiscard}
          onPublish={handlePublish}
        />
      </div>
    </div>
  )
}
