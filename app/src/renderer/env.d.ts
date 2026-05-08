declare module '*.svg' {
  const src: string
  export default src
}

declare module '*.png' {
  const src: string
  export default src
}

interface FileEntry {
  name: string
  isDirectory: boolean
  path: string
}

interface FsResult<T = unknown> {
  ok: boolean
  error?: string
  entries?: T[]
  content?: string
  stats?: {
    size: number
    isDirectory: boolean
    modified: string
    created: string
  }
}

interface ElectronAPI {
  fs: {
    readDirectory: (path: string) => Promise<FsResult<FileEntry>>
    readFile: (path: string) => Promise<FsResult>
    stat: (path: string) => Promise<FsResult>
  }
}

interface Window {
  api: ElectronAPI
}
