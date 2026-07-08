import { useState, useEffect, useCallback } from 'react'

export function useAuth() {
  const [status, setStatus] = useState<{ connected: boolean; everConnected: boolean } | null>(null)

  const refresh = useCallback(async () => {
    setStatus(await window.api.auth.status())
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { status, refresh }
}
