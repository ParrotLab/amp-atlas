import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { useOnline } from '../hooks/useOnline'
import './AppLayout.css'

export default function AppLayout() {
  const online = useOnline()
  return (
    <div className="app-layout">
      <div className="titlebar-drag-region" />
      <Sidebar />
      <main className="app-main">
        {!online && (
          <div className="offline-pill" role="status">
            <span className="offline-dot" /> You're offline
          </div>
        )}
        <Outlet />
      </main>
    </div>
  )
}
