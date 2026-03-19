import { Badge } from '../../../atoms/Badge/Badge'
import { STATUS_BADGE_MAP } from '../constants'
import type { CellProps } from '../types'

export function BadgeCell({ value }: CellProps) {
  const variant = STATUS_BADGE_MAP[String(value)] || 'neutral'
  return <Badge variant={variant}>{String(value)}</Badge>
}
