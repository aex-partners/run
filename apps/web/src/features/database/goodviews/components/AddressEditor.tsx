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

// Siglas dos 27 estados (UF vira um select fixo em vez de texto livre).
const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
  'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

// Consulta ViaCEP (público, com CORS) e devolve os campos do endereço, ou null
// se o CEP não tiver 8 dígitos / não existir. Fetch client-side direto do browser.
async function lookupCep(cepRaw: string): Promise<Partial<Record<string, string>> | null> {
  const cep = (cepRaw || '').replace(/\D/g, '')
  if (cep.length !== 8) return null
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const d = await res.json()
    if (d?.erro) return null
    return {
      logradouro: d.logradouro || '',
      bairro: d.bairro || '',
      municipio: d.localidade || '',
      uf: d.uf || '',
      pais: 'Brasil',
    }
  } catch {
    return null
  }
}

// Municípios por UF (IBGE), cacheados por UF entre aberturas do editor. Alimentam
// um <datalist> (combo com busca nativa) no campo Município.
const ibgeCache = new Map<string, string[]>()
async function fetchMunicipios(uf: string): Promise<string[]> {
  const key = (uf || '').toUpperCase()
  if (!key) return []
  if (ibgeCache.has(key)) return ibgeCache.get(key) as string[]
  try {
    const res = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${key}/municipios`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (!res.ok) return []
    const arr = await res.json()
    const names: string[] = Array.isArray(arr)
      ? arr.map((m: { nome?: string }) => m?.nome).filter((n): n is string => !!n).sort((a, b) => a.localeCompare(b, 'pt-BR'))
      : []
    ibgeCache.set(key, names)
    return names
  } catch {
    return []
  }
}

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
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'notfound'>('idle')
  const [municipios, setMunicipios] = useState<string[]>([])
  const aliveRef = useRef(true)
  useEffect(() => () => { aliveRef.current = false }, [])

  // Carrega municípios do IBGE quando a UF muda (combo com busca no campo Município).
  useEffect(() => {
    let alive = true
    if (!parts.uf) { setMunicipios([]); return }
    fetchMunicipios(parts.uf).then((list) => { if (alive) setMunicipios(list) })
    return () => { alive = false }
  }, [parts.uf])

  // Consulta o CEP e preenche logradouro/bairro/município/UF/país. Mantém número
  // e complemento (não vêm do ViaCEP).
  async function onCepLookup(raw: string) {
    const cep = (raw || '').replace(/\D/g, '')
    if (cep.length !== 8) { setCepStatus('idle'); return }
    setCepStatus('loading')
    const found = await lookupCep(cep)
    if (!aliveRef.current) return
    if (!found) { setCepStatus('notfound'); return }
    setCepStatus('idle')
    setParts((p) => ({ ...p, ...found }))
  }

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
                <span className="text-[10px] font-medium text-[#94A3B8]">
                  {f.label}
                  {f.key === 'cep' && cepStatus === 'loading' && <span className="ml-1 text-[#2563EB]">buscando…</span>}
                  {f.key === 'cep' && cepStatus === 'notfound' && <span className="ml-1 text-[#EF4444]">não encontrado</span>}
                </span>
                {f.key === 'uf' ? (
                  <select
                    value={parts.uf ?? ''}
                    onChange={(e) => setParts((p) => ({ ...p, uf: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="" />
                    {UF_OPTIONS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                ) : f.key === 'cep' ? (
                  <input
                    autoFocus
                    value={parts.cep ?? ''}
                    onChange={(e) => { setParts((p) => ({ ...p, cep: e.target.value })); setCepStatus('idle') }}
                    onBlur={(e) => onCepLookup(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onCepLookup((e.target as HTMLInputElement).value) } }}
                    placeholder="00000-000"
                    className={inputCls}
                  />
                ) : f.key === 'municipio' ? (
                  <input
                    list="gv-municipios"
                    value={parts.municipio ?? ''}
                    onChange={(e) => setParts((p) => ({ ...p, municipio: e.target.value }))}
                    placeholder={parts.uf ? 'Buscar…' : 'Selecione a UF'}
                    className={inputCls}
                  />
                ) : (
                  <input
                    value={parts[f.key] ?? ''}
                    onChange={(e) => setParts((p) => ({ ...p, [f.key]: e.target.value }))}
                    className={inputCls}
                  />
                )}
              </label>
            ))}
          </div>
          <datalist id="gv-municipios">
            {municipios.map((m) => <option key={m} value={m} />)}
          </datalist>
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
