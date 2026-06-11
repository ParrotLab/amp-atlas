import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readdir, readFile, writeFile, stat } from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { simpleGit } from 'simple-git'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
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

ipcMain.handle('git:publish', async (_event, repoPath: string) => {
  try {
    const git = simpleGit(repoPath)
    const status = await git.status()
    const branch = status.current
    if (!branch) return { ok: false, error: 'No branch found' }
    // Set upstream if needed, then push
    await git.push('origin', branch, ['--set-upstream'])
    return { ok: true }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('git:createDraft', async (_event, repoPath: string, draftName: string) => {
  try {
    const git = simpleGit(repoPath)
    // Slugify: "My Cool Draft" -> "draft/my-cool-draft"
    const slug = 'draft/' + draftName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    await git.checkoutLocalBranch(slug)
    return { ok: true, branch: slug }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

ipcMain.handle('git:switchBranch', async (_event, repoPath: string, branch: string) => {
  try {
    const git = simpleGit(repoPath)
    const statusBefore = await git.status()

    // Auto-commit any uncommitted changes so nothing is lost
    if (!statusBefore.isClean()) {
      await git.add('-A')
      await git.commit('Work in progress (auto-saved)')
    }

    await git.checkout(branch)

    const statusAfter = await git.status()
    return { ok: true, branch: statusAfter.current }
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

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.parrotlabs.amp-up')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
