import { contextBridge, ipcRenderer } from 'electron'

const api = {
  fs: {
    readDirectory: (path: string) => ipcRenderer.invoke('fs:readDirectory', path),
    readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
    writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content),
    stat: (path: string) => ipcRenderer.invoke('fs:stat', path),
    watch: (path: string) => ipcRenderer.invoke('fs:watch', path),
    unwatch: () => ipcRenderer.invoke('fs:unwatch'),
    mkdir: (path: string) => ipcRenderer.invoke('fs:mkdir', path),
    createFile: (path: string, content: string) => ipcRenderer.invoke('fs:createFile', path, content),
    move: (from: string, to: string) => ipcRenderer.invoke('fs:move', from, to),
    delete: (path: string) => ipcRenderer.invoke('fs:delete', path),
    listFolders: (root: string) => ipcRenderer.invoke('fs:listFolders', root),
    onChanged: (cb: (paths: string[]) => void) => {
      const handler = (_e: unknown, paths: string[]) => cb(paths)
      ipcRenderer.on('fs:changed', handler)
      return () => ipcRenderer.removeListener('fs:changed', handler)
    },
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
    createDraftFromChanges: (repoPath: string, draftName: string) => ipcRenderer.invoke('git:createDraftFromChanges', repoPath, draftName),
    listAdoptableBranches: (repoPath: string) => ipcRenderer.invoke('git:listAdoptableBranches', repoPath),
    switchBranch: (repoPath: string, branch: string) => ipcRenderer.invoke('git:switchBranch', repoPath, branch),
    deleteBranch: (repoPath: string, branch: string) => ipcRenderer.invoke('git:deleteBranch', repoPath, branch),
    discard: (repoPath: string) => ipcRenderer.invoke('git:discard', repoPath),
    prStatus: (repoPath: string) => ipcRenderer.invoke('git:prStatus', repoPath),
    checkMerged: (repoPath: string) => ipcRenderer.invoke('git:checkMerged', repoPath),
    listPRs: (repoPath: string) => ipcRenderer.invoke('git:listPRs', repoPath),
    prDiff: (repoPath: string, prNumber: number) => ipcRenderer.invoke('git:prDiff', repoPath, prNumber),
    prFileDiff: (repoPath: string, prNumber: number, filePath: string) => ipcRenderer.invoke('git:prFileDiff', repoPath, prNumber, filePath),
    prFileContent: (repoPath: string, prNumber: number, filePath: string) => ipcRenderer.invoke('git:prFileContent', repoPath, prNumber, filePath),
    reviewPR: (repoPath: string, prNumber: number, action: string, body: string) => ipcRenderer.invoke('git:reviewPR', repoPath, prNumber, action, body),
  },
  system: {
    capabilities: (repoPath: string) => ipcRenderer.invoke('system:capabilities', repoPath),
  },
  auth: {
    startDeviceFlow: () => ipcRenderer.invoke('auth:startDeviceFlow'),
    pollToken: (deviceCode: string, interval: number) => ipcRenderer.invoke('auth:pollToken', deviceCode, interval),
    identity: () => ipcRenderer.invoke('auth:identity'),
    status: () => ipcRenderer.invoke('auth:status'),
    signOut: () => ipcRenderer.invoke('auth:signOut'),
  },
  github: {
    collaborators: (repoPath: string) => ipcRenderer.invoke('github:collaborators', repoPath),
  }
}

contextBridge.exposeInMainWorld('api', api)
