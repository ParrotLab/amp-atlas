import { ReactNode } from 'react'
import './Button.css'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps {
  children?: ReactNode
  variant?: Variant
  size?: Size
  icon?: ReactNode
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
  title?: string
  className?: string
}

/** The one button component. Variants + sizes keep sizing/modes consistent everywhere. */
export default function Button({
  children, variant = 'secondary', size = 'md', icon, disabled, onClick, type = 'button', title, className = '',
}: ButtonProps) {
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`btn btn-${variant} btn-${size} ${icon ? 'btn-has-icon' : ''} ${className}`}
    >
      {icon && <span className="btn-icon">{icon}</span>}
      {children && <span className="btn-label">{children}</span>}
    </button>
  )
}
