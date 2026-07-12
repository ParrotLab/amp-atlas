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
import CommandPalette from '../components/CommandPalette'
import ConfirmModal from '../components/ConfirmModal'
import { FolderIcon, CloseIcon } from '../components/SystemIcons'
import { detectFileType, getSchema } from '../utils/frontmatterSchemas'
import { displayName } from '../utils/naming'
import { scaffoldFor, ScaffoldType } from '../utils/scaffold'
import { useOnline } from '../hooks/useOnline'
import { githubActionsAvailable } from '../utils/capabilities'
import { setLastPull, getLastPull, relativeTime } from '../utils/pullStatus'
import { getStoredTabs, setStoredTabs } from '../utils/tabStore'
import { listActive, registerDraft, setDraftState, touchDraft, removeDraft, DraftEntry } from '../utils/draftStore'

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
    // Compute the next selection OUTSIDE the setTabs updater — calling setSelectedFile
    // inside a state updater is a side-effect that makes the selection (and the file
    // content that follows it) update unreliably.
    const idx = tabs.findIndex(t => t.path === path)
    const updated = tabs.filter(t => t.path !== path)
    setTabs(updated)
    if (path === selectedFile) {
      setSelectedFile(updated.length ? updated[Math.min(idx, updated.length - 1)]?.path : undefined)
    }
  }, [tabs, selectedFile])

  const [gitModified, setGitModified] = useState<Set<string>>(new Set())
  const [gitNew, setGitNew] = useState<Set<string>>(new Set())
  const [gitDeleted, setGitDeleted] = useState<Set<string>>(new Set())
  const [branch, setBranch] = useState<string>('')
  const [isMainBranch, setIsMainBranch] = useState(true)
  const [isDirty, setIsDirty] = useState(false)
  const [hasUnpublished, setHasUnpublished] = useState(false)
  const [propsOpen, setPropsOpen] = useState(false)
  const [treeKey, setTreeKey] = useState(0) // Force file tree remount on branch switch
  const [showNewDraft, setShowNewDraft] = useState(false)
  const [showPublish, setShowPublish] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
  const [confirm, setConfirm] = useState<null | {
    title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void | Promise<void>
  }>(null)
  const [conflictFiles, setConflictFiles] = useState<string[] | null>(null)
  const [showMoveChanges, setShowMoveChanges] = useState(false)
  const [moveBannerDismissed, setMoveBannerDismissed] = useState(false)
  const [prStatus, setPrStatus] = useState<{ hasPR: boolean; number?: number; title?: string; body?: string; state?: string; reviewDecision?: string | null }>({ hasPR: false })

  const rootPath = system?.folderPath || ''

  const { data, body, status: writeStatus, updateBody, updateData, externalPrompt, resolveExternal, reconcile } = useFileDocument(selectedFile, isMainBranch)
  // Only files with a known schema (e.g. playbooks) have editable properties.
  const hasProperties = !!getSchema(selectedFile ? detectFileType(selectedFile, data) : null)
  const { showToast } = useToast()
  const [caps, setCaps] = useState({ isGitRepo: true, connected: true })
  const online = useOnline()
  const [treeRefresh, setTreeRefresh] = useState(0)
  type Pending =
    | { kind: 'scaffold'; type: ScaffoldType }
    | { kind: 'file'; parentAbs?: string }      // parentAbs omitted (toolbar) => user must pick a location
    | { kind: 'folder'; parentAbs?: string }
    | { kind: 'rename'; absPath: string; isDir: boolean }
  const [pendingCreate, setPendingCreate] = useState<Pending | null>(null)
  const [createFolders, setCreateFolders] = useState<string[]>([])
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
        // Only restore tabs that belong to THIS system's folder (guards against stale cross-system tabs).
        if (!t.path.startsWith(rootPath + '/')) continue
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
  const [lastSaved, setLastSaved] = useState<string>('')
  // pending action awaiting Save/Discard resolution when the tree is dirty
  const [pending, setPending] = useState<null | (() => Promise<void>)>(null)

  const refreshDrafts = useCallback(() => {
    if (!systemId) return
    setActiveDrafts(listActive(systemId))
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

      // Register the current draft so it appears in the app's draft list.
      const cur = result.status.current
      const onMain = cur === 'main' || cur === 'master'
      if (systemId && cur && !onMain) {
        registerDraft(systemId, cur, humanize(cur))
        touchDraft(systemId, cur)
        setActiveDrafts(listActive(systemId))
      }

      // Is there anything to publish? (uncommitted edits OR committed-but-unpublished work)
      if (onMain) {
        setHasUnpublished(false)
      } else {
        const w = await window.api.git.hasUnpublishedWork(rootPath)
        setHasUnpublished(w.ok ? w.hasWork : true)
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

  // Re-fetchable so we can refresh it right after submitting for review (not just on branch change / reload).
  const fetchPrStatus = useCallback(async () => {
    if (!rootPath || !branch || isMainBranch) { setPrStatus({ hasPR: false }); return }
    const result = await window.api.git.prStatus(rootPath)
    if (result.ok) {
      setPrStatus({
        hasPR: result.hasPR,
        number: result.pr?.number,
        title: result.pr?.title,
        body: result.pr?.body,
        state: result.pr?.state,
        reviewDecision: result.pr?.reviewDecision
      })
    }
  }, [rootPath, branch, isMainBranch])

  useEffect(() => { void fetchPrStatus() }, [fetchPrStatus])

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
  const doDiscard = async () => {
    if (!rootPath) return
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

  const handleDiscard = () => {
    if (!rootPath) return
    setConfirm({
      title: 'Discard all changes?',
      message: 'This reverts every edit since your last save. This can’t be undone.',
      confirmLabel: 'Discard changes',
      danger: true,
      onConfirm: doDiscard,
    })
  }

  // "Publish" = open modal to commit + push to GitHub + create PR
  const handlePublish = () => {
    setShowPublish(true)
  }

  // Focus mode: dim the app chrome (nav rail) via a body class; Esc leaves.
  useEffect(() => {
    document.body.classList.toggle('focus-mode', focusMode)
    return () => document.body.classList.remove('focus-mode')
  }, [focusMode])

  useEffect(() => {
    if (!focusMode) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFocusMode(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusMode])

  // ⌘K / ⌘P toggles the file search palette (works on Live Version and drafts).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && ['k', 'p'].includes(e.key.toLowerCase())) {
        e.preventDefault()
        if (rootPath) setShowPalette(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rootPath])

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

  // Returns true on success; false (with a toast) on failure, so the modal knows
  // whether to show the success state or return to the form.
  const handleDoPublish = async (title: string, description: string, reviewers: string[]): Promise<boolean> => {
    if (!rootPath) return false

    // First commit any uncommitted changes
    const status = await window.api.git.status(rootPath)
    if (status.ok && status.status && !status.status.isClean) {
      await window.api.git.save(rootPath, title)
    }

    // Bring the draft up to date with the Live Version before pushing.
    const update = await window.api.git.updateFromLive(rootPath)
    if (!update.ok) {
      setConflictFiles(update.files)   // real overlap — escalate calmly, do not push
      return false
    }

    // Push to GitHub
    const pushResult = await window.api.git.publish(rootPath)
    if (!pushResult.ok) {
      showToast("Couldn't submit — check your connection.", {
        label: 'Retry',
        onClick: () => { void handleDoPublish(title, description, reviewers) },
      })
      return false
    }

    // Existing PR → update body + re-request reviewers ("Add to review"); otherwise create.
    if (!isMainBranch) {
      if (prStatus.hasPR && prStatus.number) {
        const upd = await window.api.git.updatePR(rootPath, prStatus.number, title, description, reviewers)
        if (!upd.ok) { showToast("Couldn't update the review — try again."); return false }
      } else {
        const prResult = await window.api.git.createPR(rootPath, title, description, reviewers)
        if (!prResult.ok && !prResult.alreadyExists) { showToast("Couldn't submit for review — try again."); return false }
      }
    }

    await fetchGitStatus()
    await fetchPrStatus()   // reflect the new/updated PR (In Review tag) without a reload
    return true
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
  const handleArchiveBranch = (branchName: string) => {
    setConfirm({
      title: 'Archive this draft?',
      message: `“${humanize(branchName)}” will move out of your drafts and won’t be editable in Atlas anymore. Nothing is deleted — it stays on your computer, and you can add it back anytime from “Add existing work…”.`,
      confirmLabel: 'Archive',
      danger: true,
      onConfirm: () => doArchiveBranch(branchName),
    })
  }

  const doArchiveBranch = (branchName: string) => guarded(async () => {
    if (!systemId) return
    if (branch === branchName) await doSwitch('main')
    setDraftState(systemId, branchName, 'archived')
    refreshDrafts()
    showToast(`Archived "${humanize(branchName)}".`)
  })

  const handleNewDraft = () => {
    setShowNewDraft(true)
  }

  const doCreateDraft = async (name: string) => {
    if (!rootPath) return
    const result = await window.api.git.createDraft(rootPath, name)
    if (result.ok && result.branch) {
      // Store the user's original name (keeps capitalization); keep tabs open so they
      // can continue right where they were on the Live Version.
      if (systemId) registerDraft(systemId, result.branch, name.trim())
      setIsDirty(false); setTreeKey(k => k + 1)
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

  // Keep open tabs (and the active file) pointed at a renamed/moved path — incl. descendants
  // of a moved/renamed folder — so tabs update in place instead of going stale or duplicating.
  const repointTabs = (from: string, to: string) => {
    const remap = (path: string): string | null =>
      path === from ? to : path.startsWith(from + '/') ? to + path.slice(from.length) : null
    setTabs(prev => prev.map(t => {
      const np = remap(t.path)
      return np ? { ...t, path: np, name: np.split('/').pop() || t.name } : t
    }))
    setSelectedFile(cur => (cur ? remap(cur) ?? cur : cur))
  }

  // Load the destination-folder list whenever a file/folder create modal opens.
  useEffect(() => {
    if (!rootPath || (pendingCreate?.kind !== 'file' && pendingCreate?.kind !== 'folder')) return
    window.api.fs.listFolders(rootPath).then(r => setCreateFolders(r.ok ? r.folders : []))
  }, [pendingCreate, rootPath])

  const doCreateConfirm = async (name: string, folderRel: string) => {
    const p = pendingCreate
    setPendingCreate(null)
    if (!p) return
    const date = new Date().toISOString().slice(0, 10)
    // Destination folder chosen in the modal (empty => system root).
    const destAbs = folderRel ? `${rootPath}/${folderRel}` : rootPath
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
      // Exact name (spaces + capitalization preserved); .md is added on disk, hidden from the user.
      const base = name.trim().replace(/\.md$/i, '')
      const abs = `${destAbs}/${base}.md`
      const res = await window.api.fs.createFile(abs, '')
      if (!res.ok) { showToast(res.error || "Couldn't create"); return }
      await refreshAfterFs(); handleFileSelect(abs)
    } else if (p.kind === 'folder') {
      const res = await window.api.fs.mkdir(`${destAbs}/${name.trim()}`)
      if (!res.ok) { showToast(res.error || "Couldn't create"); return }
      await refreshAfterFs()
    } else { // rename
      const parent = p.absPath.replace(/\/[^/]+$/, '')
      const clean = name.trim()
      const newBase = p.isDir ? clean : `${clean.replace(/\.md$/i, '')}.md`
      const oldAbs = p.absPath
      const newAbs = `${parent}/${newBase}`
      const res = await window.api.fs.move(oldAbs, newAbs)
      if (!res.ok) { showToast(res.error || "Couldn't rename"); return }
      repointTabs(oldAbs, newAbs)
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
    const to = `${toFolderAbs}/${name}`
    const res = await window.api.fs.move(fromAbs, to)
    if (!res.ok) { showToast(res.error || "Couldn't move"); return }
    repointTabs(fromAbs, to)
    await refreshAfterFs()
  }

  const handlePickMoveDest = async (folderRel: string) => {
    const from = moveSource
    setMoveSource(null)
    if (!from) return
    const name = from.split('/').pop()
    const destDir = folderRel ? `${rootPath}/${folderRel}` : rootPath
    const to = `${destDir}/${name}`
    const res = await window.api.fs.move(from, to)
    if (!res.ok) { showToast(res.error || "Couldn't move"); return }
    repointTabs(from, to)
    await refreshAfterFs()
  }

  const doDelete = async (absPath: string) => {
    const res = await window.api.fs.delete(absPath)
    if (!res.ok) { showToast(res.error || "Couldn't delete"); return }
    // Close tabs for the deleted file — or any file inside a deleted folder.
    const removed = (p: string) => p === absPath || p.startsWith(absPath + '/')
    const remaining = tabs.filter(t => !removed(t.path))
    if (remaining.length !== tabs.length) setTabs(remaining)
    if (selectedFile && removed(selectedFile)) {
      setSelectedFile(remaining.length ? remaining[remaining.length - 1].path : undefined)
    }
    await refreshAfterFs()
  }

  // Inline title rename (the editable title in the viewer) → rename the open file on disk.
  const handleRenameTitle = async (newName: string) => {
    if (!selectedFile) return
    const clean = newName.trim().replace(/\.md$/i, '')
    if (!clean) return
    const parent = selectedFile.replace(/\/[^/]+$/, '')
    const newAbs = `${parent}/${clean}.md`
    if (newAbs === selectedFile) return
    const res = await window.api.fs.move(selectedFile, newAbs)
    if (!res.ok) { showToast(res.error || "Couldn't rename"); return }
    repointTabs(selectedFile, newAbs)
    await refreshAfterFs()
  }

  const handleDelete = (absPath: string) => {
    const name = displayName(absPath.split('/').pop() || '')
    setConfirm({
      title: 'Delete this item?',
      message: `“${name}” will be removed. You can still get it back by discarding the draft.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => doDelete(absPath),
    })
  }

  const modalConfig: null | {
    title: string
    previewFor: (name: string, folder: string) => string
    initialName: string
    confirmLabel?: string
    location?: { folders: string[]; initial?: string }
  } = (() => {
    const p = pendingCreate
    if (!p) return null
    // Absolute parent → system-relative folder ('' = root). undefined => no default (force a pick).
    const relOf = (abs?: string) => abs === undefined ? undefined : abs === rootPath ? '' : abs.replace(rootPath + '/', '')
    if (p.kind === 'scaffold') {
      const labels = { playbook: 'New Playbook', project: 'New Project', 'sub-system': 'New Sub-system' }
      return { title: labels[p.type], previewFor: (name: string) => `will create ${scaffoldFor(p.type, name, '').folder}/`, initialName: '' }
    }
    if (p.kind === 'file') return {
      title: 'New File',
      previewFor: (name: string, folder: string) => `${folder ? folder + ' / ' : ''}${name}`,
      initialName: '',
      location: { folders: createFolders, initial: relOf(p.parentAbs) },
    }
    if (p.kind === 'folder') return {
      title: 'New Folder',
      previewFor: (name: string, folder: string) => `${folder ? folder + ' / ' : ''}${name}`,
      initialName: '',
      location: { folders: createFolders, initial: relOf(p.parentAbs) },
    }
    // Rename — show/edit the name without the .md extension (files); folders keep their exact name.
    const base = p.absPath.split('/').pop() || ''
    return {
      title: 'Rename',
      previewFor: (name: string) => name,
      initialName: p.isDir ? base : displayName(base),
      confirmLabel: 'Rename',
    }
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
        display: focusMode ? 'none' : 'flex',
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
            onSearch={() => setShowPalette(true)}
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
            <div style={{ marginBottom: '16px', color: '#C4BFB9' }}><FolderIcon size={40} /></div>
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
        <TabBar
          tabs={tabs.map(t => {
            const rel = t.path.replace(rootPath + '/', '')
            const status = gitModified.has(rel) ? 'modified' as const : gitNew.has(rel) ? 'new' as const : undefined
            return { ...t, status }
          })}
          activeTab={selectedFile}
          onTabClick={handleTabClick}
          onTabClose={handleTabClose}
          onReorder={(fromPath, toIndex) => setTabs(prev => {
            const fromIdx = prev.findIndex(t => t.path === fromPath)
            if (fromIdx < 0) return prev
            const arr = [...prev]
            const [moved] = arr.splice(fromIdx, 1)
            const adj = fromIdx < toIndex ? toIndex - 1 : toIndex
            arr.splice(Math.max(0, Math.min(adj, arr.length)), 0, moved)
            return arr
          })}
        />
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
              style={{ position: 'absolute', top: '50%', right: 8, transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, background: 'none', border: 'none', color: '#b99b5f', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <CloseIcon size={14} />
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
            hasProperties={hasProperties}
            focusMode={focusMode}
            onToggleFocus={() => setFocusMode(v => !v)}
            onRenameTitle={handleRenameTitle}
            externalPrompt={externalPrompt}
            onReloadExternal={() => resolveExternal('reload')}
            onKeepExternal={() => resolveExternal('keep')}
          />
          <PropertiesPanel
            isOpen={propsOpen && !focusMode && hasProperties}
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
          hasUnpublishedWork={hasUnpublished}
          branchName={branch}
          isMain={isMainBranch}
          activeDrafts={activeDrafts}
          lastSaved={lastSaved}
          lastRefreshedLabel={(() => { void refreshTick; const rel = rootPath ? relativeTime(getLastPull(rootPath), Date.now()) : ''; return rel ? `Updated ${rel}` : '' })()}
          onSave={handleSave}
          onDiscard={handleDiscard}
          onPublish={handlePublish}
          onRefresh={handleRefreshLive}
          onSwitchBranch={handleSwitchBranch}
          onNewDraft={handleNewDraft}
          onArchiveBranch={handleArchiveBranch}
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
          confirmLabel={modalConfig.confirmLabel}
          location={modalConfig.location}
          onConfirm={doCreateConfirm}
          onCancel={() => setPendingCreate(null)}
        />
      )}
      <MoveToModal
        isOpen={!!moveSource}
        itemName={moveSource ? displayName(moveSource.split('/').pop() || '') : ''}
        folders={moveFolders}
        currentFolder={(() => {
          if (!moveSource) return ''
          const parent = moveSource.replace(/\/[^/]+$/, '')
          return parent === rootPath ? '' : parent.replace(rootPath + '/', '')
        })()}
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
        hasPR={prStatus.hasPR}
        existingTitle={prStatus.title}
        existingBody={prStatus.body}
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
      <CommandPalette
        isOpen={showPalette}
        rootPath={rootPath}
        onClose={() => setShowPalette(false)}
        onSelect={handleFileSelect}
      />
      <ConfirmModal
        isOpen={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        onConfirm={() => { const c = confirm; setConfirm(null); void c?.onConfirm() }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
