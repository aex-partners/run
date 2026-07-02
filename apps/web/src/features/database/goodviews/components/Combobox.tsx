import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Plus, Search } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export interface ComboOption {
  value: string
  label: string
  /** cor hex p/ chip colorido (tags/status). */
  color?: string
  /** url de imagem p/ avatar (person). */
  image?: string
}

export interface ComboboxProps {
  options: ComboOption[]
  /** string (single) | string[] (multi) | null. */
  value: unknown
  /** single = escolhe um e fecha; multi = multimarcar + regra min/max. */
  single?: boolean
  min?: number
  max?: number
  /** permite criar itens novos ("Adicionar ..."). */
  creatable?: boolean
  placeholder?: string
  onCommit: (v: unknown) => void
  onClose: () => void
}

function Avatar({ label, image }: { label: string; image?: string }) {
  if (image)
    return <img src={image} alt={label} className="size-5 shrink-0 rounded-full object-cover" loading="lazy" />
  return (
    <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#E2E8F0] text-[9px] font-semibold text-[#475569]">
      {label.trim().slice(0, 2).toUpperCase()}
    </span>
  )
}

/** chip colorido (como a coluna prioridade) ou avatar+nome (person). */
// `full` = mostra o texto inteiro (quebra linha), usado no item destacado p/ teclado
function OptionLabel({ o, hasAvatar, full }: { o: ComboOption; hasAvatar: boolean; full?: boolean }) {
  const txt = full ? 'whitespace-normal break-words' : 'truncate'
  if (hasAvatar)
    return (
      <span className="flex min-w-0 items-center gap-1.5" title={o.label}>
        <Avatar label={o.label} image={o.image} />
        <span className={txt}>{o.label}</span>
      </span>
    )
  if (o.color)
    return (
      <span
        title={o.label}
        className={cn('inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-xs font-medium', full ? 'whitespace-normal' : 'overflow-hidden whitespace-nowrap')}
        style={{ background: `${o.color}22`, color: o.color, border: `1px solid ${o.color}` }}
      >
        <span className={txt}>{o.label}</span>
      </span>
    )
  return <span className={txt} title={o.label}>{o.label}</span>
}

// item de acao da lista (p/ navegacao por teclado)
type Item = { kind: 'clear' } | { kind: 'opt'; value: string } | { kind: 'create' }

export function Combobox({
  options,
  value,
  single = false,
  min,
  max,
  creatable = false,
  placeholder = 'Buscar...',
  onCommit,
  onClose,
}: ComboboxProps) {
  const triggerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0) // indice destacado p/ navegacao por teclado
  const [initialSel] = useState<Set<string>>(() => {
    const init = single
      ? typeof value === 'string' && value ? [value] : []
      : Array.isArray(value) ? (value as string[]) : []
    return new Set(init)
  })

  useEffect(() => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.max(r.width, 240)
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) // nao sai do viewport
    const top = Math.min(r.bottom + 4, window.innerHeight - 16)
    setPos({ top, left, width })
  }, [])
  useEffect(() => { if (pos) inputRef.current?.focus() }, [pos])
  // rola a lista p/ manter o item destacado (setas) visivel
  useEffect(() => {
    listRef.current?.querySelector(`[data-hi="${hi}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [hi])

  const hasAvatar = options.some((o) => o.image)

  const selRaw = single
    ? typeof value === 'string' && value ? [value] : []
    : Array.isArray(value) ? (value as string[]) : []
  const opts: ComboOption[] = [...options]
  for (const v of selRaw) if (!opts.some((o) => o.value === v)) opts.push({ value: v, label: v })

  const sel = selRaw
  const selSet = new Set(sel)
  const query = q.trim()
  const matched = query ? opts.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : opts
  const filtered = [...matched].sort((a, b) => Number(initialSel.has(b.value)) - Number(initialSel.has(a.value)))
  const canCreate = creatable && query.length > 0 && !opts.some((o) => o.label.toLowerCase() === query.toLowerCase())

  // lista de itens acionaveis, na ordem em que aparecem (p/ setas + Enter)
  const items = useMemo<Item[]>(() => {
    const list: Item[] = []
    if (single) list.push({ kind: 'clear' })
    for (const o of filtered) list.push({ kind: 'opt', value: o.value })
    if (canCreate) list.push({ kind: 'create' })
    return list
  }, [single, filtered, canCreate])

  // mantem o highlight dentro dos limites quando a lista muda
  useEffect(() => { setHi((h) => Math.max(0, Math.min(h, items.length - 1))) }, [items.length])

  function pickOpt(v: string) {
    if (single) {
      if (selSet.has(v)) { onCommit(null); return } // desmarca e mantem aberta
      onCommit(v)
      onClose()
      return
    }
    const next = new Set(selSet)
    if (next.has(v)) next.delete(v)
    else {
      if (max != null && next.size >= max) return
      next.add(v)
    }
    onCommit([...next])
  }
  function create() {
    if (!canCreate) return
    if (single) { onCommit(query); onClose(); return }
    if (max != null && sel.length >= max) return
    onCommit([...sel, query])
    setQ('')
    inputRef.current?.focus()
  }
  function activate(it: Item) {
    if (it.kind === 'clear') { onCommit(null); onClose() }
    else if (it.kind === 'create') create()
    else pickOpt(it.value)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[hi]) activate(items[hi]) }
  }

  // indice base p/ destacar (clear ocupa 0 no single)
  const optBase = single ? 1 : 0

  return (
    <>
      {/* chips no cell (gatilho), linha unica clipada */}
      <div
        ref={triggerRef}
        className="flex items-center gap-1 overflow-hidden whitespace-nowrap h-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {sel.length === 0 ? (
          <span className="text-xs text-[#94A3B8]">Selecionar...</span>
        ) : (
          sel.slice(0, 4).map((v) => {
            const o = opts.find((x) => x.value === v)
            return o ? (
              <span key={v} className="shrink-0">
                <OptionLabel o={o} hasAvatar={hasAvatar} />
              </span>
            ) : null
          })
        )}
        {sel.length > 4 && <span className="text-xs text-[#94A3B8]">+{sel.length - 4}</span>}
      </div>

      <div className="fixed inset-0 z-40" onMouseDown={(e) => { e.stopPropagation(); onClose() }} />

      {pos && (
        <div
          className="fixed z-50 rounded-md border border-[#E2E8F0] bg-white shadow-xl"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 border-b border-[#E2E8F0] px-3 h-9">
            <Search size={14} className="opacity-50 shrink-0" />
            <input
              ref={inputRef}
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-transparent text-sm text-[#0F172A] outline-none border-0 p-0"
              onKeyDown={onKeyDown}
            />
          </div>

          {!single && (
            <div className="px-3 py-1.5 text-[11px] text-[#94A3B8] border-b border-[#E2E8F0]">
              {sel.length}
              {max != null ? ` / ${max}` : ''} selecionado{sel.length === 1 ? '' : 's'}
              {min != null && sel.length < min && <span className="text-[#EF4444]"> (mínimo {min})</span>}
            </div>
          )}

          <div ref={listRef} className="max-h-[220px] overflow-auto py-1">
            {single && (
              <button
                type="button"
                data-hi={0}
                onMouseEnter={() => setHi(0)}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onCommit(null); onClose() }}
                className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-sm text-left text-[#94A3B8] cursor-pointer', hi === 0 && 'bg-[#F1F5F9]')}
              >
                <Check size={14} className="shrink-0 opacity-0" />
                <span className="truncate">(nenhum)</span>
              </button>
            )}

            {filtered.map((o, i) => {
              const idx = optBase + i
              const on = selSet.has(o.value)
              const blocked = !single && !on && max != null && sel.length >= max
              return (
                <button
                  key={o.value}
                  type="button"
                  title={o.label}
                  data-hi={idx}
                  disabled={blocked}
                  onMouseEnter={() => setHi(idx)}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); pickOpt(o.value) }}
                  className={cn(
                    'flex w-full items-start gap-2 px-3 py-1.5 text-sm text-left',
                    blocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                    hi === idx && !blocked && 'bg-[#F1F5F9]',
                  )}
                >
                  <Check size={14} className={cn('mt-0.5 shrink-0', on ? 'opacity-100 text-[#2563EB]' : 'opacity-0')} />
                  <OptionLabel o={o} hasAvatar={hasAvatar} full={hi === idx} />
                </button>
              )
            })}

            {canCreate && (
              <button
                type="button"
                data-hi={items.length - 1}
                onMouseEnter={() => setHi(items.length - 1)}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); create() }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-sm text-left text-[#2563EB] cursor-pointer border-t border-[#E2E8F0]',
                  hi === items.length - 1 && 'bg-[#EFF6FF]',
                )}
              >
                <Plus size={14} className="shrink-0" />
                <span className="truncate">Adicionar &ldquo;{query}&rdquo;</span>
              </button>
            )}

            {filtered.length === 0 && !canCreate && (
              <div className="px-3 py-2 text-xs text-[#94A3B8]">Nada encontrado</div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
