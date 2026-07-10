// Remembers which files were open in each system, so reopening a system restores its tabs.
export interface StoredTab { path: string; name: string }
interface StoredTabs { tabs: StoredTab[]; active?: string }

const KEY = (systemId: string) => `amp.tabs.${systemId}`

export function getStoredTabs(systemId: string): StoredTabs | null {
  try {
    const v = localStorage.getItem(KEY(systemId))
    return v ? JSON.parse(v) as StoredTabs : null
  } catch {
    return null
  }
}

export function setStoredTabs(systemId: string, data: StoredTabs): void {
  localStorage.setItem(KEY(systemId), JSON.stringify(data))
}
