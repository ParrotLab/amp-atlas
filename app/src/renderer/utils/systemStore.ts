interface SystemConfig {
  id: string
  name: string
  folderPath: string
  icon: string
  gradient: string
}

const STORAGE_KEY = 'amp-up-systems-v2' // Bumped to pick up new Delivery System

const defaultSystems: SystemConfig[] = [
  { id: 'learning', name: 'Learning System', folderPath: '', icon: 'book', gradient: 'linear-gradient(135deg, #8B2BFF, #A855FF)' },
  { id: 'marketing', name: 'Marketing System', folderPath: '', icon: 'monitor', gradient: 'linear-gradient(135deg, #FF7B00, #FFB875)' },
  { id: 'ai-ops', name: 'AI Operations', folderPath: '', icon: 'layers', gradient: 'linear-gradient(135deg, #3D0052, #7A3D8F)' },
  { id: 'delivery', name: 'Delivery System', folderPath: '', icon: 'book', gradient: 'linear-gradient(135deg, #16A34A, #22C55E)' },
]

export function getSystems(): SystemConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {
    // ignore parse errors
  }
  return defaultSystems
}

export function saveSystems(systems: SystemConfig[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(systems))
}

export function updateSystemFolder(systemId: string, folderPath: string): SystemConfig[] {
  const systems = getSystems()
  const updated = systems.map(s => s.id === systemId ? { ...s, folderPath } : s)
  saveSystems(updated)
  return updated
}

export function getSystem(systemId: string): SystemConfig | undefined {
  return getSystems().find(s => s.id === systemId)
}

export type { SystemConfig }
