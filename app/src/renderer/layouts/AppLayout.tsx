import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import './AppLayout.css'

export default function AppLayout() {
  return (
    <div className="app-layout">
      <div className="titlebar-drag-region" />
      <Sidebar />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
