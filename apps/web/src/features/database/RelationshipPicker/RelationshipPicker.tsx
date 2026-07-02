import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import * as Popover from '@radix-ui/react-popover'
import { Link2 } from 'lucide-react'

export interface RelationshipPickerProps {
  /** Target entity to search records in. */
  entityId?: string
  /** Currently stored target record id (or empty). */
  value: string
  /** Commit the picked target record id. */
  onChange: (id: string) => void
  /** Fetch matching records from the target entity. */
  onFetch?: (entityId: string, search: string) => Promise<{ id: string; label: string }[]>
  /** Label to show for a pre-set value (e.g. when editing an existing record). */
  initialLabel?: string
  placeholder?: string
  inputStyle?: React.CSSProperties
}

/**
 * Search-and-pick control for relationship fields. Persists the target record
 * id (true FK) while displaying its label. When no fetch callback or target
 * entity is available (e.g. public forms with no authenticated search), it
 * degrades to a plain text input that writes the raw value.
 */
export function RelationshipPicker({
  entityId,
  value,
  onChange,
  onFetch,
  initialLabel,
  placeholder,
  inputStyle,
}: RelationshipPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<{ id: string; label: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [pickedLabel, setPickedLabel] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const fetchResults = useCallback(
    (query: string) => {
      if (!onFetch || !entityId) return
      setLoading(true)
      onFetch(entityId, query)
        .then((r) => setResults(r))
        .finally(() => setLoading(false))
    },
    [onFetch, entityId],
  )

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch triggers setState in callback
    fetchResults('')
  }, [open, fetchResults])

  const handleSearchChange = (val: string) => {
    setSearch(val)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fetchResults(val), 300)
  }

  const hasFetch = !!onFetch && !!entityId

  // Fallback: no search endpoint -> raw text input (public forms).
  if (!hasFetch) {
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    )
  }

  const display = pickedLabel ?? initialLabel ?? (value || '')

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
        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            width: '100%',
            textAlign: 'left',
            cursor: 'pointer',
            ...inputStyle,
            color: display ? 'var(--text)' : 'var(--text-muted)',
          }}
        >
          <Link2 size={13} style={{ flexShrink: 0, color: 'var(--accent)' }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {display || placeholder || t('relationshipCell.link')}
          </span>
        </button>
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
              placeholder={t('relationshipCell.searchPlaceholder')}
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
              <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{t('relationshipCell.loading')}</div>
            )}
            {!loading && results.length === 0 && (
              <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>{t('relationshipCell.noResults')}</div>
            )}
            {!loading &&
              results.map((r) => (
                <div
                  key={r.id}
                  onClick={() => {
                    setPickedLabel(r.label)
                    onChange(r.id)
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
