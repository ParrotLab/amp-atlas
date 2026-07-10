import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import NamePromptModal from '../components/NamePromptModal'
import { useOnline } from '../hooks/useOnline'
import { useProfile } from '../hooks/useProfile'
import './AppLayout.css'

export default function AppLayout() {
  const online = useOnline()
  const profile = useProfile()
  const [nameDismissed, setNameDismissed] = useState(false)
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
