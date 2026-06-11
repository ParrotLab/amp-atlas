import { NavLink } from 'react-router-dom'
import logo from '../assets/logos/logo-wordmark-dark.svg'
import './Sidebar.css'

const BookIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h5a3.5 3.5 0 013.5 3.5V18a2.5 2.5 0 00-2.5-2.5H2V3z"/>
    <path d="M18 3h-5a3.5 3.5 0 00-3.5 3.5V18a2.5 2.5 0 012.5-2.5H18V3z"/>
  </svg>
)

const MonitorIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3H3a1 1 0 00-1 1v10a1 1 0 001 1h14a1 1 0 001-1V4a1 1 0 00-1-1z"/>
    <path d="M2 8h16"/><path d="M6 15v3M14 15v3M4 18h12"/>
  </svg>
)

const LayersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 2L2 6l8 4 8-4-8-4z"/><path d="M2 14l8 4 8-4"/><path d="M2 10l8 4 8-4"/>
  </svg>
)

const systems = [
  { name: 'Learning System', path: '/system/learning', Icon: BookIcon },
  { name: 'Marketing System', path: '/system/marketing', Icon: MonitorIcon },
  { name: 'AI Operations', path: '/system/ai-ops', Icon: LayersIcon },
  { name: 'Delivery System', path: '/system/delivery', Icon: BookIcon }
]

export default function Sidebar() {
  return (
    <aside className="sidebar no-select">
      <div className="sidebar-logo">
        <img src={logo} alt="AI Momentum Protocols" />
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
          <span style={{ fontSize: '16px' }}>&#9671;</span> Dashboard
        </NavLink>
        <NavLink to="/inbox" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span style={{ fontSize: '14px' }}>&#9993;</span> Inbox
          <span className="nav-badge">3</span>
        </NavLink>

        <div className="nav-divider" />

        {systems.map(({ name, path, Icon }) => (
          <NavLink key={path} to={path} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon /> {name}
          </NavLink>
        ))}

        <div className="nav-divider" />

        <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <span style={{ fontSize: '16px' }}>&#9881;</span> Settings
        </NavLink>
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-avatar">
          R
          <div className="online-dot" />
        </div>
        <div>
          <div className="sidebar-user-name">Rose</div>
          <div className="sidebar-user-org">Parrot Labs</div>
        </div>
      </div>
    </aside>
  )
}
