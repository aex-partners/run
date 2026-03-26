import { useState, useRef, useEffect, useCallback } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Link2 } from 'lucide-react'
import type { CellProps } from '../types'

export function RelationshipCell({
  column,
  value,
  isEditing,
  editValue,
  onEditChange,
  onCommit,
  onCancel,
  onDirectCommit,
  onFetchRelationshipRecords,
}: CellProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<{ id: string; label: string }[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const displayValue = String(value)

  useEffect(() => {
    if (isEditing) setOpen(true)
  }, [isEditing])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const fetchResults = useCallback(
    (query: string) => {
      if (!onFetchRelationshipRecords || !column.relationshipEntityId) return
      setLoading(true)
      onFetchRelationshipRecords(column.relationshipEntityId, query)
        .then((r) => setResults(r))
        .finally(() => setLoading(false))
    },
    [onFetchRelationshipRecords, column.relationshipEntityId],
  )

  useEffect(() => {
    if (!open) return
    fetchResults('')
  }, [open, fetchResults])

  const handleSearchChange = (val: string) => {
    setSearch(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fetchResults(val), 300)
  }

  const hasFetch = !!onFetchRelationshipRecords && !!column.relationshipEntityId

  if (!hasFetch) {
    if (isEditing) {
      return (
        <input
          autoFocus
          value={editValue}
          onChange={(e) => onEditChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommit()
            if (e.key === 'Escape') onCancel()
          }}
          style={{
            width: '100%',
            background: 'var(--surface)',
            border: '1px solid var(--accent)',
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 13,
            color: 'var(--text)',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
      )
    }
    // Display-only when no fetch callback
    if (!displayValue || displayValue === 'undefined') {
      return <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>-</span>
    }
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: 'var(--accent-light)',
        border: '1px solid var(--accent-border)',
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 12,
        color: 'var(--accent)',
        fontWeight: 500,
      }}>
        <Link2 size={11} />
        {displayValue}
      </span>
    )
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          setSearch('')
          setResults([])
        }
      }}
    >
      <Popover.Trigger asChild>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: displayValue ? 'var(--accent-light)' : 'transparent',
            border: displayValue ? '1px solid var(--accent-border)' : 'none',
            borderRadius: 4,
            padding: '2px 8px',
            fontSize: 12,
            color: displayValue ? 'var(--accent)' : 'var(--text-muted)',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Link2 size={11} />
          {displayValue || 'Link...'}
        </span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
            zIndex: 100,
            width: 240,
            padding: '8px 0',
          }}
        >
          <div style={{ padding: '0 8px 6px' }}>
            <input
              autoFocus
              placeholder="Search..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: 13,
                color: 'var(--text)',
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto' }}>
            {loading && (
              <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>Loading...</div>
            )}
            {!loading && results.length === 0 && (
              <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>No results</div>
            )}
            {!loading &&
              results.map((r) => (
                <div
                  key={r.id}
                  onClick={() => {
                    // Store label for display; future: store ID and resolve label
                    onDirectCommit?.(r.label)
                    setOpen(false)
                    setSearch('')
                    setResults([])
                  }}
                  style={{
                    padding: '6px 12px',
                    fontSize: 13,
                    cursor: 'pointer',
                    color: 'var(--text)',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLDivElement).style.background = 'var(--border)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
                  }}
                >
                  {r.label}
                </div>
              ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
