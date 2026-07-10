import { forwardRef, InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Adds the design-system search styling (magnifier icon + left padding). */
  search?: boolean
}

/** Text input backed by the design-system .input class. */
const Input = forwardRef<HTMLInputElement, InputProps>(({ search, className = '', ...rest }, ref) => (
  <input ref={ref} className={`input ${search ? 'input-search' : ''} ${className}`.trim()} {...rest} />
))
Input.displayName = 'Input'
export default Input
