import { useState } from 'react'
import { Plus, Trash2, ArrowLeft } from 'lucide-react'
import type { FieldType } from '../goodviews/types'

/** Field types offered in the creation form (mirrors the header-menu editor). */
const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Texto' },
  { value: 'longtext', label: 'Texto longo' },
  { value: 'number', label: 'Número' },
  { value: 'currency', label: 'Moeda' },
  { value: 'percent', label: 'Percentual' },
  { value: 'date', label: 'Data' },
  { value: 'select', label: 'Seleção' },
  { value: 'status', label: 'Status' },
  { value: 'multiselect', label: 'Multi-seleção' },
  { value: 'person', label: 'Pessoa' },
  { value: 'url', label: 'URL' },
  { value: 'relation', label: 'Relação' },
]
const CHOICE_TYPES: FieldType[] = ['select', 'status', 'multiselect']

interface FieldDraft {
  key: number
  name: string
  type: FieldType
  /** comma/newline separated option labels (select/status/multiselect). */
  optionsText: string
  /** target entity id (relation). */
  relTarget: string
  /** campo obrigatório. */
  required: boolean
  /** valor padrão (option value) p/ campo de seleção. */
  defaultValue: string
}

/** The payload shape the host turns into `entities.createEntity`. */
export interface CreateEntityPayload {
  name: string
  description?: string
  fields: {
    name: string
    type: FieldType
    options?: { value: string; label: string }[]
    relationshipEntityId?: string
    required?: boolean
    defaultValue?: string
  }[]
}

interface Props {
  /** entities available as relation targets. */
  entities: { id: string; name: string }[]
  onCreate: (payload: CreateEntityPayload) => void
  onCancel: () => void
  busy?: boolean
}

let nextKey = 1

/**
 * Full-screen (content-area) entity creation form: name + description + a list of
 * initial fields (name/type, with options for choice types and a target picker for
 * relations). Rendered in place of the Table View while creating.
 */
export function CreateEntityScreen({ entities, onCreate, onCancel, busy }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [fields, setFields] = useState<FieldDraft[]>([])

  function addField() {
    setFields((f) => [...f, { key: nextKey++, name: '', type: 'text', optionsText: '', relTarget: '', required: false, defaultValue: '' }])
  }
  function patchField(key: number, patch: Partial<FieldDraft>) {
    setFields((f) => f.map((x) => (x.key === key ? { ...x, ...patch } : x)))
  }
  function removeField(key: number) {
    setFields((f) => f.filter((x) => x.key !== key))
  }

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    const payloadFields: CreateEntityPayload['fields'] = fields
      .filter((f) => f.name.trim())
      .map((f) => {
        const opts = f.optionsText
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((label) => ({ value: label, label }))
        const isChoice = CHOICE_TYPES.includes(f.type)
        return {
          name: f.name.trim(),
          type: f.type,
          ...(isChoice && opts.length ? { options: opts } : {}),
          ...(f.type === 'relation' && f.relTarget ? { relationshipEntityId: f.relTarget } : {}),
          ...(f.required ? { required: true } : {}),
          ...(isChoice && f.defaultValue ? { defaultValue: f.defaultValue } : {}),
        }
      })
    onCreate({ name: trimmed, description: description.trim() || undefined, fields: payloadFields })
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
      {/* header bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
        <button type="button" onClick={onCancel} aria-label="Voltar" style={iconBtn}>
          <ArrowLeft size={17} />
        </button>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>Nova entidade</h1>
      </div>

      {/* scrollable form, centered column */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 20px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <label style={fieldLabel}>
            Nome
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Clientes" style={input} />
          </label>

          <label style={fieldLabel}>
            Descrição <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(opcional)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Pra que serve essa tabela (também ajuda o Eric)"
              rows={2}
              style={{ ...input, resize: 'vertical' }}
            />
          </label>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Campos iniciais</span>
              <button type="button" onClick={addField} style={ghostBtn}>
                <Plus size={14} /> Adicionar campo
              </button>
            </div>

            {fields.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                Nenhum campo ainda. Adicione, ou crie sem campos e monte depois na tabela.
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {fields.map((f) => (
                <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, border: '1px solid var(--border)', borderRadius: 10 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={f.name}
                      onChange={(e) => patchField(f.key, { name: e.target.value })}
                      placeholder="Nome do campo"
                      style={{ ...input, flex: 1 }}
                    />
                    <select
                      value={f.type}
                      onChange={(e) => patchField(f.key, { type: e.target.value as FieldType })}
                      style={{ ...input, width: 150 }}
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => removeField(f.key)} aria-label="Remover campo" style={iconBtn}>
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {CHOICE_TYPES.includes(f.type) && (
                    <input
                      value={f.optionsText}
                      onChange={(e) => patchField(f.key, { optionsText: e.target.value })}
                      placeholder="Opções separadas por vírgula (ex: Aberto, Pago, Vencido)"
                      style={input}
                    />
                  )}

                  {f.type === 'relation' && (
                    <select value={f.relTarget} onChange={(e) => patchField(f.key, { relTarget: e.target.value })} style={input}>
                      <option value="">Vincular a qual entidade?</option>
                      {entities.map((e) => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={(e) => patchField(f.key, { required: e.target.checked })}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      Obrigatório
                    </label>

                    {CHOICE_TYPES.includes(f.type) && (() => {
                      const opts = f.optionsText.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)
                      return (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', flex: 1, minWidth: 160 }}>
                          Padrão
                          <select
                            value={f.defaultValue}
                            onChange={(e) => patchField(f.key, { defaultValue: e.target.value })}
                            style={{ ...input, flex: 1 }}
                          >
                            <option value="">Nenhum</option>
                            {opts.map((o) => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                        </label>
                      )
                    })()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* footer actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
        <button type="button" onClick={onCancel} style={ghostBtn}>Cancelar</button>
        <button type="button" onClick={submit} disabled={!name.trim() || busy} style={{ ...primaryBtn, opacity: !name.trim() || busy ? 0.5 : 1 }}>
          {busy ? 'Criando…' : 'Criar entidade'}
        </button>
      </div>
    </div>
  )
}

const input: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: 13,
  color: 'var(--text)',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 7,
  outline: 'none',
}
const fieldLabel: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text)',
}
const iconBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  background: 'transparent',
  border: 'none',
  borderRadius: 7,
  color: 'var(--text-muted)',
  cursor: 'pointer',
}
const ghostBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--text)',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  cursor: 'pointer',
}
const primaryBtn: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: 13,
  fontWeight: 600,
  color: '#ffffff',
  background: 'var(--accent)',
  border: '1px solid var(--accent)',
  borderRadius: 8,
  cursor: 'pointer',
}
