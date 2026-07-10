import { useParams } from 'react-router-dom'
import FileTree from '../components/FileTree'
import FileViewer from '../components/FileViewer'
import PropertiesPanel from '../components/PropertiesPanel'
import StatusBar from '../components/StatusBar'
import TabBar, { Tab } from '../components/TabBar'
import { useState, useEffect, useCallback, useRef } from 'react'
import { getSystem, updateSystemFolder, SystemConfig } from '../utils/systemStore'
import NewDraftModal from '../components/NewDraftModal'
import PublishModal from '../components/PublishModal'
import ConflictModal from '../components/ConflictModal'
import MoveChangesModal from '../components/MoveChangesModal'
import { useFileDocument } from '../hooks/useFileDocument'
import { useToast } from '../components/Toast'
import ConfirmSwitchModal from '../components/ConfirmSwitchModal'
import NewItemModal from '../components/NewItemModal'
import MoveToModal from '../components/MoveToModal'
import { scaffoldFor, ScaffoldType } from '../utils/scaffold'
import { useOnline } from '../hooks/useOnline'
import { githubActionsAvailable } from '../utils/capabilities'
import { setLastPull, getLastPull, relativeTime } from '../utils/pullStatus'
import { getStoredTabs, setStoredTabs } from '../utils/tabStore'
import { listActive, listArchived, registerDraft, setDraftState, touchDraft, removeDraft, DraftEntry } from '../utils/draftStore'

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
  const [ahead, setAhead] = useState(0)
  const [propsOpen, setPropsOpen] = useState(false)
  const [treeKey, setTreeKey] = useState(0) // Force file tree remount on branch switch
  const [showNewDraft, setShowNewDraft] = useState(false)
  const [showPublish, setShowPublish] = useState(false)
  const [conflictFiles, setConflictFiles] = useState<string[] | null>(null)
  const [showMoveChanges, setShowMoveChanges] = useState(false)
  const [moveBannerDismissed, setMoveBannerDismissed] = useState(false)
  const [prStatus, setPrStatus] = useState<{ hasPR: boolean; state?: string; reviewDecision?: string | null }>({ hasPR: false })

  const rootPath = system?.folderPath || ''

  const { data, body, status: writeStatus, updateBody, updateData, externalPrompt, resolveExternal, reconcile } = useFileDocument(selectedFile, isMainBranch)
  const { showToast } = useToast()
  const [caps, setCaps] = useState({ isGitRepo: true, connected: true })
  const online = useOnline()
  const [treeRefresh, setTreeRefresh] = useState(0)
  type Pending =
    | { kind: 'scaffold'; type: ScaffoldType }
    | { kind: 'file'; parentAbs: string }
    | { kind: 'folder'; parentAbs: string }
    | { kind: 'rename'; absPath: string; isDir: boolean }
  const [pendingCreate, setPendingCreate] = useState<Pending | null>(null)
  const [moveSource, setMoveSource] = useState<string | null>(null)
  const [moveFolders, setMoveFolders] = useState<string[]>([])
  const canEdit = !isMainBranch && caps.isGitRepo
  const changeHandler = useRef<(paths: string[]) => void>(() => {})

  useEffect(() => {
    if (!rootPath) return
    window.api.system.capabilities(rootPath).then(r => {
      if (r.ok) setCaps({ isGitRepo: r.isGitRepo, connected: r.connected })
    })
  }, [rootPath])

  const [refreshTick, setRefreshTick] = useState(0)

  // Opening a system refreshes its Live Version from GitHub and records the pull time.
  useEffect(() => {
    if (!rootPath) return
    window.api.git.refreshMain(rootPath).then(r => { if (r.ok) { setLastPull(rootPath, Date.now()); setRefreshTick(t => t + 1) } })
  }, [rootPath])

  // Manual "Refresh" on the Live Version: pull latest main + record + refresh view.
  const handleRefreshLive = async () => {
    if (!rootPath) return
    const r = await window.api.git.refreshMain(rootPath)
    if (r.ok) { setLastPull(rootPath, Date.now()); setRefreshTick(t => t + 1); void fetchGitStatus() }
  }

  // Opening a system: restore its previously-open tabs; if none, auto-open README.md if present.
  useEffect(() => {
    if (!systemId || !rootPath) return
    let cancelled = false
    ;(async () => {
      const saved = getStoredTabs(systemId)
      const valid: { path: string; name: string }[] = []
      for (const t of saved?.tabs ?? []) {
        const s = await window.api.fs.stat(t.path)
        if (s.ok) valid.push(t)
      }
      if (cancelled) return
      if (valid.length > 0) {
        setTabs(valid)
        setSelectedFile(saved?.active && valid.some(t => t.path === saved.active) ? saved.active : valid[0].path)
      } else {
        const readme = `${rootPath}/README.md`
        const s = await window.api.fs.stat(readme)
        if (!cancelled && s.ok) { setTabs([{ path: readme, name: 'README.md' }]); setSelectedFile(readme) }
      }
    })()
    return () => { cancelled = true }
  }, [systemId, rootPath])

  // Persist open tabs per system (only when non-empty, so transient clears don't wipe saved state).
  useEffect(() => {
    if (systemId && tabs.length > 0) setStoredTabs(systemId, { tabs, active: selectedFile })
  }, [systemId, tabs, selectedFile])

  // Re-show the move-changes banner if the user edits Live again after dismissing.
  useEffect(() => { if (!isDirty) setMoveBannerDismissed(false) }, [isDirty])

  // Watch the active system folder; reflect external edits live.
  useEffect(() => {
    if (!rootPath) return
    window.api.fs.watch(rootPath)
    const unsub = window.api.fs.onChanged(paths => changeHandler.current(paths))
    return () => { window.api.fs.unwatch(); unsub() }
  }, [rootPath])

  const [activeDrafts, setActiveDrafts] = useState<DraftEntry[]>([])
  const [archivedDrafts, setArchivedDrafts] = useState<DraftEntry[]>([])
  const [lastSaved, setLastSaved] = useState<string>('')
  // pending action awaiting Save/Discard resolution when the tree is dirty
  const [pending, setPending] = useState<null | (() => Promise<void>)>(null)

  const refreshDrafts = useCallback(() => {
    if (!systemId) return
    setActiveDrafts(listActive(systemId))
    setArchivedDrafts(listArchived(systemId))
  }, [systemId])

  useEffect(() => { refreshDrafts() }, [refreshDrafts, branch])

  const fetchGitStatus = useCallback(async () => {
    if (!rootPath) return
    const result = await window.api.git.status(rootPath)
    if (result.ok && result.status) {
      setGitModified(new Set(result.status.modified))
      setGitNew(new Set([...result.status.not_added]))
      setGitDeleted(new Set(result.status.deleted))
      setBranch(result.status.current || 'main')
      setIsMainBranch(result.status.current === 'main' || result.status.current === 'master')
      setIsDirty(!result.status.isClean)
      setAhead(result.status.ahead)

      // Register the current draft so it appears in the app's draft list.
      const cur = result.status.current
      if (systemId && cur && cur !== 'main' && cur !== 'master') {
        registerDraft(systemId, cur, humanize(cur))
        touchDraft(systemId, cur)
        setActiveDrafts(listActive(systemId))
        setArchivedDrafts(listArchived(systemId))
      }
    }

    // Last-saved (latest commit) time for the legible status line.
    const logResult = await window.api.git.log(rootPath, 1)
    if (logResult.ok && logResult.log && logResult.log[0]) {
      const d = new Date(logResult.log[0].date)
      const mins = Math.floor((Date.now() - d.getTime()) / 60000)
      setLastSaved(mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : `${Math.floor(mins / 60)}h ago`)
    }
  }, [rootPath, systemId])

  useEffect(() => {
    fetchGitStatus()
    // Poll every 3 seconds so edits show up quickly
    const interval = setInterval(fetchGitStatus, 3000)
    return () => clearInterval(interval)
  }, [fetchGitStatus])

  useEffect(() => {
    if (!rootPath || !branch || isMainBranch) {
      setPrStatus({ hasPR: false })
      return
    }
    // Check PR status when branch changes
    window.api.git.prStatus(rootPath).then(result => {
      if (result.ok) {
        setPrStatus({
          hasPR: result.hasPR,
          state: result.pr?.state,
          reviewDecision: result.pr?.reviewDecision
        })
      }
    })
  }, [rootPath, branch, isMainBranch])

  useEffect(() => {
    if (!rootPath || isMainBranch) return
    const checkMerged = async () => {
      const result = await window.api.git.checkMerged(rootPath)
      if (result.ok && result.merged && result.branch) {
        // Published & merged — retire the draft (this is the ONLY place a branch is deleted).
        showToast(`"${humanize(result.branch)}" has been published and archived. You're now on the Live Version.`)
        await window.api.git.switchBranch(rootPath, 'main')
        await window.api.git.deleteBranch(rootPath, result.branch)
        if (systemId) removeDraft(systemId, result.branch)
        setTabs([])
        setSelectedFile(undefined)
        setTreeKey(k => k + 1)
        await fetchGitStatus()
        refreshDrafts()
      }
    }
    // Check every 30 seconds
    const interval = setInterval(checkMerged, 30000)
    return () => clearInterval(interval)
  }, [rootPath, isMainBranch, branch, fetchGitStatus])

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

  // Keyboard shortcuts on a draft: ⌘S save, ⌘↵ publish.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || isMainBranch) return
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        if (isDirty && caps.isGitRepo) void handleSave()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handlePublish()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isMainBranch, isDirty, caps.isGitRepo])

  const handleDoPublish = async (title: string, description: string, reviewers: string[]) => {
    if (!rootPath) return

    // First commit any uncommitted changes
    const status = await window.api.git.status(rootPath)
    if (status.ok && status.status && !status.status.isClean) {
      await window.api.git.save(rootPath, title)
    }

    // Bring the draft up to date with the Live Version before pushing.
    const update = await window.api.git.updateFromLive(rootPath)
    if (!update.ok) {
      setConflictFiles(update.files)   // real overlap — escalate calmly, do not push
      return
    }

    // Push to GitHub
    const pushResult = await window.api.git.publish(rootPath)
    if (!pushResult.ok) {
      showToast("Couldn't publish — check your connection.", {
        label: 'Retry',
        onClick: () => { void handleDoPublish(title, description, reviewers) },
      })
      return
    }

    // Create PR via gh CLI (TODO: replace with GitHub OAuth API before shipping)
    if (!isMainBranch) {
      const prResult = await window.api.git.createPR(rootPath, title, description, reviewers)
      if (prResult.ok && prResult.url) {
        console.log('PR created:', prResult.url)
      } else if (prResult.alreadyExists) {
        console.log('PR already exists for this branch')
      } else if (!prResult.ok) {
        console.warn('PR creation failed:', prResult.error)
      }
    }

    await fetchGitStatus()
  }

  // Run `action`, but if there are unsaved edits in a draft, prompt Save/Discard first.
  const guarded = (action: () => Promise<void>) => {
    if (isDirty && !isMainBranch) {
      setPending(() => action)
    } else {
      void action()
    }
  }

  const resolvePending = async (mode: 'save' | 'discard' | 'cancel') => {
    const action = pending
    setPending(null)
    if (!action || mode === 'cancel') return
    if (mode === 'save') {
      await window.api.git.save(rootPath, `Updated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`)
    } else {
      await window.api.git.discard(rootPath)
    }
    await action()
  }

  const doSwitch = async (branchName: string) => {
    if (!rootPath) return
    setGitModified(new Set()); setGitNew(new Set()); setGitDeleted(new Set())
    setTabs([]); setSelectedFile(undefined); setIsDirty(false)
    const result = await window.api.git.switchBranch(rootPath, branchName)
    if (result.ok) {
      if (systemId && branchName !== 'main' && branchName !== 'master') {
        registerDraft(systemId, branchName, humanize(branchName)); touchDraft(systemId, branchName)
      }
      await new Promise(r => setTimeout(r, 500))
      await fetchGitStatus(); setTreeKey(k => k + 1); refreshDrafts()
    } else {
      showToast(`Couldn't switch: ${result.error}`); await fetchGitStatus()
    }
  }
  const handleSwitchBranch = (branchName: string) => guarded(() => doSwitch(branchName))

  // Archive = mark archived in the registry (keep the branch); switch off it first if current.
  const handleArchiveBranch = (branchName: string) => guarded(async () => {
    if (!systemId) return
    if (branch === branchName) await doSwitch('main')
    setDraftState(systemId, branchName, 'archived')
    refreshDrafts()
    showToast(`Archived "${humanize(branchName)}". You can restore it anytime.`)
  })

  const handleUnarchive = (branchName: string) => {
    if (!systemId) return
    setDraftState(systemId, branchName, 'active'); refreshDrafts()
  }

  const handleNewDraft = () => {
    setShowNewDraft(true)
  }

  const doCreateDraft = async (name: string) => {
    if (!rootPath) return
    const result = await window.api.git.createDraft(rootPath, name)
    if (result.ok && result.branch) {
      if (systemId) registerDraft(systemId, result.branch, humanize(result.branch))
      setTabs([]); setSelectedFile(undefined); setIsDirty(false); setTreeKey(k => k + 1)
      await fetchGitStatus(); refreshDrafts()
      if (result.pulled === false) showToast("Draft created from your local Live Version (offline — couldn't pull latest).")
    } else {
      showToast(`Couldn't create draft: ${result.error}`)
    }
  }
  const handleCreateDraft = async (name: string) => { guarded(() => doCreateDraft(name)) }

  const handleMoveChangesToDraft = async (name: string) => {
    if (!rootPath) return
    const result = await window.api.git.createDraftFromChanges(rootPath, name)
    if (result.ok && result.branch) {
      if (systemId) registerDraft(systemId, result.branch, humanize(result.branch))
      setTabs([]); setSelectedFile(undefined); setTreeKey(k => k + 1)
      await fetchGitStatus(); refreshDrafts()
    } else {
      showToast(`Couldn't move changes into a draft: ${result.error}`)
    }
  }

  const handleAddExistingWork = (branchName: string) => guarded(() => doSwitch(branchName))

  const refreshAfterFs = async () => { setTreeRefresh(t => t + 1); await fetchGitStatus() }

  const doCreateConfirm = async (name: string) => {
    const p = pendingCreate
    setPendingCreate(null)
    if (!p) return
    const date = new Date().toISOString().slice(0, 10)
    if (p.kind === 'scaffold') {
      const { files } = scaffoldFor(p.type, name, date)
      let firstAbs = ''
      for (const f of files) {
        const abs = `${rootPath}/${f.path}`
        const res = await window.api.fs.createFile(abs, f.content)
        if (!res.ok) { showToast(res.error || "Couldn't create"); return }
        if (!firstAbs) firstAbs = abs
      }
      await refreshAfterFs()
      if (firstAbs) handleFileSelect(firstAbs)
    } else if (p.kind === 'file') {
      const trimmed = name.trim()
      const abs = `${p.parentAbs}/${trimmed.endsWith('.md') ? trimmed : `${trimmed}.md`}`
      const res = await window.api.fs.createFile(abs, '')
      if (!res.ok) { showToast(res.error || "Couldn't create"); return }
      await refreshAfterFs(); handleFileSelect(abs)
    } else if (p.kind === 'folder') {
      const res = await window.api.fs.mkdir(`${p.parentAbs}/${name.trim()}`)
      if (!res.ok) { showToast(res.error || "Couldn't create"); return }
      await refreshAfterFs()
    } else { // rename
      const parent = p.absPath.replace(/\/[^/]+$/, '')
      const res = await window.api.fs.move(p.absPath, `${parent}/${name.trim()}`)
      if (!res.ok) { showToast(res.error || "Couldn't rename"); return }
      if (selectedFile === p.absPath) setSelectedFile(undefined)
      await refreshAfterFs()
    }
  }

  const handleMove = async (fromAbs: string, toFolderAbs: string) => {
    if (!toFolderAbs) {
      // Context-menu "Move to…" → open the folder picker
      const res = await window.api.fs.listFolders(rootPath)
      const fromRel = fromAbs.replace(rootPath + '/', '')
      setMoveFolders((res.ok ? res.folders : []).filter(f => f !== fromRel && !f.startsWith(fromRel + '/')))
      setMoveSource(fromAbs)
      return
    }
    const name = fromAbs.split('/').pop()
    const res = await window.api.fs.move(fromAbs, `${toFolderAbs}/${name}`)
    if (!res.ok) { showToast(res.error || "Couldn't move"); return }
    if (selectedFile === fromAbs) setSelectedFile(undefined)
    await refreshAfterFs()
  }

  const handlePickMoveDest = async (folderRel: string) => {
    const from = moveSource
    setMoveSource(null)
    if (!from) return
    const name = from.split('/').pop()
    const res = await window.api.fs.move(from, `${rootPath}/${folderRel}/${name}`)
    if (!res.ok) { showToast(res.error || "Couldn't move"); return }
    if (selectedFile === from) setSelectedFile(undefined)
    await refreshAfterFs()
  }

  const handleDelete = async (absPath: string) => {
    const name = absPath.split('/').pop()
    if (!window.confirm(`Delete "${name}"? This can't be undone (until you Discard the draft).`)) return
    const res = await window.api.fs.delete(absPath)
    if (!res.ok) { showToast(res.error || "Couldn't delete"); return }
    if (selectedFile === absPath) { setSelectedFile(undefined); setTabs(prev => prev.filter(t => t.path !== absPath)) }
    await refreshAfterFs()
  }

  const modalConfig = (() => {
    const p = pendingCreate
    if (!p) return null
    if (p.kind === 'scaffold') {
      const labels = { playbook: 'New Playbook', project: 'New Project', 'sub-system': 'New Sub-system' }
      return { title: labels[p.type], previewFor: (slug: string) => `will create ${scaffoldFor(p.type, slug, '').folder}/`, initialName: '' }
    }
    if (p.kind === 'file') return { title: 'New File', previewFor: (slug: string) => `${p.parentAbs.replace(rootPath + '/', '')}/${slug}.md`, initialName: '' }
    if (p.kind === 'folder') return { title: 'New Folder', previewFor: (slug: string) => `${p.parentAbs.replace(rootPath + '/', '')}/${slug}`, initialName: '' }
    return { title: 'Rename', previewFor: (slug: string) => slug, initialName: p.absPath.split('/').pop() || '' }
  })()

  // React to external file changes: refresh status + tree, reconcile the open file.
  changeHandler.current = (paths: string[]) => {
    fetchGitStatus()
    setTreeRefresh(t => t + 1)
    if (selectedFile && paths.includes(selectedFile)) {
      window.api.fs.stat(selectedFile).then(s => {
        if (!s.ok) {
          showToast('This file was removed.')
          handleTabClose(selectedFile)
        } else {
          reconcile()
        }
      })
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
          <FileTree
            key={treeKey}
            rootPath={rootPath}
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
            gitModified={gitModified}
            gitNew={gitNew}
            gitDeleted={gitDeleted}
            refreshToken={treeRefresh}
            canEdit={canEdit}
            onNeedDraft={() => showToast('Create a draft to make changes.')}
            onNewScaffold={(type) => setPendingCreate({ kind: 'scaffold', type })}
            onNewFile={(parentAbs) => setPendingCreate({ kind: 'file', parentAbs })}
            onNewFolder={(parentAbs) => setPendingCreate({ kind: 'folder', parentAbs })}
            onRename={(absPath, isDir) => setPendingCreate({ kind: 'rename', absPath, isDir })}
            onMove={handleMove}
            onDelete={(absPath) => handleDelete(absPath)}
          />
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
        {isMainBranch && isDirty && !moveBannerDismissed && (
          <div style={{ position: 'relative', background: '#fdf3e0', border: '1px solid #f2d9a8', color: '#7a5a1e', padding: '10px 40px 10px 16px', margin: '10px 16px 0', borderRadius: '8px', fontSize: '13.5px', lineHeight: 1.5 }}>
            You've edited the Live Version directly —{' '}
            <button
              onClick={() => setShowMoveChanges(true)}
              style={{ background: 'none', border: 'none', padding: 0, color: '#8B2BFF', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', textDecoration: 'underline' }}
            >
              move these changes into a draft
            </button>{' '}
            to save and publish them safely.
            <button
              onClick={() => setMoveBannerDismissed(true)}
              aria-label="Dismiss"
              style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', color: '#b99b5f', cursor: 'pointer', fontSize: '14px', lineHeight: 1, fontFamily: 'inherit' }}
            >
              ✕
            </button>
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          <FileViewer
            filePath={selectedFile}
            rootPath={rootPath}
            readOnly={isMainBranch}
            body={body}
            onBodyChange={updateBody}
            writeStatus={writeStatus}
            onToggleProperties={() => setPropsOpen(!propsOpen)}
            propsOpen={propsOpen}
            externalPrompt={externalPrompt}
            onReloadExternal={() => resolveExternal('reload')}
            onKeepExternal={() => resolveExternal('keep')}
          />
          <PropertiesPanel
            isOpen={propsOpen}
            onClose={() => setPropsOpen(false)}
            filePath={selectedFile}
            data={data}
            onChange={updateData}
            readOnly={isMainBranch}
          />
        </div>
        <StatusBar
          editedCount={gitModified.size}
          savedCount={0}
          newCount={gitNew.size}
          isDirty={isDirty}
          branchName={branch}
          isMain={isMainBranch}
          activeDrafts={activeDrafts}
          archivedDrafts={archivedDrafts}
          lastSaved={lastSaved}
          lastRefreshedLabel={(() => { void refreshTick; const rel = rootPath ? relativeTime(getLastPull(rootPath), Date.now()) : ''; return rel ? `Updated ${rel}` : '' })()}
          onSave={handleSave}
          onDiscard={handleDiscard}
          onPublish={handlePublish}
          onRefresh={handleRefreshLive}
          onSwitchBranch={handleSwitchBranch}
          onNewDraft={handleNewDraft}
          onArchiveBranch={handleArchiveBranch}
          onUnarchive={handleUnarchive}
          onAddExistingWork={handleAddExistingWork}
          repoPath={rootPath}
          prStatus={prStatus}
          canUseGit={caps.isGitRepo}
          canUseGitHub={githubActionsAvailable(caps, online)}
          onNeedGit={() => showToast("This folder isn't connected to version control.")}
          onNeedGitHub={() =>
            showToast(
              !online
                ? "You're offline — keep editing; publishing and review need a connection."
                : caps.connected
                  ? 'Connect a GitHub-backed system to publish and review.'
                  : 'Reconnect to GitHub in Settings to publish and review.',
            )
          }
        />
      </div>
      {modalConfig && (
        <NewItemModal
          isOpen={!!pendingCreate}
          title={modalConfig.title}
          previewFor={modalConfig.previewFor}
          initialName={modalConfig.initialName}
          onConfirm={doCreateConfirm}
          onCancel={() => setPendingCreate(null)}
        />
      )}
      <MoveToModal
        isOpen={!!moveSource}
        itemName={moveSource ? (moveSource.split('/').pop() || '') : ''}
        folders={moveFolders}
        onPick={handlePickMoveDest}
        onCancel={() => setMoveSource(null)}
      />
      <ConfirmSwitchModal
        isOpen={!!pending}
        onSave={() => resolvePending('save')}
        onDiscard={() => resolvePending('discard')}
        onCancel={() => resolvePending('cancel')}
      />
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
        repoPath={rootPath}
      />
      <ConflictModal
        isOpen={conflictFiles !== null}
        files={conflictFiles ?? []}
        onClose={() => setConflictFiles(null)}
      />
      <MoveChangesModal
        isOpen={showMoveChanges}
        onClose={() => setShowMoveChanges(false)}
        onMove={handleMoveChangesToDraft}
      />
    </div>
  )
}
