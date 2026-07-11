import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import logo from '../assets/logos/logo-wordmark-dark.svg'
import { getSystems, SYSTEMS_CHANGED_EVENT } from '../utils/systemStore'
import { iconMap, GlobeIcon, MailIcon, GearIcon } from './SystemIcons'
import { useProfile } from '../hooks/useProfile'
import './Sidebar.css'

export default function Sidebar() {
  const [systems, setSystems] = useState(getSystems())
  const location = useLocation()
  const profile = useProfile()

  const [reviewCount, setReviewCount] = useState(0)

  // Re-read systems on route change and whenever a system is added/edited/removed anywhere.
  useEffect(() => {
    setSystems(getSystems())
  }, [location.pathname])

  useEffect(() => {
    const h = () => setSystems(getSystems())
    window.addEventListener(SYSTEMS_CHANGED_EVENT, h)
    return () => window.removeEventListener(SYSTEMS_CHANGED_EVENT, h)
  }, [])

  // Count PRs awaiting this user's review across all connected systems (one API call each).
  useEffect(() => {
    if (!profile.login) return
    let cancelled = false
    ;(async () => {
      let total = 0
      for (const sys of getSystems()) {
        if (!sys.folderPath) continue
        const r = await window.api.git.reviewRequestCount(sys.folderPath, profile.login)
        if (r.ok) total += r.count
      }
      if (!cancelled) setReviewCount(total)
    })()
    return () => { cancelled = true }
  }, [profile.login, location.pathname])

  return (
    <aside className="sidebar no-select">
      <div className="sidebar-logo">
        <img src={logo} alt="AI Momentum Protocols" />
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
          <GlobeIcon size={18} /> Dashboard
        </NavLink>
        <NavLink to="/inbox" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <MailIcon size={18} /> Inbox
          {reviewCount > 0 && <span className="nav-badge">{reviewCount}</span>}
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
          {(profile.name || '?').charAt(0).toUpperCase()}
          <div className="online-dot" />
        </div>
        <div>
          <div className="sidebar-user-name">{profile.name || '—'}</div>
          {profile.login && <div className="sidebar-user-org">@{profile.login}</div>}
        </div>
      </div>
    </aside>
  )
}
