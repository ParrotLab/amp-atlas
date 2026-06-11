import SystemCard from '../components/SystemCard'
import './Dashboard.css'

const BookIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h5a3.5 3.5 0 013.5 3.5V18a2.5 2.5 0 00-2.5-2.5H2V3z"/>
    <path d="M18 3h-5a3.5 3.5 0 00-3.5 3.5V18a2.5 2.5 0 012.5-2.5H18V3z"/>
  </svg>
)

const MonitorIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3H3a1 1 0 00-1 1v10a1 1 0 001 1h14a1 1 0 001-1V4a1 1 0 00-1-1z"/>
    <path d="M2 8h16"/><path d="M6 15v3M14 15v3M4 18h12"/>
  </svg>
)

const LayersIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 2L2 6l8 4 8-4-8-4z"/><path d="M2 14l8 4 8-4"/><path d="M2 10l8 4 8-4"/>
  </svg>
)

export default function Dashboard() {
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="dashboard">
      <h1 className="dashboard-greeting">{greeting}, Rose</h1>
      <p className="dashboard-subtitle">Here's what's happening across your systems.</p>

      <div className="section-label">Your Systems</div>
      <div className="systems-grid">
        <SystemCard
          name="Learning System"
          path="/system/learning"
          gradient="linear-gradient(135deg, #8B2BFF, #A855FF)"
          meta="5 playbooks · 47 files · 2 open drafts"
          icon={<BookIcon />}
        />
        <SystemCard
          name="Marketing System"
          path="/system/marketing"
          gradient="linear-gradient(135deg, #FF7B00, #FFB875)"
          meta="3 playbooks · 23 files · Synced"
          icon={<MonitorIcon />}
        />
        <SystemCard
          name="AI Operations"
          path="/system/ai-ops"
          gradient="linear-gradient(135deg, #3D0052, #7A3D8F)"
          meta="12 playbooks · 112 files · 3 updates"
          icon={<LayersIcon />}
        />
        <SystemCard
          name="Delivery System"
          path="/system/delivery"
          gradient="linear-gradient(135deg, #16A34A, #22C55E)"
          meta="Playbooks · Files"
          icon={<BookIcon />}
        />
      </div>
    </div>
  )
}
