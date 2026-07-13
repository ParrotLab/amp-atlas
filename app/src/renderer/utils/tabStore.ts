// Remembers which files were open in each system *per branch*, so switching Drafts (or reopening
// a system) restores the tabs you had open the last time that branch was active.
export interface StoredTab { path: string; name: string }
interface StoredTabs { tabs: StoredTab[]; active?: string }

const KEY = (systemId: string, branch: string) => `amp.tabs.${systemId}.${branch}`

export function getStoredTabs(systemId: string, branch: string): StoredTabs | null {
  try {
    const v = localStorage.getItem(KEY(systemId, branch))
    return v ? JSON.parse(v) as StoredTabs : null
  } catch {
    return null
  }
}

export function setStoredTabs(systemId: string, branch: string, data: StoredTabs): void {
  try { localStorage.setItem(KEY(systemId, branch), JSON.stringify(data)) } catch { /* quota / disabled — ignore */ }
}

export function clearStoredTabs(systemId: string, branch: string): void {
  try { localStorage.removeItem(KEY(systemId, branch)) } catch { /* ignore */ }
}
