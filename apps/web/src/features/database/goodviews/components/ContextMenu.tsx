import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

export interface MenuItem {
  icon?: ReactNode
  label: string
  onSelect?: () => void
  danger?: boolean
  disabled?: boolean
  hint?: string
  /** mantém o menu aberto após selecionar (multi-seleção, ex: agrupar por vários campos). */
  keepOpen?: boolean
}
/** separador: um `null` no array de itens vira divisoria. */
export type MenuEntry = MenuItem | null

/**
 * Menu de contexto reusavel (coluna, linha, etc). Posicao fixed (x,y),
 * clampado ao viewport. Backdrop fecha. `null` na lista = divisoria.
 */
export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number
  y: number
  items: MenuEntry[]
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: x, top: y })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - w - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - h - 8)),
    })
  }, [x, y])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="fixed inset-0 z-[60]" onMouseDown={(e) => { e.stopPropagation(); onClose() }} onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div
        ref={ref}
        className="fixed z-[61] min-w-[210px] overflow-hidden rounded-lg border border-[#E2E8F0] bg-white py-1 shadow-2xl"
        style={{ left: pos.left, top: pos.top }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {items.map((it, i) =>
          it === null ? (
            <div key={`d${i}`} className="my-1 h-px bg-[#E2E8F0]" />
          ) : (
            <button
              key={it.label + i}
              type="button"
              disabled={it.disabled}
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (it.disabled) return
                it.onSelect?.()
                if (!it.keepOpen) onClose()
              }}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm',
                it.disabled
                  ? 'cursor-not-allowed text-[#CBD5E1]'
                  : it.danger
                    ? 'cursor-pointer text-[#EF4444] hover:bg-[#FEF2F2]'
                    : 'cursor-pointer text-[#334155] hover:bg-[#F1F5F9]',
              )}
              title={it.hint}
            >
              {it.icon && <span className="flex size-4 shrink-0 items-center justify-center">{it.icon}</span>}
              <span className="flex-1 truncate">{it.label}</span>
              {it.disabled && it.hint && <span className="text-[10px] text-[#CBD5E1]">{it.hint}</span>}
            </button>
          ),
        )}
      </div>
    </>
  )
}
