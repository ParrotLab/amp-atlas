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

ipcMain.handle('git:publish', async (_event, repoPath: string) => {
  try {
    const git = simpleGit(repoPath)
    const status = await git.status()
    const branch = status.current
    if (!branch) return { ok: false, error: 'No branch found' }
    await git.push('origin', branch, ['--set-upstream'])
    return { ok: true }
  } catch (error) {
    return { ok: false, error: String(error) }
  }
})

// Create a GitHub PR using the gh CLI
// TODO: Replace with GitHub OAuth + REST API before shipping to non-technical users
ipcMain.handle('git:createPR', async (_event, repoPath: string, title: string, body: string, reviewers: string[]) => {
  const { execFile } = await import('child_process')
  const { promisify } = await import('util')
  const exec = promisify(execFile)

  try {
    const args = ['pr', 'create', '--title', title, '--body', body || '']

    // Add reviewers if specified (need GitHub usernames — for now we skip if names don't map)
    // TODO: Map display names to GitHub usernames via team config
    if (reviewers.length > 0) {
      // For now, skip reviewers since we'd need GitHub usernames
      // args.push('--reviewer', reviewers.join(','))
    }

    const result = await exec('/opt/homebrew/bin/gh', args, { cwd: repoPath })
    const prUrl = result.stdout.trim()
    return { ok: true, url: prUrl }
  } catch (error: unknown) {
    const err = error as { stderr?: string; message?: string }
    // gh might say "already exists" if a PR is already open
    if (err.stderr?.includes('already exists')) {
      return { ok: true, url: '', alreadyExists: true }
    }
    return { ok: false, error: err.stderr || err.message || String(error) }
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
    const fromBranch = statusBefore.current || 'unknown'

    // Stash any uncommitted changes tagged with the branch name
    if (!statusBefore.isClean()) {
      await git.add('-A')
      try {
        await git.stash(['push', '--include-untracked', '-m', `amp-auto:${fromBranch}`])
      } catch {
        // If stash fails, try to continue anyway
      }
    }

    await git.checkout(branch)

    // Look for a stash belonging to the target branch and restore it
    try {
      const stashList = await git.stashList()
      const matchIdx = stashList.all.findIndex(s => s.message.includes(`amp-auto:${branch}`))
      if (matchIdx >= 0) {
        await git.stash(['pop', `stash@{${matchIdx}}`])
      }
    } catch {
      // Stash pop might conflict — that's okay, changes are still in the stash
    }

    const statusAfter = await git.status()
    return { ok: true, branch: statusAfter.current }
  } catch (error) {
    return { ok: false, error: String(error) }
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

// Check PR status for the current branch
ipcMain.handle('git:prStatus', async (_event, repoPath: string) => {
  const { execFile } = await import('child_process')
  const { promisify } = await import('util')
  const exec = promisify(execFile)

  try {
    const git = simpleGit(repoPath)
    const status = await git.status()
    const branch = status.current
    if (!branch || branch === 'main' || branch === 'master') {
      return { ok: true, hasPR: false }
    }

    // Check for open PR on this branch
    const result = await exec('/opt/homebrew/bin/gh', [
      'pr', 'view', '--json', 'state,title,url,reviewDecision,number', '--jq', '.'
    ], { cwd: repoPath })

    const pr = JSON.parse(result.stdout.trim())
    return {
      ok: true,
      hasPR: true,
      pr: {
        number: pr.number,
        title: pr.title,
        url: pr.url,
        state: pr.state, // OPEN, CLOSED, MERGED
        reviewDecision: pr.reviewDecision || null // APPROVED, CHANGES_REQUESTED, REVIEW_REQUIRED, null
      }
    }
  } catch {
    // No PR exists for this branch
    return { ok: true, hasPR: false }
  }
})

// Check if the current branch has been merged and clean up
ipcMain.handle('git:checkMerged', async (_event, repoPath: string) => {
  const { execFile } = await import('child_process')
  const { promisify } = await import('util')
  const exec = promisify(execFile)

  try {
    const git = simpleGit(repoPath)
    const status = await git.status()
    const branch = status.current
    if (!branch || branch === 'main' || branch === 'master') {
      return { ok: true, merged: false }
    }

    // Check if PR was merged
    const result = await exec('/opt/homebrew/bin/gh', [
      'pr', 'view', '--json', 'state', '--jq', '.state'
    ], { cwd: repoPath })

    const state = result.stdout.trim()
    return { ok: true, merged: state === 'MERGED', branch }
  } catch {
    return { ok: true, merged: false }
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
