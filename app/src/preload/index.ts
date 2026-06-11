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
    draftChanges: (repoPath: string) => ipcRenderer.invoke('git:draftChanges', repoPath),
    save: (repoPath: string, message: string) => ipcRenderer.invoke('git:save', repoPath, message),
    publish: (repoPath: string) => ipcRenderer.invoke('git:publish', repoPath),
    createPR: (repoPath: string, title: string, body: string, reviewers: string[]) => ipcRenderer.invoke('git:createPR', repoPath, title, body, reviewers),
    createDraft: (repoPath: string, draftName: string) => ipcRenderer.invoke('git:createDraft', repoPath, draftName),
    switchBranch: (repoPath: string, branch: string) => ipcRenderer.invoke('git:switchBranch', repoPath, branch),
    discard: (repoPath: string) => ipcRenderer.invoke('git:discard', repoPath),
  }
}

contextBridge.exposeInMainWorld('api', api)
