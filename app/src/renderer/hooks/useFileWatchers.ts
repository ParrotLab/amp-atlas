import { useState, useEffect, useCallback } from 'react'

export interface Watcher { number: number; author: string; title: string; branch: string }

// Session cache keyed by (root, relPath) so re-opening a file shows instantly before the refresh lands.
const cache = new Map<string, Watcher[]>()

/** Open-PR "watchers" for the currently open file. Refreshes on file change and on window focus. */
export function useFileWatchers(filePath: string | undefined, rootPath: string): Watcher[] {
  const [watchers, setWatchers] = useState<Watcher[]>([])
  const relPath = filePath && rootPath ? filePath.replace(rootPath + '/', '') : ''

  const refresh = useCallback(async () => {
    if (!relPath || !rootPath) { setWatchers([]); return }
    const r = await window.api.git.fileWatchers(rootPath, relPath)
    const list = r.ok ? r.watchers : []
    cache.set(rootPath + '::' + relPath, list)
    setWatchers(list)
  }, [relPath, rootPath])

  useEffect(() => {
    if (!relPath) { setWatchers([]); return }
    const cached = cache.get(rootPath + '::' + relPath)
    setWatchers(cached ?? [])          // instant (or clear) on file switch
    void refresh()                     // then refresh from GitHub
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [relPath, rootPath, refresh])

  return watchers
}
