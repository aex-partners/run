import type { CellProps } from '../types'

export function CheckboxCell({ value, rowId, column, onCommit, onEditChange }: CellProps) {
  const checked = value === true || value === 'true' || value === 1 || value === '1'
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => {
          onEditChange(String(!checked))
          onCommit()
        }}
        style={{ accentColor: 'var(--accent)', cursor: 'pointer', width: 16, height: 16 }}
        aria-label={`Toggle ${column.label}`}
      />
    </div>
  )
}
