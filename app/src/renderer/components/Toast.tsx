import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import './Toast.css'

interface ToastCtx { showToast: (msg: string) => void }
const Ctx = createContext<ToastCtx>({ showToast: () => {} })
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const showToast = useCallback((m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 4000)
  }, [])
  return (
    <Ctx.Provider value={{ showToast }}>
      {children}
      {msg && <div className="amp-toast">{msg}</div>}
    </Ctx.Provider>
  )
}
