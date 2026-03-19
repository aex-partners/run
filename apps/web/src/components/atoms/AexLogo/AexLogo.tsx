import React from 'react'

export type AexLogoVariant = 'default' | 'orange' | 'black' | 'white'

export interface AexLogoProps {
  size?: number
  variant?: AexLogoVariant
  className?: string
}

const variantColors: Record<AexLogoVariant, { main: string; accent: string }> = {
  default: { main: 'var(--text)', accent: 'var(--accent)' },
  orange: { main: 'var(--accent)', accent: 'var(--accent)' },
  black: { main: '#111827', accent: '#111827' },
  white: { main: '#ffffff', accent: '#ffffff' },
}

export function AexLogo({ size = 32, variant = 'default', className }: AexLogoProps) {
  const height = size
  const width = (580.86 / 172.74) * height
  const { main, accent } = variantColors[variant]

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 580.86 172.74"
      width={width}
      height={height}
      className={className}
      aria-label="AEX Logo"
      role="img"
    >
      <polygon fill={main} points="178.53 172.74 206.02 172.74 103.01 1.84 0 172.74 27.5 172.74 103.01 47.9 178.53 172.74" />
      <polygon fill={accent} points="449.52 0 422.45 0 474.64 86.37 422.45 172.73 449.52 172.73 501.71 86.37 449.52 0" />
      <polygon fill={main} points="362.29 172.46 376.39 149.13 251.5 149.13 265.73 172.74 362.02 172.74 362.29 172.46" />
      <polygon fill={main} points="414.32 86.37 407.19 74.57 206.55 74.57 220.78 98.17 407.19 98.17 414.32 86.37" />
      <polygon fill={main} points="362.45 .54 361.91 0 161.66 0 176.35 23.61 376.39 23.61 362.45 .54" />
      <polygon fill={main} points="545 59.35 580.86 0 553.79 0 531.46 36.95 545 59.35" />
      <polygon fill={main} points="531.46 135.78 553.79 172.73 580.86 172.73 545 113.39 531.46 135.78" />
    </svg>
  )
}

export default AexLogo
