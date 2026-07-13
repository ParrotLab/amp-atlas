import { app, dialog, BrowserWindow } from 'electron'
// electron-updater is CommonJS (no default export) — use a named import.
import { autoUpdater } from 'electron-updater'
import { logError } from './logger'

/** Wire auto-updates. Only meaningful in a packaged build. */
export function setupAutoUpdate(win: BrowserWindow | null): void {
  if (!app.isPackaged) return // never in dev

  // The releases repo is public, so no auth/token is needed to check for or download updates.
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', async () => {
    const { response } = await dialog.showMessageBox(win!, {
      type: 'info',
      buttons: ['Restart', 'Later'],
      defaultId: 0,
      title: 'Update ready',
      message: 'A new version of AMP Atlas is ready.',
      detail: 'Restart to update now, or it will install the next time you quit.',
    })
    if (response === 0) autoUpdater.quitAndInstall()
  })

  autoUpdater.on('error', (err) => {
    // Non-fatal: log and retry next launch; never interrupt the user.
    logError('updater', err)
  })

  autoUpdater.checkForUpdates().catch(err => logError('updater', err))
}
