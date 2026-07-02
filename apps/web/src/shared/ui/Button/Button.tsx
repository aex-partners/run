import React from 'react'
import { Loader2 } from 'lucide-react'

export interface ButtonProps {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  style?: React.CSSProperties
  'aria-label'?: string
}

const variantStyles: Record<NonNullable<ButtonProps['variant']>, React.CSSProperties> = {
  primary: {
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
  },
  secondary: {
    background: 'transparent',
    color: 'var(--text)',
    border: '1px solid var(--border)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-muted)',
    border: 'none',
  },
  danger: {
    background: 'var(--danger)',
    color: '#fff',
    border: 'none',
  },
}

const sizeStyles: Record<NonNullable<ButtonProps['size']>, React.CSSProperties> = {
  sm: { padding: '4px 10px', fontSize: 12, borderRadius: 5, height: 28 },
  md: { padding: '6px 14px', fontSize: 13, borderRadius: 6, height: 34 },
  lg: { padding: '8px 18px', fontSize: 14, borderRadius: 7, height: 40 },
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  onClick,
  type = 'button',
  'aria-label': ariaLabel,
}: ButtonProps) {
  const isDisabled = disabled || loading
  // A disabled button reads as a neutral, clearly-inert gray instead of a faded
  // accent. A 50%-opacity orange looked broken/ambiguous (pale = "is this on?").
  // `loading` keeps the variant color (it's an in-progress action, not inert).
  const disabledStyle: React.CSSProperties =
    disabled && !loading
      ? { background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
      : {}

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={ariaLabel}
      aria-busy={loading ? 'true' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        fontWeight: 500,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        transition: 'all 0.15s',
        fontFamily: 'inherit',
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...disabledStyle,
      }}
    >
      {loading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  )
}

export default Button
