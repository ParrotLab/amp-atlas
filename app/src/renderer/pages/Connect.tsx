import { useState } from 'react'
import './Connect.css'

export default function Connect({ onConnected }: { onConnected: () => void }) {
  const [device, setDevice] = useState<{ userCode: string; verificationUri: string } | null>(null)
  const [status, setStatus] = useState<'idle' | 'waiting' | 'error'>('idle')
  const [error, setError] = useState('')

  const start = async () => {
    setStatus('waiting'); setError('')
    const d = await window.api.auth.startDeviceFlow()
    if (!d.ok || !d.deviceCode) { setStatus('error'); setError(d.error || 'Could not start'); return }
    setDevice({ userCode: d.userCode!, verificationUri: d.verificationUri! })
    navigator.clipboard.writeText(d.userCode!)
    window.open(d.verificationUri!)
    const r = await window.api.auth.pollToken(d.deviceCode, d.interval || 5)
    if (r.connected) onConnected()
    else { setStatus('error'); setError(r.error === 'access_denied' ? 'Connection was declined.' : 'The code expired — try again.') }
  }

  return (
    <div className="connect-screen">
      <div className="connect-card">
        <div className="connect-title">Connect to GitHub</div>
        <div className="connect-sub">AMP Atlas works with your team's GitHub. Connect once to publish and review.</div>
        {!device && status !== 'waiting' && <button className="connect-btn" onClick={start}>Connect to GitHub</button>}
        {device && (
          <div className="connect-code-wrap">
            <div className="connect-code-label">Enter this code on GitHub (we copied it for you):</div>
            <div className="connect-code">{device.userCode}</div>
            <button className="connect-btn" onClick={() => window.open(device.verificationUri)}>Open GitHub</button>
            <div className="connect-waiting">Waiting for you to approve…</div>
          </div>
        )}
        {status === 'waiting' && !device && <div className="connect-waiting">Starting…</div>}
        {status === 'error' && <div className="connect-error">{error} <button className="connect-link" onClick={start}>Try again</button></div>}
      </div>
    </div>
  )
}
