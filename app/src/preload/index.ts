import { contextBridge, ipcRenderer } from 'electron'

const api = {
  fs: {
    readDirectory: (path: string) => ipcRenderer.invoke('fs:readDirectory', path),
    readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
    stat: (path: string) => ipcRenderer.invoke('fs:stat', path),
  },
  dialog: {
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  }
}

contextBridge.exposeInMainWorld('api', api)
