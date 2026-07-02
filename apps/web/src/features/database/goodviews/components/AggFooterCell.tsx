import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { Field, Row } from '../types'

export type AggFn = 'none' | 'sum' | 'avg' | 'min' | 'max' | 'count' | 'unique' | 'filled' | 'empty'

const AGG_LABEL: Record<AggFn, string> = {
  none: '—',
  sum: 'Soma',
  avg: 'Média',
  min: 'Mín',
  max: 'Máx',
  count: 'Contagem',
  unique: 'Únicos',
  filled: 'Preenchidos',
  empty: 'Vazios',
}

function isNumeric(f: Field) {
  return f.type === 'number' || f.type === 'currency' || f.type === 'percent'
}
function isCategorical(f: Field) {
  return ['select', 'status', 'person', 'multiselect', 'relation'].includes(f.type)
}

export function aggOptions(f: Field): AggFn[] {
  if (isNumeric(f)) return ['none', 'sum', 'avg', 'min', 'max', 'count', 'filled', 'empty']
  if (f.type === 'date') return ['none', 'min', 'max', 'count', 'unique', 'filled', 'empty']
  return ['none', 'count', 'unique', 'filled', 'empty'] // categorico / texto
}

export function defaultAgg(f: Field): AggFn {
  if (f.type === 'currency' || f.type === 'number') return 'sum'
  if (f.type === 'percent') return 'avg'
  if (isCategorical(f)) return 'count'
  return 'none'
}

function fmtCurrency(n: number, code = 'BRL') {
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: code })
}
function fmtNum(n: number) {
  return Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

interface Computed {
  display: ReactNode
  breakdown: { label: ReactNode; value: string; pct?: string; filterValue?: string }[]
  breakdownTitle: string
}

function compute(field: Field, records: Row[], recordsById: Map<string, Row>, fn: AggFn): Computed {
  // ---- numerico (number / currency / percent) ----
  if (isNumeric(field)) {
    const nums = records.map((r) => Number(r[field.id])).filter((n) => !isNaN(n))
    const count = nums.length
    const sum = nums.reduce((a, b) => a + b, 0)
    const avg = count ? sum / count : 0
    const min = count ? Math.min(...nums) : 0
    const max = count ? Math.max(...nums) : 0
    const filled = records.filter((r) => r[field.id] != null && r[field.id] !== '').length
    const empty = records.length - filled

    // moeda: agrupa por codigo (currencyField por registro, senao fixo)
    let groups: [string, number][] | null = null
    if (field.type === 'currency') {
      const m = new Map<string, number>()
      for (const r of records) {
        const v = Number(r[field.id])
        if (isNaN(v)) continue
        const code = (field.currencyField ? String(r[field.currencyField] ?? '') : '') || field.currency || 'BRL'
        m.set(code, (m.get(code) ?? 0) + v)
      }
      groups = [...m].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    }
    const domCode = groups?.[0]?.[0] || field.currency || 'BRL'
    const fmt = (v: number) =>
      field.type === 'currency' ? fmtCurrency(v, domCode) : field.type === 'percent' ? `${Math.round(v)}%` : fmtNum(v)

    // breakdown: moeda multipla -> soma por moeda (com % do todo); senao stats
    const totalAbs = groups ? groups.reduce((a, [, s]) => a + Math.abs(s), 0) : 0
    const breakdown: { label: ReactNode; value: string; pct?: string }[] =
      groups && groups.length > 1
        ? groups.map(([code, s]) => ({
            label: code,
            value: fmtCurrency(s, code),
            pct: totalAbs ? `${Math.round((Math.abs(s) / totalAbs) * 100)}%` : undefined,
          }))
        : [
            { label: 'Soma', value: fmt(sum) },
            { label: 'Média', value: fmt(avg) },
            { label: 'Mín', value: fmt(min) },
            { label: 'Máx', value: fmt(max) },
            { label: 'Contagem', value: String(count) },
          ]

    let display: ReactNode = ''
    if (fn === 'sum') {
      if (groups && groups.length > 1)
        display = (
          <span className="inline-flex items-baseline gap-1">
            {fmtCurrency(groups[0][1], groups[0][0])}
            <span className="text-[#94A3B8]">+{groups.length - 1}</span>
          </span>
        )
      else display = fmt(sum)
    } else if (fn === 'avg') display = fmt(avg)
    else if (fn === 'min') display = fmt(min)
    else if (fn === 'max') display = fmt(max)
    else if (fn === 'count') display = String(count)
    else if (fn === 'filled') display = String(filled)
    else if (fn === 'empty') display = String(empty)

    return { display, breakdown, breakdownTitle: `${field.label} · resumo` }
  }

  // ---- data ----
  if (field.type === 'date') {
    const ds = records.map((r) => r[field.id]).filter((v) => v != null && v !== '').map(String).sort()
    const filled = ds.length
    const empty = records.length - filled
    let display: ReactNode = ''
    if (fn === 'min') display = ds[0] ?? '-'
    else if (fn === 'max') display = ds[ds.length - 1] ?? '-'
    else if (fn === 'count') display = String(ds.length)
    else if (fn === 'unique') display = String(new Set(ds).size)
    else if (fn === 'filled') display = String(filled)
    else if (fn === 'empty') display = String(empty)
    return { display, breakdown: [], breakdownTitle: '' }
  }

  // ---- categorico / texto: agrupa contagem por valor ----
  const vals: string[] = []
  let filled = 0
  for (const r of records) {
    const v = r[field.id]
    if (Array.isArray(v)) {
      if (v.length) filled++
      vals.push(...(v as unknown[]).map(String))
    } else if (v != null && v !== '') {
      filled++
      vals.push(String(v))
    }
  }
  const empty = records.length - filled
  const counts = new Map<string, number>()
  for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1)
  const labelOf = (val: string): string => {
    const opt = field.options?.find((o) => o.value === val)
    if (opt) return opt.label
    const rec = recordsById.get(val)
    if (rec) return String(rec.nome ?? val)
    return val
  }
  const totalCounts = vals.length // todo = total de ocorrencias
  const multi = counts.size > 1
  const breakdown = [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([val, c]) => ({
      label: labelOf(val),
      value: String(c),
      pct: multi && totalCounts ? `${Math.round((c / totalCounts) * 100)}%` : undefined,
      filterValue: val, // clicar filtra a tabela por este valor
    }))

  let display: ReactNode = ''
  if (fn === 'count') display = String(filled)
  else if (fn === 'unique') display = String(counts.size)
  else if (fn === 'filled') display = String(filled)
  else if (fn === 'empty') display = String(empty)

  return { display, breakdown, breakdownTitle: `${field.label} · agrupado` }
}

// ---- menu p/ escolher a funcao (abre p/ CIMA, acima do rodape) ----
function FuncMenu({
  anchorRef,
  options,
  value,
  onPick,
  onClose,
}: {
  anchorRef: React.RefObject<HTMLElement | null>
  options: AggFn[]
  value: AggFn
  onPick: (fn: AggFn) => void
  onClose: () => void
}) {
  const [pos, setPos] = useState<{ bottom: number; left?: number; right?: number; width: number } | null>(null)
  useEffect(() => {
    const r = anchorRef.current?.getBoundingClientRect()
    if (!r) return
    const alignRight = r.left + r.width / 2 > window.innerWidth / 2
    setPos({
      bottom: window.innerHeight - r.top + 4,
      width: Math.max(r.width, 150),
      ...(alignRight ? { right: window.innerWidth - r.right } : { left: r.left }),
    })
  }, [anchorRef])
  return (
    <>
      <div className="fixed inset-0 z-40" onMouseDown={(e) => { e.stopPropagation(); onClose() }} />
      {pos && (
        <div
          className="fixed z-50 overflow-hidden rounded-md border border-[#E2E8F0] bg-white py-1 shadow-xl"
          style={{ bottom: pos.bottom, left: pos.left, right: pos.right, minWidth: pos.width }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {options.map((fn) => (
            <button
              key={fn}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onPick(fn) }}
              className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm text-[#334155] hover:bg-[#F1F5F9]"
            >
              <span>{AGG_LABEL[fn]}</span>
              {fn === value && <Check size={14} className="shrink-0 text-[#2563EB]" />}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

export interface AggFooterCellProps {
  field: Field
  records: Row[]
  recordsById: Map<string, Row>
  agg: AggFn
  onAggChange: (fn: AggFn) => void
  align?: 'left' | 'right'
  /** clicar numa opcao do resumo filtra a tabela por aquele valor. */
  onFilter?: (fieldId: string, value: string) => void
}

export function AggFooterCell({ field, records, recordsById, agg, onAggChange, align = 'left', onFilter }: AggFooterCellProps) {
  const cellRef = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState(false)
  const [alignRight, setAlignRight] = useState(false)

  useEffect(() => {
    const r = cellRef.current?.getBoundingClientRect()
    if (r) setAlignRight(r.left + r.width / 2 > window.innerWidth / 2)
  })

  const { display, breakdown, breakdownTitle } = compute(field, records, recordsById, agg)

  return (
    <div
      ref={cellRef}
      className={cn('group/agg relative flex h-full items-center', align === 'right' ? 'justify-end' : 'justify-start')}
    >
      <button
        type="button"
        onMouseDown={(e) => { e.stopPropagation(); setMenu(true) }}
        className="flex min-w-0 items-baseline gap-1.5 rounded px-1 py-0.5 transition-colors hover:bg-[#E2E8F0]/70"
        title="Escolher função"
      >
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">{AGG_LABEL[agg]}</span>
        {display !== '' && display != null && (
          <span className="truncate text-xs font-semibold tabular-nums text-[#334155]">{display}</span>
        )}
      </button>

      {/* hover: resumo (abre p/ cima, ancorado p/ nao sair do viewport); opcoes clicaveis filtram */}
      {breakdown.length > 0 && (
        <div
          className={cn(
            'absolute bottom-full z-30 mb-1 hidden min-w-[190px] max-w-[min(340px,80vw)] rounded-md border border-[#E2E8F0] bg-white p-2 shadow-lg group-hover/agg:block',
            alignRight ? 'right-0' : 'left-0',
          )}
        >
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-[#94A3B8]">{breakdownTitle}</div>
          <div className="flex flex-col gap-0.5">
            {breakdown.slice(0, 10).map((b, i) => {
              const clickable = !!onFilter && b.filterValue != null
              const cells = (
                <>
                  <span className="truncate text-[#475569]">{b.label}</span>
                  <span className="flex shrink-0 items-baseline gap-1.5">
                    <span className="font-semibold tabular-nums text-[#0F172A]">{b.value}</span>
                    {b.pct && <span className="w-9 text-right font-normal tabular-nums text-[#94A3B8]">{b.pct}</span>}
                  </span>
                </>
              )
              return clickable ? (
                <button
                  key={i}
                  type="button"
                  title={`Filtrar por ${typeof b.label === 'string' ? b.label : 'este valor'}`}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onFilter!(field.id, b.filterValue!) }}
                  className="-mx-1 flex items-center justify-between gap-4 rounded px-1 py-0.5 text-left text-xs hover:bg-[#EFF6FF]"
                >
                  {cells}
                </button>
              ) : (
                <div key={i} className="flex items-center justify-between gap-4 py-0.5 text-xs">{cells}</div>
              )
            })}
            {breakdown.length > 10 && <div className="text-[10px] text-[#94A3B8]">+{breakdown.length - 10} mais</div>}
          </div>
        </div>
      )}

      {menu && (
        <FuncMenu
          anchorRef={cellRef}
          options={aggOptions(field)}
          value={agg}
          onPick={(fn) => { onAggChange(fn); setMenu(false) }}
          onClose={() => setMenu(false)}
        />
      )}
    </div>
  )
}
