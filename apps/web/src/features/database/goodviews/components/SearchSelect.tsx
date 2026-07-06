import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export interface SearchSelectOption {
  value: string
  label: string
}

/**
 * Select single com BUSCA, no estilo de formulário (trigger tipo `<select>` +
 * dropdown flutuante com campo de busca e navegação por teclado). Usado no editor
 * de campo (Tabela de destino, Campo a exibir, Via relação, Campo a puxar), onde
 * a lista pode ser longa (ex: todas as entidades). O dropdown é `position: fixed`
 * (ancorado ao trigger) p/ não ser cortado por containers com overflow.
 */
export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = 'Selecione…',
  disabled = false,
}: {
  value: string
  onChange: (v: string) => void
  options: SearchSelectOption[]
  placeholder?: string
  disabled?: boolean
}) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const selected = options.find((o) => o.value === value)
  const query = q.trim().toLowerCase()
  const filtered = useMemo(
    () => (query ? options.filter((o) => o.label.toLowerCase().includes(query)) : options),
    [options, query],
  )

  // posiciona o dropdown ancorado ao trigger (abre p/ cima se não couber embaixo)
  useEffect(() => {
    if (!open) return
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const width = r.width
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
    const maxH = 240 + 40
    const below = r.bottom + 4
    const top = below + maxH > window.innerHeight ? Math.max(8, r.top - 4 - maxH) : below
    setPos({ top, left, width })
    setQ('')
    setHi(0)
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  useEffect(() => { setHi((h) => Math.max(0, Math.min(h, filtered.length - 1))) }, [filtered.length])
  useEffect(() => {
    listRef.current?.querySelector(`[data-hi="${hi}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [hi])

  function pick(v: string) {
    onChange(v)
    setOpen(false)
    triggerRef.current?.focus()
  }
  function onKeyDown(e: ReactKeyboardEvent) {
    e.stopPropagation()
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); triggerRef.current?.focus() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); const o = filtered[hi]; if (o) pick(o.value) }
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen((o) => !o) }}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-md border border-[#E2E8F0] bg-white px-2 py-1.5 text-sm text-left outline-none focus:border-[#2563EB]',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <span className={cn('truncate', selected ? 'text-[#0F172A]' : 'text-[#94A3B8]')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown size={14} className="shrink-0 text-[#94A3B8]" />
      </button>

      {open && pos && (
        <>
          {/* fecha só o dropdown (stopPropagation evita fechar o popover pai) */}
          <div className="fixed inset-0 z-[68]" onMouseDown={(e) => { e.stopPropagation(); setOpen(false) }} />
          <div
            className="fixed z-[69] rounded-md border border-[#E2E8F0] bg-white shadow-xl"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex h-9 items-center gap-2 border-b border-[#E2E8F0] px-3">
              <Search size={14} className="shrink-0 opacity-50" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Buscar..."
                className="w-full border-0 bg-transparent p-0 text-sm text-[#0F172A] outline-none"
              />
            </div>
            <div ref={listRef} className="max-h-[220px] overflow-auto py-1">
              {filtered.map((o, i) => {
                const on = o.value === value
                return (
                  <button
                    key={o.value}
                    type="button"
                    title={o.label}
                    data-hi={i}
                    onMouseEnter={() => setHi(i)}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); pick(o.value) }}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm',
                      hi === i && 'bg-[#F1F5F9]',
                    )}
                  >
                    <Check size={14} className={cn('shrink-0', on ? 'text-[#2563EB] opacity-100' : 'opacity-0')} />
                    <span className="truncate">{o.label}</span>
                  </button>
                )
              })}
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-xs text-[#94A3B8]">Nada encontrado</div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
