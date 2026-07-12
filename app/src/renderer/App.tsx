import { HashRouter, Routes, Route, useParams } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import Dashboard from './pages/Dashboard'
import SystemOverview from './pages/SystemOverview'
import Settings from './pages/Settings'
import Inbox from './pages/Inbox'
import Review from './pages/Review'
import Connect from './pages/Connect'
import { useAuth } from './hooks/useAuth'

// Key by systemId so switching systems fully remounts the view — no stale tabs,
// drafts, git status, or PR state leaking from the previous system.
function SystemRoute() {
  const { systemId } = useParams()
  return <SystemOverview key={systemId} />
}

export default function App() {
  const { status, refresh } = useAuth()
  if (!status) return null // brief: loading auth status
  if (!status.connected && !status.everConnected) return <Connect onConnected={refresh} />
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inbox" element={<Inbox />} />
          <Route path="/review/:systemId/:prNumber" element={<Review />} />
          <Route path="/system/:systemId" element={<SystemRoute />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
