export type DraftState = 'active' | 'archived'

export interface DraftEntry {
  branch: string
  title: string
  state: DraftState
  createdAt: string
  lastOpenedAt: string
}

type Store = Record<string, Record<string, DraftEntry>> // systemId -> branch -> entry

const KEY = 'amp-drafts-v1'

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return {}
}

function write(store: Store): void {
  localStorage.setItem(KEY, JSON.stringify(store))
}

export function getDrafts(systemId: string): DraftEntry[] {
  return Object.values(read()[systemId] || {})
}

export function getDraft(systemId: string, branch: string): DraftEntry | undefined {
  return read()[systemId]?.[branch]
}

export function listActive(systemId: string): DraftEntry[] {
  return getDrafts(systemId).filter(d => d.state === 'active')
}

export function listArchived(systemId: string): DraftEntry[] {
  return getDrafts(systemId).filter(d => d.state === 'archived')
}

/** Upsert a draft as active; refresh title + timestamps. */
export function registerDraft(systemId: string, branch: string, title: string): DraftEntry {
  const store = read()
  const now = new Date().toISOString()
  const existing = store[systemId]?.[branch]
  const entry: DraftEntry = {
    branch,
    title,
    state: 'active',
    createdAt: existing?.createdAt || now,
    lastOpenedAt: now,
  }
  store[systemId] = { ...(store[systemId] || {}), [branch]: entry }
  write(store)
  return entry
}

export function setDraftState(systemId: string, branch: string, state: DraftState): void {
  const store = read()
  const entry = store[systemId]?.[branch]
  if (!entry) return
  entry.state = state
  write(store)
}

export function touchDraft(systemId: string, branch: string): void {
  const store = read()
  const entry = store[systemId]?.[branch]
  if (!entry) return
  entry.lastOpenedAt = new Date().toISOString()
  write(store)
}

export function removeDraft(systemId: string, branch: string): void {
  const store = read()
  if (store[systemId]) {
    delete store[systemId][branch]
    write(store)
  }
}
