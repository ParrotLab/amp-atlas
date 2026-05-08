import { Link } from 'react-router-dom'
import './SystemCard.css'

interface SystemCardProps {
  name: string
  path: string
  gradient: string
  meta: string
  icon: React.ReactNode
}

export default function SystemCard({ name, path, gradient, meta, icon }: SystemCardProps) {
  return (
    <Link to={path} className="system-card" style={{ background: gradient }}>
      <div className="system-card-icon">{icon}</div>
      <div className="system-card-name">{name}</div>
      <div className="system-card-meta">{meta}</div>
    </Link>
  )
}
