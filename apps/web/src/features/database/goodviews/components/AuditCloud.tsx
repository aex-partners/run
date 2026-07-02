import { useMemo, useState, type ReactNode } from 'react'
import { Cloud, RotateCcw, ScrollText, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { AuditEntry } from '../types'

function absTime(ts: number): string {
  return new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}
function fmtVal(v: unknown): string {
  if (v == null || v === '') return '∅'
  if (Array.isArray(v)) return v.length ? v.map(String).join(', ') : '∅'
  return String(v)
}

interface AuditCloudProps {
  /** pisca verde ao persistir. */
  saved: boolean
  entries: AuditEntry[]
  /** se a entry ainda pode ser revertida (nao revertida + suportada). */
  canRevert: (e: AuditEntry) => boolean
  onRevert: (e: AuditEntry) => void
  /** id do campo -> rotulo legivel. */
  fieldLabel?: (id: string) => string
  /** renderiza o grid com um componente externo (ex a propria TableView, que ja filtra). */
  renderGrid?: (entries: AuditEntry[]) => ReactNode
  /** largura natural do grid (soma das colunas) p/ o modal hugar as colunas. */
  gridWidth?: number
}

/** Nuvem de autosave. Clique abre o modal de logs (grid + reverter). */
export function AuditCloud({ saved, entries, canRevert, onRevert, fieldLabel = (id) => id, renderGrid, gridWidth }: AuditCloudProps) {
  const [open, setOpen] = useState(false)
  const sorted = useMemo(() => [...entries].sort((a, b) => b.ts - a.ts), [entries])

  // dimensoes: largura min-auto pelas colunas (cap = tela); altura min-auto pelas linhas, max = tela
  const size = open && typeof window !== 'undefined'
    ? {
        width: Math.min(window.innerWidth * 0.96, gridWidth ?? 1100),
        height: Math.min(window.innerHeight * 0.92, 224 + Math.min(Math.max(entries.length, 1), 25) * 40),
      }
    : null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Histórico de alterações"
        className="flex size-7 items-center justify-center"
      >
        <Cloud size={16} className={cn('transition-colors duration-300', saved ? 'animate-pulse text-[#10B981]' : 'text-[#CBD5E1]')} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onMouseDown={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative flex flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-2xl"
            style={{ width: size?.width, height: size?.height, maxHeight: '92vh', maxWidth: '96vw' }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* cabecalho */}
            <div className="flex shrink-0 items-center justify-between border-b border-[#E2E8F0] px-5 py-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-[#0F172A]"><ScrollText size={17} /> Logs de alteração</h2>
                <p className="mt-0.5 text-xs text-[#94A3B8]">{entries.length} registro{entries.length === 1 ? '' : 's'} · auditoria imutável (reverter cria nova operação)</p>
              </div>
              <button onClick={() => setOpen(false)} className="flex size-8 items-center justify-center rounded-md text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#475569]"><X size={18} /></button>
            </div>

            {/* corpo: grid externo (TableView, que ja tem filtro proprio) ou lista fallback */}
            {renderGrid ? (
              <div className="min-h-0 flex-1">{renderGrid(sorted)}</div>
            ) : (
              <div className="flex-1 overflow-auto px-2 py-1">
                {sorted.length === 0 && <div className="px-3 py-12 text-center text-sm text-[#94A3B8]">Nenhuma alteração registrada ainda.</div>}
                {sorted.map((e) => (
                  <div key={e.id} className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-[#F8FAFC]">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-[#0F172A]">{e.label}</div>
                      {e.cells?.length === 1 && (
                        <div className="truncate text-[11px] text-[#64748B]">
                          <span className="text-[#94A3B8]">{fieldLabel(e.cells[0].fieldId)}:</span> {fmtVal(e.cells[0].before)} → <span className="font-medium text-[#0F172A]">{fmtVal(e.cells[0].after)}</span>
                        </div>
                      )}
                      <div className="mt-0.5 text-[11px] text-[#94A3B8]">{e.user} · {absTime(e.ts)}</div>
                    </div>
                    {canRevert(e) && (
                      <button onClick={() => onRevert(e)} className="mt-0.5 flex shrink-0 items-center gap-1 rounded-md border border-[#E2E8F0] px-2 py-1 text-xs font-medium text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB]">
                        <RotateCcw size={12} /> Reverter
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
