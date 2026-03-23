import React, { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, X, Search, Check } from 'lucide-react'
import * as ScrollArea from '@radix-ui/react-scroll-area'

export interface MultiSelectOption {
  value: string
  label: string
}

export interface MultiSelectProps {
  options: MultiSelectOption[]
  selected: string[]
  onChange?: (selected: string[]) => void
  placeholder?: string
  disabled?: boolean
  'aria-label'?: string
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  'aria-label': ariaLabel,
}: MultiSelectProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus()
  }, [open])

  const filtered = search.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(search.trim().toLowerCase()))
    : options

  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value]
    onChange?.(next)
  }

  const remove = (value: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange?.(selected.filter((v) => v !== value))
  }

  const selectedLabels = selected
    .map((v) => options.find((o) => o.value === v))
    .filter(Boolean) as MultiSelectOption[]

  return (
    <div ref={containerRef} style={{ position: 'relative' }} aria-label={ariaLabel}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setOpen(!open)}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !disabled) { e.preventDefault(); setOpen(!open) } }}
        aria-disabled={disabled}
        style={{
          width: '100%',
          minHeight: 34,
          padding: '4px 8px',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 4,
          background: 'var(--surface)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 6,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          fontFamily: 'inherit',
          textAlign: 'left',
        }}
      >
        {selectedLabels.length === 0 && (
          <span style={{ fontSize: 13, color: 'var(--text-muted)', flex: 1 }}>{placeholder}</span>
        )}
        {selectedLabels.map((opt) => (
          <span
            key={opt.value}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: '1px 6px',
              fontSize: 11,
              fontWeight: 500,
              background: 'var(--accent-light)',
              color: 'var(--accent)',
              borderRadius: 10,
              border: '1px solid var(--accent-border)',
            }}
          >
            {opt.label}
            <button
              type="button"
              onClick={(e) => remove(opt.value, e)}
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                color: 'var(--accent)',
              }}
              aria-label={`Remove ${opt.label}`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <ChevronDown
          size={14}
          color="var(--text-muted)"
          style={{
            marginLeft: 'auto',
            flexShrink: 0,
            transition: 'transform 0.15s',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        />
      </div>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--surface-2)',
                borderRadius: 4,
                padding: '4px 6px',
              }}
            >
              <Search size={12} color="var(--text-muted)" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`${t('search')}...`}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'none',
                  fontSize: 12,
                  color: 'var(--text)',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

          <ScrollArea.Root style={{ maxHeight: 200, overflow: 'hidden' }}>
            <ScrollArea.Viewport style={{ maxHeight: 200 }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '12px 10px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                  No options found
                </div>
              ) : (
                filtered.map((opt) => {
                  const isSelected = selected.includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggle(opt.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 13,
                        color: 'var(--text)',
                        fontFamily: 'inherit',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
                    >
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 3,
                          border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                          background: isSelected ? 'var(--accent)' : 'var(--surface)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {isSelected && <Check size={10} color="#fff" />}
                      </span>
                      {opt.label}
                    </button>
                  )
                })
              )}
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar orientation="vertical" style={{ width: 4 }}>
              <ScrollArea.Thumb style={{ background: 'var(--border)', borderRadius: 2 }} />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        </div>
      )}
    </div>
  )
}

export default MultiSelect
