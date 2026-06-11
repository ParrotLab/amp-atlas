import { useParams } from 'react-router-dom'
import FileTree from '../components/FileTree'
import FileViewer from '../components/FileViewer'
import PropertiesPanel from '../components/PropertiesPanel'
import StatusBar from '../components/StatusBar'
import TabBar, { Tab } from '../components/TabBar'
import { useState, useEffect, useCallback } from 'react'
import { getSystem, updateSystemFolder, SystemConfig } from '../utils/systemStore'
import NewDraftModal from '../components/NewDraftModal'
import PublishModal from '../components/PublishModal'

function humanize(branch: string): string {
  return branch
    .replace(/^(draft|feature|fix|hotfix)\//i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

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
  const [showPublish, setShowPublish] = useState(false)

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
      // isDirty = there are ANY uncommitted changes (modified, new, or deleted files)
      setIsDirty(!result.status.isClean)
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
    // Poll every 3 seconds so edits show up quickly
    const interval = setInterval(fetchGitStatus, 3000)
    return () => clearInterval(interval)
  }, [fetchGitStatus])

  // "Save" = git add + commit. File edits are already written to disk by the editor's autosave.
  const handleSave = async () => {
    if (!rootPath) return
    const message = `Updated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    const result = await window.api.git.save(rootPath, message)
    if (result.ok) {
      await fetchGitStatus()
    }
  }

  // "Discard" = revert all uncommitted changes on disk
  const handleDiscard = async () => {
    if (!rootPath) return
    const confirmed = window.confirm('Discard all edits since your last save? This cannot be undone.')
    if (!confirmed) return

    const result = await window.api.git.discard(rootPath)
    if (result.ok) {
      // Reload current file to show reverted content
      if (selectedFile) {
        const current = selectedFile
        setSelectedFile(undefined)
        setTimeout(() => setSelectedFile(current), 100)
      }
      await fetchGitStatus()
      setTreeKey(k => k + 1)
    }
  }

  // "Publish" = open modal to commit + push to GitHub + create PR
  const handlePublish = () => {
    setShowPublish(true)
  }

  const handleDoPublish = async (title: string, description: string, reviewers: string[]) => {
    if (!rootPath) return

    // First commit any uncommitted changes
    const status = await window.api.git.status(rootPath)
    if (status.ok && status.status && !status.status.isClean) {
      await window.api.git.save(rootPath, title)
    }

    // Push to GitHub
    const pushResult = await window.api.git.publish(rootPath)
    if (!pushResult.ok) {
      alert(`Couldn't publish: ${pushResult.error}`)
      return
    }

    // TODO: Create GitHub PR with title, description, and reviewers
    // This requires GitHub OAuth which is part of the onboarding flow
    console.log('PR would be created:', { title, description, reviewers })

    await fetchGitStatus()
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
            readOnly={isMainBranch}
            onContentLoad={setRawContent}
            onToggleProperties={() => setPropsOpen(!propsOpen)}
            propsOpen={propsOpen}
          />
          <PropertiesPanel isOpen={propsOpen} onClose={() => setPropsOpen(false)} filePath={selectedFile} rawContent={rawContent} />
        </div>
        <StatusBar
          editedCount={gitModified.size}
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
      <PublishModal
        isOpen={showPublish}
        onClose={() => setShowPublish(false)}
        onPublish={handleDoPublish}
        draftName={humanize(branch)}
        modifiedCount={gitModified.size}
        newCount={gitNew.size}
      />
    </div>
  )
}
