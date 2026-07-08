import { app, safeStorage } from 'electron'
import { readFileSync, writeFileSync, existsSync, rmSync } from 'fs'
import { join } from 'path'

interface SafeStorageLike {
  isEncryptionAvailable(): boolean
  encryptString(s: string): Buffer
  decryptString(b: Buffer): string
}

export function makeTokenStore(dir: string, safe: SafeStorageLike) {
  const tokenFile = join(dir, 'auth.bin')
  const markerFile = join(dir, 'amp-auth.json')

  return {
    getToken(): string | null {
      try {
        if (!existsSync(tokenFile)) return null
        return safe.decryptString(readFileSync(tokenFile))
      } catch { return null }
    },
    saveToken(token: string): void {
      writeFileSync(tokenFile, safe.encryptString(token))
      writeFileSync(markerFile, JSON.stringify({ everConnected: true }))
    },
    clearToken(): void {
      try { if (existsSync(tokenFile)) rmSync(tokenFile) } catch { /* ignore */ }
    },
    hasEverConnected(): boolean {
      try { return existsSync(markerFile) && JSON.parse(readFileSync(markerFile, 'utf-8')).everConnected === true }
      catch { return false }
    },
  }
}

// App-wide singleton bound to Electron's real safeStorage + userData.
let singleton: ReturnType<typeof makeTokenStore> | null = null
export function tokenStore() {
  if (!singleton) singleton = makeTokenStore(app.getPath('userData'), safeStorage)
  return singleton
}
