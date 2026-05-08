import { HashRouter, Routes, Route } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import Dashboard from './pages/Dashboard'
import SystemOverview from './pages/SystemOverview'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inbox" element={<div style={{ padding: '40px 48px' }}><h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a2e' }}>Inbox</h1></div>} />
          <Route path="/system/:systemId" element={<SystemOverview />} />
          <Route path="/settings" element={<div style={{ padding: '40px 48px' }}><h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a2e' }}>Settings</h1></div>} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
