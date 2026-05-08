import './Dashboard.css'

export default function Dashboard() {
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="dashboard">
      <h1 className="dashboard-greeting">{greeting}, Rose</h1>
      <p className="dashboard-subtitle">Here's what's happening across your systems.</p>
    </div>
  )
}
