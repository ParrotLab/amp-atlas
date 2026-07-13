import { useState, useEffect, useCallback } from 'react'

/** Fire on any auth change (e.g. sign out) so the connect gate re-checks immediately. */
export const AUTH_CHANGED_EVENT = 'amp:auth-changed'

export function useAuth() {
  const [status, setStatus] = useState<{ connected: boolean; everConnected: boolean } | null>(null)

  const refresh = useCallback(async () => {
    setStatus(await window.api.auth.status())
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // Re-check when auth changes anywhere (sign out), so the app re-gates to Connect.
  useEffect(() => {
    const h = () => { void refresh() }
    window.addEventListener(AUTH_CHANGED_EVENT, h)
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, h)
  }, [refresh])

  return { status, refresh }
}
