import { promises as fs } from 'fs'
import { join } from 'path'

/** A leftover index.lock older than this is treated as stale (a crashed/interrupted git op).
 *  Atlas serializes its own git operations and they finish in well under a second, so a lock
 *  this old is not a real in-progress operation. */
export const STALE_LOCK_MS = 5000

/**
 * Remove a leftover `.git/index.lock` if it's stale, so a crashed or interrupted git process
 * doesn't wedge the repo ("Unable to create index.lock: File exists"). A *fresh* lock (younger
 * than STALE_LOCK_MS) is left alone in case an operation is genuinely mid-flight.
 *
 * `now` is injectable for testing. Returns true if a stale lock was cleared.
 */
export async function clearStaleIndexLock(repoPath: string, now: number = Date.now()): Promise<boolean> {
  const lockPath = join(repoPath, '.git', 'index.lock')
  try {
    const st = await fs.stat(lockPath)
    if (now - st.mtimeMs >= STALE_LOCK_MS) {
      await fs.rm(lockPath, { force: true })
      return true
    }
  } catch {
    // No lock file (the common case), or the path isn't accessible — nothing to clear.
  }
  return false
}
