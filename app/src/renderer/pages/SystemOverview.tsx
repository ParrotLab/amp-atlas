import { useParams } from 'react-router-dom'
import FileTree from '../components/FileTree'
import FileViewer from '../components/FileViewer'
import PropertiesPanel from '../components/PropertiesPanel'
import StatusBar from '../components/StatusBar'
import TabBar, { Tab } from '../components/TabBar'
import { useState, useEffect, useCallback } from 'react'
import { getSystem, updateSystemFolder, SystemConfig } from '../utils/systemStore'
import NewDraftModal from '../components/NewDraftModal'

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
  const [treeKey, setTreeKey] = useState(0) // Force file tree remount on branch switch
  const [rawContent, setRawContent] = useState('')
  const [showNewDraft, setShowNewDraft] = useState(false)

  const rootPath = system?.folderPath || ''

  const fetchGitStatus = useCallback(async () => {
    if (!rootPath) return
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
  }, [rootPath])

  useEffect(() => {
    fetchGitStatus()
    const interval = setInterval(fetchGitStatus, 10000)
    return () => clearInterval(interval)
  }, [fetchGitStatus])

  const handleSave = async () => {
    if (!rootPath) return
    // First save the file content to disk (trigger Cmd+S on editor)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', metaKey: true }))

    // Then git add + commit with auto-generated message
    setTimeout(async () => {
      const message = `Updated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
      const result = await window.api.git.save(rootPath, message)
      if (result.ok) {
        setIsDirty(false)
      }
    }, 200) // Small delay to let file write complete first
  }

  const handleDiscard = async () => {
    if (!rootPath) return
    const confirmed = window.confirm('Discard all unsaved edits? This will revert your files to the last save.')
    if (!confirmed) return

    const result = await window.api.git.discard(rootPath)
    if (result.ok) {
      // Reload current file
      if (selectedFile) {
        const current = selectedFile
        setSelectedFile(undefined)
        setTimeout(() => setSelectedFile(current), 100)
      }
      setIsDirty(false)
    }
  }

  const handlePublish = async () => {
    if (!rootPath) return

    // Save first if there are unsaved changes
    if (isDirty) {
      const message = `Updated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
      await window.api.git.save(rootPath, message)
    }

    const result = await window.api.git.publish(rootPath)
    if (result.ok) {
      setIsDirty(false)
      // Could show a success toast here in the future
      alert('Published! Your team can now see your changes.')
    } else {
      alert(`Couldn't publish: ${result.error}`)
    }
  }

  const handleSwitchBranch = async (branchName: string) => {
    if (!rootPath) return
    // Clear everything immediately
    setGitModified(new Set())
    setGitNew(new Set())
    setGitDeleted(new Set())
    setTabs([])
    setSelectedFile(undefined)
    setIsDirty(false)

    const result = await window.api.git.switchBranch(rootPath, branchName)
    if (result.ok) {
      console.log(`Switched to branch: ${(result as { branch?: string }).branch}`)
      // Wait for filesystem to settle, then refresh everything
      await new Promise(r => setTimeout(r, 500))
      await fetchGitStatus()
      setTreeKey(k => k + 1)
    } else {
      console.error('Branch switch failed:', result.error)
      alert(`Couldn't switch: ${result.error}`)
      await fetchGitStatus()
    }
  }

  const handleNewDraft = () => {
    setShowNewDraft(true)
  }

  const handleCreateDraft = async (name: string) => {
    if (!rootPath) return
    const result = await window.api.git.createDraft(rootPath, name)
    if (result.ok) {
      setTabs([])
      setSelectedFile(undefined)
      setIsDirty(false)
      setTreeKey(k => k + 1)
      await fetchGitStatus()
    } else {
      alert(`Couldn't create draft: ${result.error}`)
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
          <FileTree key={treeKey} rootPath={rootPath} onFileSelect={handleFileSelect} selectedFile={selectedFile} gitModified={gitModified} gitNew={gitNew} gitDeleted={gitDeleted} />
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
        <TabBar tabs={tabs} activeTab={selectedFile} onTabClick={handleTabClick} onTabClose={handleTabClose} />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          <FileViewer
            filePath={selectedFile}
            rootPath={rootPath}
            onDirtyChange={setIsDirty}
            onContentLoad={setRawContent}
            onToggleProperties={() => setPropsOpen(!propsOpen)}
            propsOpen={propsOpen}
          />
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
      <NewDraftModal
        isOpen={showNewDraft}
        onClose={() => setShowNewDraft(false)}
        onCreate={handleCreateDraft}
      />
    </div>
  )
}
