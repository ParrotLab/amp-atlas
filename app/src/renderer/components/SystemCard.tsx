import { Link } from 'react-router-dom'
import { primaryColor, softTint } from '../utils/appearance'
import { StatusTone } from '../utils/systemStatus'
import './SystemCard.css'

interface SystemCardProps {
  name: string
  path: string
  color: string            // the system's stored gradient string
  icon: React.ReactNode
  meta: string             // from metaLine(status, playbooks)
  tone: StatusTone
  connected?: boolean
}

export default function SystemCard({ name, path, color, icon, meta, tone, connected = true }: SystemCardProps) {
  const tint = softTint(primaryColor(color))
  return (
    <Link to={path} className={`system-card ${connected ? '' : 'disconnected'}`}>
      <div className="system-card-chip" style={{ background: tint }}>{icon}</div>
      <div className="system-card-name">{name}</div>
      <div className="system-card-meta">
        <span className={`system-card-dot tone-${tone}`} />
        {meta}
      </div>
    </Link>
  )
}
