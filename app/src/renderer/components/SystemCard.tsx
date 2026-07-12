import { Link } from 'react-router-dom'
import { primaryColor, softTint } from '../utils/appearance'
import './SystemCard.css'

interface SystemCardProps {
  name: string
  path: string
  color: string            // the system's stored gradient string
  icon: React.ReactNode
  meta: string             // from cardMeta(connected, playbooks, updatedRel)
  connected?: boolean
}

export default function SystemCard({ name, path, color, icon, meta, connected = true }: SystemCardProps) {
  const tint = softTint(primaryColor(color))
  return (
    <Link to={path} className={`system-card ${connected ? '' : 'disconnected'}`}>
      <div className="system-card-chip" style={{ background: tint }}>{icon}</div>
      <div className="system-card-name">{name}</div>
      <div className="system-card-meta">{meta}</div>
    </Link>
  )
}
