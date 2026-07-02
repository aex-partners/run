import { type ReactNode } from 'react'
import { Info, Plus, Tag, Trash2 } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { Field } from '../types'
import { isGroup, type FilterCond, type FilterGroup, type FilterNode } from '../server'

// rotulos amigaveis dos operadores (o value continua a chave que o server entende)
const OP_LABEL: Record<string, string> = {
  contém: 'Contém',
  '=': 'É',
  '≠': 'Não é',
  '>': 'Maior que',
  '<': 'Menor que',
  '≥': 'Maior ou igual',
  '≤': 'Menor ou igual',
  tem: 'Contém',
  vazio: 'Vazio',
  preenchido: 'Preenchido',
}

// operadores de filtro por tipo de campo
export function opsFor(field?: Field): string[] {
  if (!field) return ['contém', '=', 'vazio', 'preenchido']
  if (['number', 'currency', 'percent'].includes(field.type)) return ['=', '≠', '>', '<', '≥', '≤', 'vazio', 'preenchido']
  if (['select', 'status', 'person'].includes(field.type)) return ['=', '≠', 'vazio', 'preenchido']
  if (['multiselect', 'relation'].includes(field.type)) return ['tem', 'vazio', 'preenchido']
  if (field.type === 'date') return ['=', '>', '<', 'vazio', 'preenchido']
  return ['contém', '=', '≠', 'vazio', 'preenchido']
}

// conta as condicoes "ativas" (com valor) na arvore -> badge de filtros
export function countFilterLeaves(n: FilterNode): number {
  const active = (c: FilterCond) => c.op === 'vazio' || c.op === 'preenchido' || c.value !== ''
  return isGroup(n) ? n.items.reduce((a, c) => a + countFilterLeaves(c), 0) : active(n) ? 1 : 0
}

// transforma um no num path (imutavel); fn(null) remove
function transform(node: FilterNode, path: number[], fn: (n: FilterNode) => FilterNode | null): FilterNode | null {
  if (path.length === 0) return fn(node)
  if (!isGroup(node)) return node
  const [i, ...rest] = path
  const items = node.items.map((c, idx) => (idx === i ? transform(c, rest, fn) : c)).filter((x): x is FilterNode => x != null)
  return { ...node, items }
}

const FCTL = 'h-8 rounded-md border border-[#E2E8F0] bg-white px-2 text-xs text-[#334155] outline-none focus:border-[#2563EB]'

/**
 * Painel de filtro em árvore (condições + subgrupos AND/OR, aninhados). Stateless:
 * recebe `value` e emite a árvore inteira via `onChange` a cada mutação. O
 * posicionamento/overlay fica com o consumidor. Compartilhado por TableView e ViewToolbar.
 */
export function FilterPanel({
  fields,
  value,
  onChange,
  recordOptions,
  headerRight,
}: {
  fields: Field[]
  value: FilterGroup
  onChange: (next: FilterGroup) => void
  recordOptions: { value: string; label: string }[]
  headerRight?: ReactNode
}) {
  const toggleableFields = fields.filter((f) => f.type !== 'id')
  const defaultLeaf = (): FilterCond => ({ fieldId: fields.find((f) => f.type !== 'id')?.id ?? '', op: 'contém', value: '' })
  const applyAt = (path: number[], fn: (n: FilterNode) => FilterNode | null) =>
    onChange((transform(value, path, fn) as FilterGroup | null) ?? { conj: 'and', items: [] })
  const updateLeaf = (path: number[], patch: Partial<FilterCond>) => applyAt(path, (n) => (isGroup(n) ? n : { ...n, ...patch }))
  const removeNode = (path: number[]) => applyAt(path, () => null)
  const addLeafTo = (groupPath: number[]) => applyAt(groupPath, (g) => (isGroup(g) ? { ...g, items: [...g.items, defaultLeaf()] } : g))
  const addGroupTo = (groupPath: number[]) => applyAt(groupPath, (g) => (isGroup(g) ? { ...g, items: [...g.items, { conj: 'and', items: [defaultLeaf()] }] } : g))
  const setConjAt = (groupPath: number[], conj: 'and' | 'or') => applyAt(groupPath, (g) => (isGroup(g) ? { ...g, conj } : g))
  const clearGroup = (groupPath: number[]) => {
    if (groupPath.length === 0) applyAt([], (g) => (isGroup(g) ? { ...g, items: [] } : g))
    else removeNode(groupPath)
  }

  function renderCondRow(cond: FilterCond, path: number[]): ReactNode {
    const cf = fields.find((f) => f.id === cond.fieldId)
    const noValue = cond.op === 'vazio' || cond.op === 'preenchido'
    return (
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <select
          value={cond.fieldId}
          onChange={(e) => { const nf = fields.find((f) => f.id === e.target.value); updateLeaf(path, { fieldId: e.target.value, op: opsFor(nf)[0], value: '' }) }}
          className={cn(FCTL, 'w-[150px] shrink-0')}
        >
          {toggleableFields.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <select value={cond.op} onChange={(e) => updateLeaf(path, { op: e.target.value })} className={cn(FCTL, 'w-[120px] shrink-0')}>
          {opsFor(cf).map((op) => <option key={op} value={op}>{OP_LABEL[op] ?? op}</option>)}
        </select>
        {noValue ? (
          <span className="flex-1" />
        ) : cf?.options ? (
          <select value={cond.value} onChange={(e) => updateLeaf(path, { value: e.target.value })} className={cn(FCTL, 'min-w-0 flex-1', cond.value ? '' : 'text-[#94A3B8]')}>
            <option value="">Selecionar opção</option>
            {cf.options.map((o) => <option key={o.value} value={o.value} className="text-[#334155]">{o.label}</option>)}
          </select>
        ) : cf?.type === 'relation' || cf?.type === 'multiselect' ? (
          <div className="relative min-w-0 flex-1">
            <Tag size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <select value={cond.value} onChange={(e) => updateLeaf(path, { value: e.target.value })} className={cn(FCTL, 'w-full pl-7', cond.value ? '' : 'text-[#94A3B8]')}>
              <option value="">Selecionar etiquetas</option>
              {(cf.type === 'relation' ? recordOptions : (cf.options ?? [])).map((o) => <option key={o.value} value={o.value} className="text-[#334155]">{o.label}</option>)}
            </select>
          </div>
        ) : (
          <input
            type={['number', 'currency', 'percent'].includes(cf?.type ?? '') ? 'number' : cf?.type === 'date' ? 'date' : 'text'}
            value={cond.value}
            onChange={(e) => updateLeaf(path, { value: e.target.value })}
            placeholder="Digite um valor"
            className={cn(FCTL, 'min-w-0 flex-1')}
          />
        )}
        <button onClick={() => removeNode(path)} className="shrink-0 p-1 text-[#94A3B8] hover:text-[#EF4444]" title="Remover"><Trash2 size={14} /></button>
      </div>
    )
  }

  function renderGroup(group: FilterGroup, path: number[]): ReactNode {
    return (
      <div className="rounded-md border border-[#E2E8F0] p-2">
        {group.items.map((item, i) => {
          const itemPath = [...path, i]
          return (
            <div key={i} className="mb-1.5 flex items-start gap-1.5 last:mb-0">
              <div className="w-12 shrink-0 pt-1.5 text-right">
                {i === 0 ? (
                  <span className="text-xs text-[#94A3B8]">Onde</span>
                ) : i === 1 ? (
                  <select value={group.conj} onChange={(e) => setConjAt(path, e.target.value as 'and' | 'or')} className="h-8 w-full rounded-md border border-[#E2E8F0] bg-white px-1 text-xs font-medium text-[#334155] outline-none focus:border-[#2563EB]">
                    <option value="and">E</option>
                    <option value="or">OU</option>
                  </select>
                ) : (
                  <span className="text-xs text-[#CBD5E1]">{group.conj === 'and' ? 'E' : 'OU'}</span>
                )}
              </div>
              {isGroup(item) ? <div className="min-w-0 flex-1">{renderGroup(item, itemPath)}</div> : renderCondRow(item, itemPath)}
            </div>
          )
        })}
        <div className="mt-2 flex items-center justify-between px-1 text-xs">
          <button onClick={() => addGroupTo(path)} className="text-[#2563EB] hover:underline">Adicionar filtro agrupado</button>
          <button onClick={() => clearGroup(path)} className="text-[#94A3B8] hover:text-[#EF4444]">{path.length === 0 ? 'Limpar grupo' : 'Remover grupo'}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-[560px] rounded-lg border border-[#E2E8F0] bg-white shadow-xl">
      <div className="flex h-11 items-center gap-2 border-b border-[#E2E8F0] px-4">
        <span className="text-sm font-semibold text-[#0F172A]">Filtros</span>
        <Info size={13} className="text-[#CBD5E1]" />
        {headerRight && <div className="ml-auto">{headerRight}</div>}
      </div>
      <div className="max-h-[420px] overflow-auto p-3">
        {value.items.length === 0 ? (
          <div className="px-1 pb-2 text-xs text-[#94A3B8]">Nenhuma condição ainda.</div>
        ) : (
          renderGroup(value, [])
        )}
        <button
          onClick={() => addLeafTo([])}
          className="mt-3 flex items-center gap-1.5 rounded-md border border-[#E2E8F0] px-2.5 py-1.5 text-xs font-medium text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB]"
        >
          <Plus size={14} /> Adicionar filtro
        </button>
      </div>
    </div>
  )
}
