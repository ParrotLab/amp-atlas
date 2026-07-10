// Tracks when each system's Live Version was last refreshed from GitHub.
const KEY = (folder: string) => `amp.lastPull.${folder}`

export function getLastPull(folder: string): number | null {
  const v = localStorage.getItem(KEY(folder))
  return v ? Number(v) : null
}

export function setLastPull(folder: string, ts: number): void {
  localStorage.setItem(KEY(folder), String(ts))
}

/** Human "X ago" from a timestamp (ms). Empty string when never pulled. */
export function relativeTime(ts: number | null, nowMs: number): string {
  if (!ts) return ''
  const s = Math.max(0, Math.floor((nowMs - ts) / 1000))
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}
