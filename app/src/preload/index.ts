import { contextBridge, ipcRenderer } from 'electron'

const api = {
  fs: {
    readDirectory: (path: string) => ipcRenderer.invoke('fs:readDirectory', path),
    readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
    writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content),
    stat: (path: string) => ipcRenderer.invoke('fs:stat', path),
  },
  dialog: {
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  },
  git: {
    status: (repoPath: string) => ipcRenderer.invoke('git:status', repoPath),
    branches: (repoPath: string) => ipcRenderer.invoke('git:branches', repoPath),
    log: (repoPath: string, maxCount?: number) => ipcRenderer.invoke('git:log', repoPath, maxCount),
  }
}

contextBridge.exposeInMainWorld('api', api)
