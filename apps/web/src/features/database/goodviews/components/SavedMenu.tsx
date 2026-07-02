import { useEffect, useRef, useState } from 'react'
import { Check, Globe, Lock, Pencil, Plus, RotateCcw, Star, Trash2, Users } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { Saved, Scope } from '../storage'

/**
 * Config da "view padrão" (só p/ o menu de Views, não p/ filtros). `currentId` =
 * id da view marcada como padrão do usuário (null = a "View Padrão" pristine).
 * `onApplyPristine` volta ao pristine; `onStar` marca uma como padrão (id ou null).
 */
export interface DefaultsConfig {
  currentId: string | null
  onApplyPristine: () => void
  onStar: (id: string | null) => void
}

function StarBtn({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onClick() }}
      className={cn('shrink-0 p-1', on ? 'text-[#F59E0B]' : 'text-[#CBD5E1] opacity-0 hover:text-[#F59E0B] group-hover/it:opacity-100')}
      title={on ? 'É a sua view padrão (auto-aplica ao entrar)' : 'Tornar minha view padrão'}
    >
      <Star size={13} className={on ? 'fill-[#F59E0B]' : ''} />
    </button>
  )
}

export function scopeIcon(scope: Scope, size = 14) {
  if (scope === 'public') return <Globe size={size} className="shrink-0 text-[#94A3B8]" />
  if (scope === 'shared') return <Users size={size} className="shrink-0 text-[#94A3B8]" />
  return <Lock size={size} className="shrink-0 text-[#94A3B8]" />
}

/**
 * Dropdown de itens salvos (views/filtros): lista + aplicar + editar/excluir +
 * form inline. Escopo: privado / publico / compartilhado (escolhe usuarios).
 */
export function SavedMenu<T>({
  x,
  y,
  title,
  items,
  users,
  onApply,
  onSave,
  onDelete,
  onClose,
  dirty = false,
  appliedName = null,
  onUpdate,
  defaults,
}: {
  x: number
  y: number
  title: string
  items: Saved<T>[]
  users: { value: string; label: string }[]
  onApply: (it: Saved<T>) => void
  onSave: (name: string, scope: Scope, sharedWith: string[] | undefined, editingId: string | null) => void
  onDelete: (id: string) => void
  onClose: () => void
  /** há mudanças não salvas na view atual , mostra a faixa de salvar/atualizar. */
  dirty?: boolean
  /** nome da view aplicada (p/ o botão "Atualizar"). null = nenhuma aplicada. */
  appliedName?: string | null
  /** sobrescreve a view aplicada com o estado atual. */
  onUpdate?: () => void
  /** habilita a "View Padrão" pristine + estrelas (só no menu de Views). */
  defaults?: DefaultsConfig
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })
  const [mode, setMode] = useState<'list' | 'form'>('list')
  const [name, setName] = useState('')
  const [scope, setScope] = useState<Scope>('private')
  const [sharedWith, setSharedWith] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - el.offsetWidth - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - el.offsetHeight - 8)),
    })
  }, [x, y, mode, scope])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function openForm(it?: Saved<T>) {
    if (it) { setEditingId(it.id); setName(it.name); setScope(it.scope); setSharedWith(it.sharedWith ?? []) }
    else { setEditingId(null); setName(''); setScope('private'); setSharedWith([]) }
    setMode('form')
  }
  function submit() {
    if (!name.trim()) return
    onSave(name.trim(), scope, scope === 'shared' ? sharedWith : undefined, editingId)
    onClose()
  }
  function toggleUser(u: string) {
    setSharedWith((prev) => (prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]))
  }

  const scopeLabel = (s: Scope, n?: number) => (s === 'public' ? 'Público' : s === 'shared' ? `Compartilhado${n ? ` (${n})` : ''}` : 'Privado')

  return (
    <>
      <div className="fixed inset-0 z-[60]" onMouseDown={(e) => { e.stopPropagation(); onClose() }} />
      <div
        ref={ref}
        className="fixed z-[61] w-[280px] rounded-lg border border-[#E2E8F0] bg-white py-1 shadow-2xl"
        style={{ left: pos.left, top: pos.top }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {mode === 'list' ? (
          <>
            {dirty && (
              <div className="border-b border-[#FDE68A] bg-[#FFFBEB] px-3 py-2">
                <div className="mb-1.5 text-[11px] font-medium text-[#B45309]">Alterações não salvas nesta view</div>
                {appliedName ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onMouseDown={(e) => { e.preventDefault(); onUpdate?.(); onClose() }}
                      className="min-w-0 flex-1 truncate rounded-md bg-[#2563EB] px-2 py-1 text-xs font-medium text-white hover:bg-[#1D4ED8]"
                      title={`Atualizar “${appliedName}” com o estado atual`}
                    >
                      Atualizar “{appliedName}”
                    </button>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); openForm() }}
                      className="shrink-0 rounded-md border border-[#E2E8F0] px-2 py-1 text-xs font-medium text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB]"
                    >
                      Salvar como nova…
                    </button>
                  </div>
                ) : (
                  <button
                    onMouseDown={(e) => { e.preventDefault(); openForm() }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[#2563EB] px-2 py-1 text-xs font-medium text-white hover:bg-[#1D4ED8]"
                  >
                    <Plus size={14} /> Salvar como view…
                  </button>
                )}
              </div>
            )}
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">{title}</div>
            {defaults && (
              <div className="group/it flex items-center gap-1 pl-3 pr-2 hover:bg-[#F1F5F9]">
                <button onMouseDown={(e) => { e.preventDefault(); defaults.onApplyPristine(); onClose() }} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm text-[#334155]">
                  <RotateCcw size={14} className="shrink-0 text-[#94A3B8]" />
                  <span className="truncate">View Padrão</span>
                  <span className="shrink-0 text-[10px] text-[#CBD5E1]">base</span>
                </button>
                <StarBtn on={defaults.currentId === null} onClick={() => defaults.onStar(null)} />
              </div>
            )}
            {items.length === 0 ? (
              !defaults && <div className="px-3 py-2 text-xs text-[#94A3B8]">Nada salvo ainda.</div>
            ) : (
              items.map((it) => (
                <div key={it.id} className="group/it flex items-center gap-1 pl-3 pr-2 hover:bg-[#F1F5F9]">
                  <button onMouseDown={(e) => { e.preventDefault(); onApply(it); onClose() }} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm text-[#334155]">
                    {scopeIcon(it.scope)}
                    <span className="truncate">{it.name}</span>
                    <span className="shrink-0 text-[10px] text-[#CBD5E1]">{scopeLabel(it.scope, it.sharedWith?.length)}</span>
                  </button>
                  {defaults && <StarBtn on={defaults.currentId === it.id} onClick={() => defaults.onStar(it.id)} />}
                  <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); openForm(it) }} className="shrink-0 p-1 text-[#CBD5E1] opacity-0 hover:text-[#2563EB] group-hover/it:opacity-100" title="Editar"><Pencil size={13} /></button>
                  <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(it.id) }} className="shrink-0 p-1 text-[#CBD5E1] opacity-0 hover:text-[#EF4444] group-hover/it:opacity-100" title="Excluir"><Trash2 size={13} /></button>
                </div>
              ))
            )}
            <div className="my-1 h-px bg-[#E2E8F0]" />
            <button onMouseDown={(e) => { e.preventDefault(); openForm() }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[#2563EB] hover:bg-[#EFF6FF]">
              <Plus size={15} /> Salvar atual…
            </button>
          </>
        ) : (
          <div className="p-2">
            <div className="mb-2 px-1 text-xs font-medium text-[#475569]">{editingId ? 'Editar' : 'Salvar'}</div>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setMode('list') }}
              placeholder="Nome"
              className="mb-2 h-8 w-full rounded-md border border-[#E2E8F0] px-2 text-sm text-[#0F172A] outline-none focus:border-[#2563EB]"
            />
            <div className="mb-2 grid grid-cols-3 gap-1.5">
              {(['private', 'public', 'shared'] as Scope[]).map((sc) => (
                <button
                  key={sc}
                  onMouseDown={(e) => { e.preventDefault(); setScope(sc) }}
                  className={cn('flex flex-col items-center gap-1 rounded-md border px-1 py-1.5 text-[11px] font-medium', scope === sc ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]' : 'border-[#E2E8F0] text-[#475569] hover:border-[#CBD5E1]')}
                >
                  {scopeIcon(sc)}
                  {scopeLabel(sc)}
                </button>
              ))}
            </div>
            {scope === 'shared' && (
              <div className="mb-2 max-h-[140px] overflow-auto rounded-md border border-[#E2E8F0] p-1">
                <div className="px-2 py-1 text-[10px] text-[#94A3B8]">Compartilhar com</div>
                {users.map((u) => {
                  const on = sharedWith.includes(u.value)
                  return (
                    <button key={u.value} onMouseDown={(e) => { e.preventDefault(); toggleUser(u.value) }} className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm text-[#334155] hover:bg-[#F1F5F9]">
                      <Check size={14} className={cn('shrink-0', on ? 'opacity-100 text-[#2563EB]' : 'opacity-0')} />
                      <span className="truncate">{u.label}</span>
                    </button>
                  )
                })}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onMouseDown={(e) => { e.preventDefault(); setMode('list') }} className="rounded-md px-2.5 py-1 text-xs font-medium text-[#475569] hover:bg-[#F1F5F9]">Cancelar</button>
              <button onMouseDown={(e) => { e.preventDefault(); submit() }} disabled={!name.trim() || (scope === 'shared' && sharedWith.length === 0)} className="rounded-md bg-[#2563EB] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40 enabled:hover:bg-[#1D4ED8]">Salvar</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
