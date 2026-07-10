import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readdir, readFile, writeFile, stat } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { simpleGit } from 'simple-git'
import { startDeviceFlow, pollForToken, getIdentity } from './githubAuth'
import { tokenStore } from './tokenStore'
import { buildAuthHeader } from './authHeader'
import * as github from './github'
import { createDraftFromMain, createDraftFromChanges, switchDraft, listAdoptableBranches, updateFromLive, refreshMain } from './draftOps'
import { startWatch, stopWatch } from './watcher'
import { ensureDir, createFile, move as movePath, del as delPath, listFolders } from './fsops'
import { setupAutoUpdate } from './updater'
import { logError, logFilePath } from './logger'
import { hasUnpublishedWork, resyncFromLive } from './resync'

process.on('uncaughtException', (err) => logError('uncaught', err))

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 12 },
    backgroundColor: '#F5F0EB',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

ipcMain.handle('fs:readDirectory', async (_event, dirPath: string) => {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true })
    const results = entries
      .filter(entry => !entry.name.startsWith('.') || entry.name === '.claude')
      .map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        path: join(dirPath, entry.name)
      }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    return { ok: true, entries: results }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
  try {
    const content = await readFile(filePath, 'utf-8')
    return { ok: true, content }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select System Folder'
  })
  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, canceled: true }
  }
  return { ok: true, path: result.filePaths[0] }
})

ipcMain.handle('fs:stat', async (_event, filePath: string) => {
  try {
    const stats = await stat(filePath)
    return {
      ok: true,
      stats: {
        size: stats.size,
        isDirectory: stats.isDirectory(),
        modified: stats.mtime.toISOString(),
        created: stats.birthtime.toISOString()
      }
    }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string) => {
  try {
    await writeFile(filePath, content, 'utf-8')
    return { ok: true }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('git:status', async (_event, repoPath: string) => {
  try {
    const git = simpleGit(repoPath)
    const isRepo = await git.checkIsRepo()
    if (!isRepo) return { ok: false, error: 'Not a git repository' }

    const status = await git.status()
    return {
      ok: true,
      status: {
        current: status.current,
        tracking: status.tracking,
        ahead: status.ahead,
        behind: status.behind,
        staged: status.staged,
        modified: status.modified,
        not_added: status.not_added,
        deleted: status.deleted,
        renamed: status.renamed.map(r => ({ from: r.from, to: r.to })),
        conflicted: status.conflicted,
        isClean: status.isClean()
      }
    }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('git:branches', async (_event, repoPath: string) => {
  try {
    const git = simpleGit(repoPath)
    const isRepo = await git.checkIsRepo()
    if (!isRepo) return { ok: false, error: 'Not a git repository' }

    const branches = await git.branch()
    return {
      ok: true,
      branches: {
        current: branches.current,
        all: branches.all,
        branches: Object.fromEntries(
          Object.entries(branches.branches).map(([name, info]) => [
            name,
            { name: info.name, current: info.current, label: info.label }
          ])
        )
      }
    }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

// Get commits in the current branch that aren't in main (i.e. what this draft adds)
ipcMain.handle('git:draftChanges', async (_event, repoPath: string) => {
  try {
    const git = simpleGit(repoPath)
    const status = await git.status()
    const currentBranch = status.current
    if (!currentBranch) return { ok: false, error: 'No branch' }
    if (currentBranch === 'main' || currentBranch === 'master') {
      return { ok: true, commits: [], filesChanged: [] }
    }

    // Find the base branch (main or master)
    const branches = await git.branch()
    const baseBranch = branches.all.includes('main') ? 'main' : branches.all.includes('master') ? 'master' : null
    if (!baseBranch) return { ok: true, commits: [], filesChanged: [] }

    // Get commits in current branch that aren't in base, excluding merge commits
    const log = await git.log({ from: baseBranch, to: currentBranch })
    const commits = log.all
      .filter(entry => !entry.message.startsWith('Merge '))
      .map(entry => ({
        hash: entry.hash.substring(0, 8),
        date: entry.date,
        message: entry.message,
        author_name: entry.author_name
      }))

    // Get files changed between base and current
    let filesChanged: string[] = []
    try {
      const diff = await git.diff(['--name-only', `${baseBranch}...${currentBranch}`])
      filesChanged = diff.split('\n').filter(Boolean)
    } catch { /* ignore */ }

    return { ok: true, commits, filesChanged }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('git:log', async (_event, repoPath: string, maxCount: number = 20) => {
  try {
    const git = simpleGit(repoPath)
    const isRepo = await git.checkIsRepo()
    if (!isRepo) return { ok: false, error: 'Not a git repository' }

    const log = await git.log({ maxCount })
    return {
      ok: true,
      log: log.all.map(entry => ({
        hash: entry.hash.substring(0, 8),
        date: entry.date,
        message: entry.message,
        author_name: entry.author_name
      }))
    }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('git:save', async (_event, repoPath: string, message: string) => {
  try {
    const git = simpleGit(repoPath)
    await git.add('-A')
    const result = await git.commit(message)
    return { ok: true, summary: { changes: result.summary.changes, insertions: result.summary.insertions, deletions: result.summary.deletions } }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

// Publish = push the current branch, authenticated with the OAuth token via http.extraheader.
ipcMain.handle('git:publish', async (_event, repoPath: string) => {
  try {
    const git = simpleGit(repoPath)
    const branch = (await git.status()).current
    if (!branch) return { ok: false, error: 'No branch found' }
    const token = tokenStore().getToken()
    if (!token) return { ok: false, error: 'Not connected to GitHub' }
    await git.raw(['-c', `http.https://github.com/.extraheader=${buildAuthHeader(token)}`, 'push', 'origin', branch, '--set-upstream'])
    return { ok: true }
  } catch (error) {
    logError('publish', error)
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('git:createPR', async (_event, repoPath: string, title: string, body: string, reviewers: string[]) => {
  try {
    return { ok: true, ...(await github.createPR(repoPath, title, body, reviewers)) }
  } catch (error) {
    logError('createPR', error)
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('git:createDraft', async (_event, repoPath: string, draftName: string) => {
  try {
    const { branch, pulled } = await createDraftFromMain(repoPath, draftName)
    return { ok: true, branch, pulled }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

// Plain checkout — the renderer resolves any unsaved edits (Save-or-Discard) first; no silent stash.
ipcMain.handle('git:switchBranch', async (_event, repoPath: string, branch: string) => {
  try {
    await switchDraft(repoPath, branch)
    return { ok: true, branch }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

// Move uncommitted edits made on the Live Version into a new draft (Flow 2).
ipcMain.handle('git:createDraftFromChanges', async (_event, repoPath: string, draftName: string) => {
  try {
    const { branch } = await createDraftFromChanges(repoPath, draftName)
    return { ok: true, branch }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('git:refreshMain', async (_event, repoPath: string) => {
  try { return { ok: true, ...(await refreshMain(repoPath)) } }
  catch (error) { logError('refreshMain', error); return { ok: false, updated: false } }
})

ipcMain.handle('git:updateFromLive', async (_event, repoPath: string) => {
  try {
    return await updateFromLive(repoPath)
  } catch (error) {
    // An unexpected failure must not block publishing — treat as "nothing to update".
    logError('updateFromLive', error)
    return { ok: true, updated: false }
  }
})

// Branches the app could adopt as drafts (local + origin/*), excluding main/master.
ipcMain.handle('git:listAdoptableBranches', async (_event, repoPath: string) => {
  try {
    return { ok: true, branches: await listAdoptableBranches(repoPath) }
  } catch (error) {
    return { ok: false, error: String(error), branches: [] }
  }
})

ipcMain.handle('git:deleteBranch', async (_event, repoPath: string, branch: string) => {
  try {
    const git = simpleGit(repoPath)
    const status = await git.status()

    // Can't delete the current branch — switch to main first
    if (status.current === branch) {
      const branches = await git.branch()
      const mainBranch = branches.all.includes('main') ? 'main' : branches.all.includes('master') ? 'master' : null
      if (!mainBranch) return { ok: false, error: 'No main branch to switch to' }
      await git.checkout(mainBranch)
    }

    // Force delete since the branch may not be fully merged
    await git.branch(['-D', branch])
    return { ok: true }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('git:discard', async (_event, repoPath: string) => {
  try {
    const git = simpleGit(repoPath)
    await git.checkout(['.'])
    await git.clean('f', ['-d'])
    return { ok: true }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

// --- GitHub PR operations, now over the REST API using the OAuth token ---

ipcMain.handle('git:prStatus', async (_event, repoPath: string) => {
  try { return { ok: true, ...(await github.prStatus(repoPath)) } } catch { return { ok: true, hasPR: false } }
})

ipcMain.handle('git:checkMerged', async (_event, repoPath: string) => {
  try { return { ok: true, ...(await github.checkMerged(repoPath)) } } catch { return { ok: true, merged: false } }
})

ipcMain.handle('git:listPRs', async (_event, repoPath: string) => {
  try { return { ok: true, prs: await github.listPRs(repoPath) } } catch { return { ok: true, prs: [] } }
})

ipcMain.handle('git:prDiff', async (_event, repoPath: string, prNumber: number) => {
  try { return { ok: true, files: await github.prFiles(repoPath, prNumber) } } catch (error) { return { ok: false, error: String(error), files: [] } }
})

ipcMain.handle('git:fileWatchers', async (_event, repoPath: string, relPath: string) => {
  try { return { ok: true, watchers: await github.fileWatchers(repoPath, relPath) } }
  catch { return { ok: true, watchers: [] } }
})

ipcMain.handle('git:reviewRequestCount', async (_event, repoPath: string, login: string) => {
  try { return { ok: true, count: await github.reviewRequestCount(repoPath, login) } }
  catch { return { ok: true, count: 0 } }
})

ipcMain.handle('git:prFileDiff', async (_event, repoPath: string, prNumber: number, filePath: string) => {
  try { return { ok: true, ...(await github.prFileDiff(repoPath, prNumber, filePath)) } } catch (error) { return { ok: false, error: String(error), lines: [] } }
})

ipcMain.handle('git:prFileContent', async (_event, repoPath: string, prNumber: number, filePath: string) => {
  try { return { ok: true, ...(await github.prFileContent(repoPath, prNumber, filePath)) } } catch (error) { return { ok: false, content: '', error: String(error) } }
})

ipcMain.handle('git:reviewPR', async (_event, repoPath: string, prNumber: number, action: 'approve' | 'request-changes', body: string) => {
  try { await github.reviewPR(repoPath, prNumber, action, body); return { ok: true } } catch (error) { logError('review', error); return { ok: false, error: String(error) } }
})

// --- Diagnostics (local logs, for support/screenshare debugging) ---

ipcMain.handle('diagnostics:recent', async () => {
  try {
    const text = await readFile(logFilePath(), 'utf-8')
    return { ok: true, text: text.split('\n').slice(-200).join('\n') }
  } catch (error) { return { ok: false, error: String(error), text: '' } }
})

ipcMain.handle('diagnostics:reveal', async () => {
  try { shell.showItemInFolder(logFilePath()); return { ok: true } }
  catch (error) { return { ok: false, error: String(error) } }
})

// --- Re-sync from GitHub (Settings-only escape hatch) ---

ipcMain.handle('git:hasUnpublishedWork', async (_event, repoPath: string) => {
  try { return { ok: true, hasWork: await hasUnpublishedWork(repoPath) } }
  catch (error) { logError('resync', error); return { ok: false, hasWork: false, error: String(error) } }
})

ipcMain.handle('git:resyncFromLive', async (_event, repoPath: string) => {
  try { await resyncFromLive(repoPath); return { ok: true } }
  catch (error) { logError('resync', error); return { ok: false, error: String(error) } }
})

// --- GitHub OAuth device flow ---

ipcMain.handle('auth:startDeviceFlow', async () => {
  try { return { ok: true, ...(await startDeviceFlow()) } } catch (e) { logError('auth', e); return { ok: false, error: String(e) } }
})
ipcMain.handle('auth:pollToken', async (_e, deviceCode: string, interval: number) => {
  try { const r = await pollForToken(deviceCode, interval); return { ...r, connected: r.ok } } catch (e) { logError('auth', e); return { ok: false, error: String(e) } }
})
ipcMain.handle('auth:identity', async () => {
  try { return { ok: true, identity: await getIdentity() } } catch { return { ok: true, identity: null } }
})
ipcMain.handle('auth:status', async () => ({ connected: tokenStore().getToken() !== null, everConnected: tokenStore().hasEverConnected() }))
ipcMain.handle('auth:signOut', async () => { tokenStore().clearToken(); return { ok: true } })

ipcMain.handle('github:collaborators', async (_e, repoPath: string) => {
  try { return { ok: true, collaborators: await github.collaborators(repoPath) } } catch (e) { return { ok: false, error: String(e), collaborators: [] } }
})

// Probe what this system can do: is it a git repo, and is GitHub connected (token present)?
ipcMain.handle('system:capabilities', async (_event, repoPath: string) => {
  let isGitRepo = false
  try { isGitRepo = await simpleGit(repoPath).checkIsRepo() } catch { isGitRepo = false }
  return { ok: true, isGitRepo, connected: tokenStore().getToken() !== null }
})

// Watch the active system folder and push change batches to the renderer.
ipcMain.handle('fs:watch', async (_event, repoPath: string) => {
  try {
    await startWatch(repoPath, (paths) => {
      mainWindow?.webContents.send('fs:changed', paths)
    })
    return { ok: true }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('fs:unwatch', async () => {
  stopWatch()
  return { ok: true }
})

ipcMain.handle('fs:mkdir', async (_event, path: string) => {
  try { await ensureDir(path); return { ok: true } } catch (error) { return { ok: false, error: String(error) } }
})
ipcMain.handle('fs:createFile', async (_event, path: string, content: string) => {
  try { await createFile(path, content); return { ok: true } } catch (error) { return { ok: false, error: String((error as Error).message || error) } }
})
ipcMain.handle('fs:move', async (_event, from: string, to: string) => {
  try { await movePath(from, to); return { ok: true } } catch (error) { return { ok: false, error: String((error as Error).message || error) } }
})
ipcMain.handle('fs:delete', async (_event, path: string) => {
  try { await delPath(path); return { ok: true } } catch (error) { return { ok: false, error: String((error as Error).message || error) } }
})
ipcMain.handle('fs:listFolders', async (_event, root: string) => {
  try { return { ok: true, folders: await listFolders(root) } } catch (error) { return { ok: false, error: String(error), folders: [] } }
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.parrotlabs.amp-up')
  // Packaged builds get the icon from electron-builder; in dev, brand the dock icon too.
  if (is.dev && process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(join(__dirname, '../../build/icon.png'))
  }
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  createWindow()
  setupAutoUpdate(mainWindow)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
