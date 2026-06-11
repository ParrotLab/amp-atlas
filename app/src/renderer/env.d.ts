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

interface GitStatus {
  current: string | null
  tracking: string | null
  ahead: number
  behind: number
  staged: string[]
  modified: string[]
  not_added: string[]
  deleted: string[]
  renamed: { from: string; to: string }[]
  conflicted: string[]
  isClean: boolean
}

interface GitBranches {
  current: string
  all: string[]
  branches: Record<string, { name: string; current: boolean; label: string }>
}

interface GitLogEntry {
  hash: string
  date: string
  message: string
  author_name: string
}

interface ElectronAPI {
  fs: {
    readDirectory: (path: string) => Promise<FsResult<FileEntry>>
    readFile: (path: string) => Promise<FsResult>
    writeFile: (path: string, content: string) => Promise<{ ok: boolean; error?: string }>
    stat: (path: string) => Promise<FsResult>
  }
  dialog: {
    selectFolder: () => Promise<{ ok: boolean; canceled?: boolean; path?: string }>
  }
  git: {
    status: (repoPath: string) => Promise<{ ok: boolean; error?: string; status?: GitStatus }>
    branches: (repoPath: string) => Promise<{ ok: boolean; error?: string; branches?: GitBranches }>
    log: (repoPath: string, maxCount?: number) => Promise<{ ok: boolean; error?: string; log?: GitLogEntry[] }>
    save: (repoPath: string, message: string) => Promise<{ ok: boolean; error?: string; summary?: { changes: number; insertions: number; deletions: number } }>
    publish: (repoPath: string) => Promise<{ ok: boolean; error?: string }>
    createDraft: (repoPath: string, draftName: string) => Promise<{ ok: boolean; error?: string; branch?: string }>
    switchBranch: (repoPath: string, branch: string) => Promise<{ ok: boolean; error?: string }>
    discard: (repoPath: string) => Promise<{ ok: boolean; error?: string }>
  }
}

interface Window {
  api: ElectronAPI
}
