import { type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Combobox } from './Combobox'
import { FileFieldEditor } from './FileField'
import type { Field } from '../types'

/**
 * Editor inline tipado por campo (estilo planilha), extraído da TableView. Um
 * editor por tipo: combobox (select/status/person/multiselect/relation), arquivo/
 * imagem (Drive+upload+link), número/moeda/percentual, data, texto. Navegação
 * via Nav (Tab/Shift+Tab/Enter/Esc). Compartilhado por TableView e demais views.
 */
export interface Nav {
  onTab: () => void
  onShiftTab: () => void
  onEnter: () => void
  onEsc: () => void
}

export interface EditCellProps extends Nav {
  field: Field
  value: unknown
  recordOptions: { value: string; label: string }[]
  /**
   * Opções da entidade-ALVO de um campo relation (id + rótulo). Quando fornecidas,
   * o editor de relação usa estas (fonte server-side) no lugar de `recordOptions`.
   */
  relationOptions?: { value: string; label: string }[]
  /** notifica a busca digitada no editor de relação (refetch server-side no host). */
  onRelationSearch?: (q: string) => void
  onCommit: (val: unknown) => void
}

// Editor SEM caixa: transparente, sem borda/fundo/padding (estilo Excel).
const EDIT_BASE = 'w-full bg-transparent border-0 outline-none p-0 m-0'

export function EditCell({ field, value, recordOptions, relationOptions, onRelationSearch, onCommit, onTab, onShiftTab, onEnter, onEsc }: EditCellProps) {
  function handleKey(e: ReactKeyboardEvent, commit: () => void) {
    if (e.key === 'Enter') { e.preventDefault(); commit(); onEnter() }
    else if (e.key === 'Tab') { e.preventDefault(); commit(); if (e.shiftKey) onShiftTab(); else onTab() }
    else if (e.key === 'Escape') { e.preventDefault(); onEsc() }
  }

  // Array (multiselect, ex tags) , busca + multimarcar + regra min/max + creatable
  if (field.type === 'multiselect' && field.options) {
    return <Combobox options={field.options} value={value} min={field.min} max={field.max} creatable={field.creatable} onCommit={onCommit} onClose={onEsc} />
  }

  // Relação: usa as opções da entidade-ALVO (server-side) quando o host fornece;
  // senão cai no `recordOptions` local (modo sandbox/lab).
  const relOpts = relationOptions ?? recordOptions

  // Lookup multiplo (relacao em array, ex dependeDe)
  if (field.type === 'relation' && (field.id === 'dependeDe' || Array.isArray(value))) {
    return <Combobox options={relOpts} value={value} min={field.min} max={field.max} onSearch={onRelationSearch} onCommit={onCommit} onClose={onEsc} />
  }

  // Lookup single (relacao, ex parentId) , combobox searchable de um item
  if (field.type === 'relation') {
    return <Combobox options={relOpts} value={value} single onSearch={onRelationSearch} onCommit={onCommit} onClose={onEsc} />
  }

  // Select / status / person , a MESMA combobox padrao (single, searchable, creatable opcional)
  if ((field.type === 'select' || field.type === 'status' || field.type === 'person') && field.options) {
    return <Combobox options={field.options} value={value} single creatable={field.creatable} onCommit={onCommit} onClose={onEsc} />
  }

  // Arquivo(s): Drive + upload + link
  if (field.type === 'file') {
    return <FileFieldEditor value={value} onCommit={onCommit} onClose={onEsc} multiple={field.multiple ?? true} />
  }

  // Imagem(ns): mesmo editor (Drive + upload + link), modo imagem (thumbnails, URLs)
  if (field.type === 'image') {
    return <FileFieldEditor value={value} onCommit={onCommit} onClose={onEsc} imagesOnly multiple={field.multiple ?? false} />
  }

  // Numero / moeda / percentual , input numerico puro sem spinner (moeda edita como numero; % com sufixo)
  if (field.type === 'number' || field.type === 'currency' || field.type === 'percent') {
    const noSpin = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
    const inp = (
      <input
        type="number"
        step={field.type === 'currency' ? '0.01' : 'any'}
        autoFocus
        className={`${EDIT_BASE} text-xs font-mono text-[#0F172A] text-right ${noSpin}`}
        defaultValue={value == null ? '' : String(value)}
        onMouseDown={(e) => e.stopPropagation()}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => onCommit(e.currentTarget.value === '' ? null : Number(e.currentTarget.value))}
        onKeyDown={(e) => handleKey(e, () => {
          const v = (e.target as HTMLInputElement).value
          onCommit(v === '' ? null : Number(v))
        })}
      />
    )
    if (field.type === 'percent') {
      return (
        <div className="flex items-center gap-1 w-full" onMouseDown={(e) => e.stopPropagation()}>
          {inp}
          <span className="text-xs text-[#94A3B8]">%</span>
        </div>
      )
    }
    return inp
  }

  // Data
  if (field.type === 'date') {
    return (
      <input
        type="date"
        autoFocus
        className={`${EDIT_BASE} text-xs text-[#0F172A]`}
        defaultValue={typeof value === 'string' ? value : ''}
        onMouseDown={(e) => e.stopPropagation()}
        onBlur={(e) => onCommit(e.currentTarget.value)}
        onKeyDown={(e) => handleKey(e, () => onCommit((e.target as HTMLInputElement).value))}
      />
    )
  }

  // Texto livre (nome, text, image url, etc)
  return (
    <input
      type="text"
      autoFocus
      className={`${EDIT_BASE} text-sm text-[#0F172A]`}
      defaultValue={typeof value === 'string' ? value : ''}
      onMouseDown={(e) => e.stopPropagation()}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={(e) => onCommit(e.currentTarget.value)}
      onKeyDown={(e) => handleKey(e, () => onCommit((e.target as HTMLInputElement).value))}
    />
  )
}
