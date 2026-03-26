import { Calculator } from 'lucide-react'
import type { CellProps } from '../types'

export function FormulaCell({ value }: CellProps) {
  const displayValue = String(value)

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 13,
      color: 'var(--text-muted)',
    }}>
      <Calculator size={12} style={{ flexShrink: 0 }} />
      {displayValue}
    </span>
  )
}
