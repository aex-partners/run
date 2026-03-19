import { Avatar } from '../../../atoms/Avatar/Avatar'
import type { CellProps } from '../types'

export function PersonCell({ value }: CellProps) {
  const names = String(value).split(',').map(n => n.trim()).filter(Boolean)
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {names.map((name, i) => (
        <div key={name} style={{ marginLeft: i > 0 ? -8 : 0, zIndex: names.length - i, position: 'relative' }}>
          <Avatar name={name} size="sm" />
        </div>
      ))}
    </div>
  )
}
