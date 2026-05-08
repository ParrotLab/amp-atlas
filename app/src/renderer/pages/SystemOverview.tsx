import { useParams } from 'react-router-dom'
import FileTree from '../components/FileTree'
import FileViewer from '../components/FileViewer'
import PropertiesPanel from '../components/PropertiesPanel'
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
  const [allBranches, setAllBranches] = useState<{ name: string; current: boolean }[]>([])
  const [propsOpen, setPropsOpen] = useState(false)
  const [rawContent, setRawContent] = useState('')

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
      const branchResult = await window.api.git.branches(rootPath)
      if (branchResult.ok && branchResult.branches) {
        setAllBranches(
          branchResult.branches.all
            .filter(b => !b.startsWith('remotes/'))
            .map(b => ({ name: b, current: b === branchResult.branches!.current }))
        )
      }
    }
    fetchGitStatus()
    const interval = setInterval(fetchGitStatus, 10000)
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

  const handleSwitchBranch = (branchName: string) => {
    // TODO: Implement git checkout
    alert(`Switching to "${branchName}" — coming soon.`)
  }

  const handleNewDraft = () => {
    // TODO: Implement create branch
    const name = prompt('Name your draft:')
    if (name) {
      alert(`Creating draft "${name}" — coming soon.`)
    }
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
          <FileTree rootPath={rootPath} onFileSelect={handleFileSelect} selectedFile={selectedFile} gitModified={gitModified} gitNew={gitNew} gitDeleted={gitDeleted} />
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
        {/* Tab bar + properties toggle */}
        <div style={{ display: 'flex', alignItems: 'center', background: '#FEFCF9', borderBottom: '1px solid #EDE8E2', flexShrink: 0 }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <TabBar tabs={tabs} activeTab={selectedFile} onTabClick={handleTabClick} onTabClose={handleTabClose} />
          </div>
          {selectedFile && (
            <button
              onClick={() => setPropsOpen(!propsOpen)}
              style={{
                width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '8px', border: 'none',
                background: propsOpen ? 'rgba(139,43,255,0.06)' : 'transparent',
                color: propsOpen ? '#8B2BFF' : '#B5B1AC',
                cursor: 'pointer', flexShrink: 0, marginRight: '12px',
                fontSize: '16px', fontFamily: 'inherit',
                transition: 'all 80ms ease'
              }}
              title="Properties"
            >
              &#9776;
            </button>
          )}
        </div>
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          <FileViewer filePath={selectedFile} onDirtyChange={setIsDirty} onContentLoad={setRawContent} />
          <PropertiesPanel isOpen={propsOpen} onClose={() => setPropsOpen(false)} filePath={selectedFile} rawContent={rawContent} />
        </div>
        <StatusBar
          editedCount={isDirty ? gitModified.size + gitNew.size : 0}
          savedCount={0}
          newCount={gitNew.size}
          isDirty={isDirty}
          branchName={branch}
          isMain={isMainBranch}
          branches={allBranches}
          onSave={handleSave}
          onDiscard={handleDiscard}
          onPublish={handlePublish}
          onSwitchBranch={handleSwitchBranch}
          onNewDraft={handleNewDraft}
        />
      </div>
    </div>
  )
}
