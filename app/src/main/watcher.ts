import chokidar, { FSWatcher } from 'chokidar'

export function shouldIgnore(p: string): boolean {
  return /(^|\/)\.git(\/|$)/.test(p) || /(^|\/)node_modules(\/|$)/.test(p)
}

let watcher: FSWatcher | null = null
let debounceTimer: ReturnType<typeof setTimeout> | undefined
const pending = new Set<string>()

/** Watch repoPath and call onChange with a debounced batch of changed absolute paths. Resolves when ready. */
export function startWatch(repoPath: string, onChange: (paths: string[]) => void): Promise<void> {
  stopWatch()
  return new Promise<void>((resolve) => {
    watcher = chokidar.watch(repoPath, {
      ignored: (p: string) => shouldIgnore(p),
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 20 },
    })
    watcher.on('all', (_event, path) => {
      pending.add(path)
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        const batch = [...pending]
        pending.clear()
        onChange(batch)
      }, 200)
    })
    watcher.on('ready', () => resolve())
  })
}

export function stopWatch(): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  pending.clear()
  if (watcher) { watcher.close(); watcher = null }
}
