import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { makeTokenStore } from '../tokenStore'

// Fake safeStorage: reversible, deterministic (base64) — good enough to prove the flow.
const fakeSafe = {
  isEncryptionAvailable: () => true,
  encryptString: (s: string) => Buffer.from('enc:' + s),
  decryptString: (b: Buffer) => b.toString().replace(/^enc:/, ''),
}

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'amp-tok-')) })

describe('tokenStore', () => {
  it('saves + reads + clears a token and tracks everConnected', () => {
    const store = makeTokenStore(dir, fakeSafe as never)
    expect(store.getToken()).toBeNull()
    expect(store.hasEverConnected()).toBe(false)
    store.saveToken('abc')
    expect(store.getToken()).toBe('abc')
    expect(store.hasEverConnected()).toBe(true)
    store.clearToken()
    expect(store.getToken()).toBeNull()
    expect(store.hasEverConnected()).toBe(true) // marker persists after sign-out
  })
})
