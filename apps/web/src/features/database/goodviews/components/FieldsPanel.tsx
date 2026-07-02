import { useState } from 'react'
import { FileText, GripVertical, Image as ImageIcon, Link2, Search as SearchIcon, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { Field, FieldType } from '../types'

// ícone de tipo (mídia) prefixado na linha do campo; demais tipos = espaçador p/ alinhar
function FieldTypeIcon({ type }: { type: FieldType }) {
  const cls = 'shrink-0 text-[#94A3B8]'
  if (type === 'file') return <FileText size={14} className={cls} />
  if (type === 'url') return <Link2 size={14} className={cls} />
  if (type === 'image') return <ImageIcon size={14} className={cls} />
  return <span className="inline-block size-[14px] shrink-0" aria-hidden />
}

// pill switch reutilizado nas colunas Exibir / Rodapé
function Switch({ on, onClick, title }: { on: boolean; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn('relative h-4 w-7 shrink-0 rounded-full transition-colors', on ? 'bg-[#2563EB]' : 'bg-[#CBD5E1]')}
    >
      <span className={cn('absolute top-0.5 size-3 rounded-full bg-white transition-all', on ? 'left-[14px]' : 'left-0.5')} />
    </button>
  )
}

/**
 * Drawer de campos (à direita, contido na altura do componente). Busca + duas
 * colunas de slot: "Exibir" (campo aparece na view) e, opcional, "Rodapé" (campo
 * é agregado no footer). Compartilhado por TableView e ViewToolbar.
 */
/** mime usado p/ arrastar um campo da drawer (ex: soltar num card do Kanban). */
export const FIELD_DND_MIME = 'application/x-lab-field'

export function FieldsPanel({
  toggleableFields,
  visibleIds,
  onToggle,
  onClose,
  footerIds,
  onToggleFooter,
  draggable = false,
}: {
  toggleableFields: Field[]
  visibleIds: string[]
  onToggle: (fieldId: string) => void
  onClose: () => void
  /** se fornecido, mostra a 2ª coluna "Rodapé" (membros agregados no footer). */
  footerIds?: string[]
  onToggleFooter?: (fieldId: string) => void
  /** linhas viram arrastáveis (HTML5 drag) p/ soltar o campo em outra área (ex card Kanban). */
  draggable?: boolean
}) {
  const [colSearch, setColSearch] = useState('')
  const q = colSearch.trim().toLowerCase()
  const list = toggleableFields.filter((f) => !q || f.label.toLowerCase().includes(q))
  const hasFooter = !!onToggleFooter

  return (
    <>
      {/* backdrop fecha ao clicar fora; em modo arrastável deixa o drag passar p/ o board */}
      <div className={cn('absolute inset-0 z-40', draggable && 'pointer-events-none')} onMouseDown={onClose} />
      <div className="absolute right-0 top-0 bottom-0 z-50 flex w-[320px] flex-col border-l border-[#E2E8F0] bg-white shadow-2xl">
        <div className="flex h-12 items-center justify-between border-b border-[#E2E8F0] px-4">
          <span className="text-sm font-semibold text-[#0F172A]">Campos</span>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A]"><X size={16} /></button>
        </div>
        <div className="border-b border-[#E2E8F0] p-3">
          <div className="flex items-center gap-2 rounded-md border border-[#E2E8F0] px-2.5 h-8">
            <SearchIcon size={14} className="shrink-0 text-[#94A3B8]" />
            <input
              value={colSearch}
              onChange={(e) => setColSearch(e.target.value)}
              placeholder="Pesquisar campos"
              className="w-full bg-transparent text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
            />
          </div>
        </div>

        {/* lista com cabeçalho de colunas sticky DENTRO do scroll (mesma largura
            das linhas, sem desalinhar pela barra de rolagem) */}
        <div className="flex-1 overflow-auto">
          {draggable ? (
            <div className="sticky top-0 z-10 border-b border-[#E2E8F0] bg-white px-4 py-2 text-[11px] text-[#94A3B8]">
              Arraste um campo p/ o <span className="font-medium text-[#475569]">card</span> ou p/ o <span className="font-medium text-[#475569]">rodapé</span> da coluna.
            </div>
          ) : (
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-[#E2E8F0] bg-white px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
              <span className="flex-1">Campo</span>
              <span className="w-12 text-center">Exibir</span>
              {hasFooter && <span className="w-12 text-center">Rodapé</span>}
            </div>
          )}
          <div className="py-1">
            {list.map((f) => {
              const visible = visibleIds.includes(f.id)
              const inFooter = footerIds?.includes(f.id) ?? false
              return (
                <div
                  key={f.id}
                  draggable={draggable}
                  onDragStart={draggable ? (e) => { e.dataTransfer.setData(FIELD_DND_MIME, f.id); e.dataTransfer.setData('text/plain', f.id); e.dataTransfer.effectAllowed = 'copy' } : undefined}
                  className={cn('flex items-center gap-2 px-4 py-2 hover:bg-[#F8FAFC]', draggable && 'cursor-grab active:cursor-grabbing')}
                >
                  {draggable && <GripVertical size={13} className="shrink-0 text-[#CBD5E1]" />}
                  <FieldTypeIcon type={f.type} />
                  <span className="flex-1 truncate text-sm text-[#334155]">{f.label}</span>
                  {!draggable && (
                    <>
                      <span className="flex w-12 justify-center">
                        <Switch on={visible} onClick={() => onToggle(f.id)} title="Exibir na lista" />
                      </span>
                      {hasFooter && (
                        <span className="flex w-12 justify-center">
                          <Switch on={inFooter} onClick={() => onToggleFooter!(f.id)} title="Agregar no rodapé" />
                        </span>
                      )}
                    </>
                  )}
                </div>
              )
            })}
            {list.length === 0 && <div className="px-4 py-3 text-xs text-[#94A3B8]">Nada encontrado</div>}
          </div>
        </div>
      </div>
    </>
  )
}
