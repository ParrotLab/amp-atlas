import { Link } from 'react-router-dom'
import Badge, { BadgeVariant } from './Badge'
import { primaryColor, softTint } from '../utils/appearance'
import './JumpBackInCard.css'

interface JumpBackInCardProps {
  to: string
  title: string
  subtitle: string
  color: string            // the system's stored gradient string
  icon: React.ReactNode
  badgeVariant: BadgeVariant
  badgeLabel: string
}

export default function JumpBackInCard({ to, title, subtitle, color, icon, badgeVariant, badgeLabel }: JumpBackInCardProps) {
  const tint = softTint(primaryColor(color))
  return (
    <Link to={to} className="jumpback-card">
      <div className="jumpback-chip" style={{ background: tint }}>{icon}</div>
      <div className="jumpback-body">
        <div className="jumpback-title">{title}</div>
        <div className="jumpback-sub">{subtitle}</div>
      </div>
      <Badge variant={badgeVariant} className="jumpback-badge">{badgeLabel}</Badge>
    </Link>
  )
}
