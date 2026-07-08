import { CLIENT_ID, SCOPES } from './oauthConfig'
import { tokenStore } from './tokenStore'

export interface DeviceInfo { deviceCode: string; userCode: string; verificationUri: string; interval: number; expiresIn: number }

export async function startDeviceFlow(): Promise<DeviceInfo> {
  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, scope: SCOPES }),
  })
  const j = await res.json()
  return { deviceCode: j.device_code, userCode: j.user_code, verificationUri: j.verification_uri, interval: j.interval || 5, expiresIn: j.expires_in }
}

interface PollResult { done: boolean; token?: string; error?: string; slowDown?: boolean }

/** Pure interpretation of a poll response body. */
export function interpretPoll(body: { access_token?: string; error?: string }): PollResult {
  if (body.access_token) return { done: true, token: body.access_token }
  if (body.error === 'authorization_pending') return { done: false, slowDown: false }
  if (body.error === 'slow_down') return { done: false, slowDown: true }
  return { done: true, error: body.error || 'unknown' }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function pollForToken(deviceCode: string, interval: number): Promise<{ ok: boolean; error?: string }> {
  let wait = (interval || 5) * 1000
  for (;;) {
    await sleep(wait)
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: CLIENT_ID, device_code: deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }),
    })
    const r = interpretPoll(await res.json())
    if (r.slowDown) wait += 5000
    if (!r.done) continue
    if (r.token) { tokenStore().saveToken(r.token); return { ok: true } }
    return { ok: false, error: r.error }
  }
}

export async function getIdentity(): Promise<{ login: string; name: string; avatarUrl: string } | null> {
  const token = tokenStore().getToken()
  if (!token) return null
  const res = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } })
  if (!res.ok) return null
  const j = await res.json()
  return { login: j.login, name: j.name || j.login, avatarUrl: j.avatar_url }
}
