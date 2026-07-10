import { useState, useEffect, useCallback } from 'react'
import { getStoredName, setStoredName, PROFILE_CHANGED_EVENT } from '../utils/userProfile'

export interface Profile {
  /** Best display name: locally-set name, else GitHub name, else the login. */
  name: string
  login: string
  avatarUrl: string
  /** True when connected but we have no name to show — prompt the user for one. */
  needsName: boolean
  saveName: (name: string) => void
  reload: () => void
}

/** The current user's identity for display: GitHub name/login, with a local name fallback. */
export function useProfile(): Profile {
  const [identity, setIdentity] = useState<{ login: string; name: string | null; avatarUrl: string } | null>(null)
  const [stored, setStored] = useState(getStoredName())

  const reload = useCallback(async () => {
    const r = await window.api.auth.identity()
    setIdentity(r.identity)
  }, [])
  useEffect(() => { void reload() }, [reload])

  // Keep in sync across every component using this hook when the name is saved.
  useEffect(() => {
    const h = () => setStored(getStoredName())
    window.addEventListener(PROFILE_CHANGED_EVENT, h)
    return () => window.removeEventListener(PROFILE_CHANGED_EVENT, h)
  }, [])

  const login = identity?.login || ''
  const ghName = identity?.name || ''
  const name = stored || ghName || login
  const needsName = !!identity && !stored && !ghName

  return {
    name,
    login,
    avatarUrl: identity?.avatarUrl || '',
    needsName,
    saveName: (n: string) => setStoredName(n),
    reload,
  }
}
