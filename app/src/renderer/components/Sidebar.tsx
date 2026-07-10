import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import logo from '../assets/logos/logo-wordmark-dark.svg'
import { getSystems } from '../utils/systemStore'
import { iconMap, DiamondIcon, MailIcon, GearIcon } from './SystemIcons'
import './Sidebar.css'

export default function Sidebar() {
  const [systems, setSystems] = useState(getSystems())
  const location = useLocation()

  // Re-read systems from store whenever route changes (catches settings updates)
  useEffect(() => {
    setSystems(getSystems())
  }, [location.pathname])

  return (
    <aside className="sidebar no-select">
      <div className="sidebar-logo">
        <img src={logo} alt="AI Momentum Protocols" />
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
          <DiamondIcon size={18} /> Dashboard
        </NavLink>
        <NavLink to="/inbox" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <MailIcon size={18} /> Inbox
          <span className="nav-badge">3</span>
        </NavLink>

        <div className="nav-divider" />

        {systems.map(sys => {
          const Icon = iconMap[sys.icon]
          return (
            <NavLink key={sys.id} to={`/system/${sys.id}`} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              {Icon ? <Icon size={18} /> : <span style={{ fontSize: '16px' }}>◇</span>}
              {sys.name}
            </NavLink>
          )
        })}

        <div className="nav-divider" />

        <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <GearIcon size={18} /> Settings
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
