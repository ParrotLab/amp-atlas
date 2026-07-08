declare module '*.css' {
  const css: string
  export default css
}

declare module '*?raw' {
  const src: string
  export default src
}

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
    watch: (path: string) => Promise<{ ok: boolean; error?: string }>
    unwatch: () => Promise<{ ok: boolean }>
    onChanged: (cb: (paths: string[]) => void) => () => void
    mkdir: (path: string) => Promise<{ ok: boolean; error?: string }>
    createFile: (path: string, content: string) => Promise<{ ok: boolean; error?: string }>
    move: (from: string, to: string) => Promise<{ ok: boolean; error?: string }>
    delete: (path: string) => Promise<{ ok: boolean; error?: string }>
    listFolders: (root: string) => Promise<{ ok: boolean; error?: string; folders: string[] }>
  }
  dialog: {
    selectFolder: () => Promise<{ ok: boolean; canceled?: boolean; path?: string }>
  }
  git: {
    status: (repoPath: string) => Promise<{ ok: boolean; error?: string; status?: GitStatus }>
    branches: (repoPath: string) => Promise<{ ok: boolean; error?: string; branches?: GitBranches }>
    log: (repoPath: string, maxCount?: number) => Promise<{ ok: boolean; error?: string; log?: GitLogEntry[] }>
    draftChanges: (repoPath: string) => Promise<{ ok: boolean; error?: string; commits?: GitLogEntry[]; filesChanged?: string[] }>
    save: (repoPath: string, message: string) => Promise<{ ok: boolean; error?: string; summary?: { changes: number; insertions: number; deletions: number } }>
    publish: (repoPath: string) => Promise<{ ok: boolean; error?: string }>
    createPR: (repoPath: string, title: string, body: string, reviewers: string[]) => Promise<{ ok: boolean; error?: string; url?: string; alreadyExists?: boolean }>
    createDraft: (repoPath: string, draftName: string) => Promise<{ ok: boolean; error?: string; branch?: string; pulled?: boolean }>
    createDraftFromChanges: (repoPath: string, draftName: string) => Promise<{ ok: boolean; error?: string; branch?: string }>
    listAdoptableBranches: (repoPath: string) => Promise<{ ok: boolean; error?: string; branches: { name: string; isRemoteOnly: boolean }[] }>
    switchBranch: (repoPath: string, branch: string) => Promise<{ ok: boolean; error?: string }>
    deleteBranch: (repoPath: string, branch: string) => Promise<{ ok: boolean; error?: string }>
    discard: (repoPath: string) => Promise<{ ok: boolean; error?: string }>
    prStatus: (repoPath: string) => Promise<{ ok: boolean; hasPR: boolean; pr?: { number: number; title: string; url: string; state: string; reviewDecision: string | null } }>
    checkMerged: (repoPath: string) => Promise<{ ok: boolean; merged: boolean; branch?: string }>
    listPRs: (repoPath: string) => Promise<{ ok: boolean; prs: Array<{ number: number; title: string; state: string; author: { login: string; name: string }; createdAt: string; headRefName: string; reviewDecision: string | null; url: string; additions: number; deletions: number; changedFiles: number }> }>
    prDiff: (repoPath: string, prNumber: number) => Promise<{ ok: boolean; files: string[]; error?: string }>
    prFileDiff: (repoPath: string, prNumber: number, filePath: string) => Promise<{ ok: boolean; lines: Array<{ type: string; content: string }>; error?: string }>
    prFileContent: (repoPath: string, prNumber: number, filePath: string) => Promise<{ ok: boolean; content: string; error?: string }>
    reviewPR: (repoPath: string, prNumber: number, action: string, body: string) => Promise<{ ok: boolean; error?: string }>
  }
  system: {
    capabilities: (repoPath: string) => Promise<{
      ok: boolean; isGitRepo: boolean; ghAvailable: boolean; ghAuthed: boolean
    }>
  }
}

interface Window {
  api: ElectronAPI
}
