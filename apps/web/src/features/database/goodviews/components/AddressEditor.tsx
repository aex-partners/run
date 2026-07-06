import { useEffect, useRef, useState } from 'react'

// Campos do endereço estruturado (na ordem do formulário). `w` = largura relativa
// (grid de 6 colunas) p/ CEP/número/UF ficarem menores.
const FIELDS: { key: string; label: string; w: number }[] = [
  { key: 'cep', label: 'CEP', w: 2 },
  { key: 'logradouro', label: 'Logradouro', w: 4 },
  { key: 'numero', label: 'Número', w: 2 },
  { key: 'complemento', label: 'Complemento', w: 4 },
  { key: 'bairro', label: 'Bairro', w: 3 },
  { key: 'municipio', label: 'Município', w: 3 },
  { key: 'uf', label: 'UF', w: 1 },
  { key: 'pais', label: 'País', w: 5 },
]

/**
 * Editor do campo `address`: mini-formulário flutuante ancorado à célula. Comita
 * um objeto { cep, logradouro, numero, ... } (ou null se tudo vazio). Aceita valor
 * inicial objeto ou string (dados legados viram `logradouro`).
 */
export function AddressEditor({
  value,
  onCommit,
  onClose,
}: {
  value: unknown
  onCommit: (v: unknown) => void
  onClose: () => void
}) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const init: Record<string, string> =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, string>)
      : typeof value === 'string' && value
        ? { logradouro: value }
        : {}
  const [parts, setParts] = useState<Record<string, string>>(init)

  useEffect(() => {
    const r = anchorRef.current?.getBoundingClientRect()
    if (!r) return
    const width = 340
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
    const top = Math.min(r.bottom + 4, window.innerHeight - 320)
    setPos({ top, left })
  }, [])

  function save() {
    const out: Record<string, string> = {}
    for (const { key } of FIELDS) {
      const v = (parts[key] ?? '').trim()
      if (v) out[key] = v
    }
    onCommit(Object.keys(out).length ? out : null)
    onClose()
  }

  const inputCls =
    'w-full rounded border border-[#E2E8F0] px-1.5 py-1 text-xs text-[#0F172A] outline-none focus:border-[#2563EB]'

  return (
    <>
      <div ref={anchorRef} className="h-5" onMouseDown={(e) => e.stopPropagation()} />
      <div className="fixed inset-0 z-40" onMouseDown={(e) => { e.stopPropagation(); save() }} />
      {pos && (
        <div
          className="fixed z-50 w-[340px] rounded-md border border-[#E2E8F0] bg-white p-2.5 shadow-xl"
          style={{ top: pos.top, left: pos.left }}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }}
        >
          <div className="grid grid-cols-6 gap-1.5">
            {FIELDS.map((f) => (
              <label key={f.key} className="flex flex-col gap-0.5" style={{ gridColumn: `span ${f.w}` }}>
                <span className="text-[10px] font-medium text-[#94A3B8]">{f.label}</span>
                <input
                  autoFocus={f.key === 'cep'}
                  value={parts[f.key] ?? ''}
                  onChange={(e) => setParts((p) => ({ ...p, [f.key]: e.target.value }))}
                  className={inputCls}
                />
              </label>
            ))}
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-[#E2E8F0] px-2 py-1 text-[11px] text-[#475569] hover:bg-[#F8FAFC]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded bg-[#2563EB] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#1D4ED8]"
            >
              Salvar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
