import { HashRouter, Routes, Route } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import Dashboard from './pages/Dashboard'
import SystemOverview from './pages/SystemOverview'
import Settings from './pages/Settings'
import Inbox from './pages/Inbox'
import Review from './pages/Review'
import Connect from './pages/Connect'
import { useAuth } from './hooks/useAuth'

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
          <Route path="/system/:systemId" element={<SystemOverview />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
