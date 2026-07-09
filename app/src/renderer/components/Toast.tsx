import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import './Toast.css'

interface ToastAction { label: string; onClick: () => void }
interface ToastCtx { showToast: (msg: string, action?: ToastAction) => void }
const Ctx = createContext<ToastCtx>({ showToast: () => {} })
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const [action, setAction] = useState<ToastAction | null>(null)

  const showToast = useCallback((m: string, a?: ToastAction) => {
    setMsg(m)
    setAction(a ?? null)
    // Only auto-dismiss plain toasts; an actionable toast stays until used or dismissed.
    if (!a) setTimeout(() => { setMsg(null); setAction(null) }, 4000)
  }, [])

  const dismiss = () => { setMsg(null); setAction(null) }

  return (
    <Ctx.Provider value={{ showToast }}>
      {children}
      {msg && (
        <div className="amp-toast">
          <span>{msg}</span>
          {action && (
            <span className="amp-toast-actions">
              <button className="amp-toast-btn" onClick={() => { action.onClick(); dismiss() }}>{action.label}</button>
              <button className="amp-toast-dismiss" onClick={dismiss} aria-label="Dismiss">✕</button>
            </span>
          )}
        </div>
      )}
    </Ctx.Provider>
  )
}
