import { ReactNode } from 'react'

// Variants + sizes come from the AMP design system (styles/components.css .btn-*).
type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'accent' | 'danger'
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

/** The one button component, backed by the design-system .btn classes. */
export default function Button({
  children, variant = 'secondary', size = 'md', icon, disabled, onClick, type = 'button', title, className = '',
}: ButtonProps) {
  const sizeClass = size === 'md' ? '' : `btn-${size}`
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`btn btn-${variant} ${sizeClass} ${className}`.trim()}
    >
      {icon && <span className="btn-lead">{icon}</span>}
      {children && <span>{children}</span>}
    </button>
  )
}
