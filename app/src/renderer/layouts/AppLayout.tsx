import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import NamePromptModal from '../components/NamePromptModal'
import { useOnline } from '../hooks/useOnline'
import { useProfile } from '../hooks/useProfile'
import { getSystem } from '../utils/systemStore'
import { logCrumb } from '../utils/breadcrumb'
import './AppLayout.css'

/** Human label for the current route, for the activity log. */
function routeLabel(pathname: string): string {
  if (pathname === '/') return 'opened Dashboard'
  if (pathname === '/inbox') return 'opened Inbox'
  if (pathname === '/settings') return 'opened Settings'
  const sys = pathname.match(/^\/system\/([^/]+)/)
  if (sys) return `opened system "${getSystem(sys[1])?.name ?? sys[1]}"`
  const rev = pathname.match(/^\/review\/([^/]+)\/([^/]+)/)
  if (rev) return `opened review #${rev[2]} in "${getSystem(rev[1])?.name ?? rev[1]}"`
  return `navigated to ${pathname}`
}

export default function AppLayout() {
  const online = useOnline()
  const profile = useProfile()
  const [nameDismissed, setNameDismissed] = useState(false)
  const location = useLocation()

  useEffect(() => { logCrumb(routeLabel(location.pathname)) }, [location.pathname])

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        {!online && (
          <div className="offline-pill" role="status">
            <span className="offline-dot" /> You're offline
          </div>
        )}
        <Outlet />
      </main>
      <NamePromptModal
        isOpen={profile.needsName && !nameDismissed}
        onSave={(n) => profile.saveName(n)}
        onSkip={() => setNameDismissed(true)}
      />
    </div>
  )
}
