interface SystemConfig {
  id: string
  name: string
  folderPath: string
  icon: string
  gradient: string
}

const STORAGE_KEY = 'amp-up-systems-v2'

// No seeded systems — every user (including dev) starts blank and adds their own.
const defaultSystems: SystemConfig[] = []

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

export function addSystem(name: string, icon: string, gradient: string): SystemConfig[] {
  const systems = getSystems()
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  systems.push({ id, name, folderPath: '', icon, gradient })
  saveSystems(systems)
  return systems
}

export function removeSystem(systemId: string): SystemConfig[] {
  const systems = getSystems().filter(s => s.id !== systemId)
  saveSystems(systems)
  return systems
}

export function updateSystem(systemId: string, updates: Partial<SystemConfig>): SystemConfig[] {
  const systems = getSystems().map(s => s.id === systemId ? { ...s, ...updates } : s)
  saveSystems(systems)
  return systems
}

export type { SystemConfig }
