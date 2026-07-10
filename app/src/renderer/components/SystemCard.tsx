import { Link } from 'react-router-dom'
import './SystemCard.css'

interface SystemCardProps {
  name: string
  path: string
  gradient: string
  meta: string
  icon: React.ReactNode
  connected?: boolean
}

export default function SystemCard({ name, path, gradient, meta, icon, connected = true }: SystemCardProps) {
  return (
    <Link to={path} className={`system-card ${connected ? '' : 'disconnected'}`} style={{ background: gradient }}>
      <div className="system-card-icon">{icon}</div>
      <div className="system-card-name">{name}</div>
      <div className="system-card-meta">{meta}</div>
    </Link>
  )
}
