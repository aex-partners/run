import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ExternalLink, File, FileArchive, FileImage, FileSpreadsheet, FileText, FileType, Link as LinkIcon, Search, Upload, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { FileMeta } from '../types'

function fmtBytes(n?: number): string {
  if (n == null) return '-'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
function fmtDate(s?: string): string {
  if (!s) return '-'
  const d = new Date(s)
  if (isNaN(d.getTime())) return String(s)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function toFiles(value: unknown): FileMeta[] {
  if (Array.isArray(value)) return value as FileMeta[]
  if (value && typeof value === 'object') return [value as FileMeta]
  return []
}

type Kind = 'image' | 'pdf' | 'sheet' | 'doc' | 'archive' | 'text' | 'other'
function kindOf(f: FileMeta): Kind {
  const m = (f.mime || '').toLowerCase()
  const ext = (f.name.split('.').pop() || '').toLowerCase()
  if (m.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'].includes(ext)) return 'image'
  if (m.includes('pdf') || ext === 'pdf') return 'pdf'
  if (m.includes('sheet') || m.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet'
  if (m.includes('word') || m.includes('document') || ['doc', 'docx'].includes(ext)) return 'doc'
  if (m.includes('zip') || m.includes('rar') || m.includes('compressed') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive'
  if (m.startsWith('text/') || ['txt', 'md', 'json', 'log'].includes(ext)) return 'text'
  return 'other'
}
const KIND: Record<Kind, { Icon: typeof File; color: string; label: string }> = {
  image: { Icon: FileImage, color: '#10B981', label: 'Imagem' },
  pdf: { Icon: FileText, color: '#EF4444', label: 'PDF' },
  sheet: { Icon: FileSpreadsheet, color: '#16A34A', label: 'Planilha' },
  doc: { Icon: FileType, color: '#2563EB', label: 'Documento' },
  archive: { Icon: FileArchive, color: '#F59E0B', label: 'Arquivo' },
  text: { Icon: FileText, color: '#64748B', label: 'Texto' },
  other: { Icon: File, color: '#64748B', label: 'Arquivo' },
}

/**
 * Catalogo de arquivos do "ambiente Drive/S3". Mock isolado: o dev pluga a
 * listagem real (S3/Drive) aqui. O campo busca/anexa destes + permite subir novo.
 */
const DRIVE_LIBRARY: FileMeta[] = [
  { id: 'drv-1', name: 'Contrato Matriz SolGreen 2026.pdf', mime: 'application/pdf', size: 286000, url: 'https://pdfobject.com/pdf/sample.pdf', author: 'Jurídico', createdAt: '2026-01-10', modifiedAt: '2026-02-03', pages: 14 },
  { id: 'drv-2', name: 'Planilha Orçamento Geral.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 92000, author: 'Financeiro', createdAt: '2026-01-12', modifiedAt: '2026-03-01' },
  { id: 'drv-3', name: 'Foto Usina Caxias.jpg', mime: 'image/jpeg', size: 318000, url: 'https://picsum.photos/seed/drv3/640/420', author: 'Engenharia', createdAt: '2026-02-01', modifiedAt: '2026-02-01' },
  { id: 'drv-4', name: 'Memorial Descritivo.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 64000, author: 'Engenharia', createdAt: '2026-01-20', modifiedAt: '2026-02-10' },
  { id: 'drv-5', name: 'Laudo Técnico Estrutural.pdf', mime: 'application/pdf', size: 174000, url: 'https://pdfobject.com/pdf/sample.pdf', author: 'Engenharia', createdAt: '2026-02-15', modifiedAt: '2026-02-18', pages: 9 },
  { id: 'drv-6', name: 'Apólice de Seguro.pdf', mime: 'application/pdf', size: 120000, url: 'https://pdfobject.com/pdf/sample.pdf', author: 'Jurídico', createdAt: '2026-01-05', modifiedAt: '2026-01-05', pages: 6 },
  { id: 'drv-7', name: 'Foto Painéis Pelotas.jpg', mime: 'image/jpeg', size: 274000, url: 'https://picsum.photos/seed/drv7/640/420', author: 'Campo', createdAt: '2026-03-02', modifiedAt: '2026-03-02' },
  { id: 'drv-8', name: 'Cronograma da Obra.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 70000, author: 'PMO', createdAt: '2026-01-18', modifiedAt: '2026-03-10' },
  { id: 'drv-9', name: 'NF Equipamentos.pdf', mime: 'application/pdf', size: 88000, url: 'https://pdfobject.com/pdf/sample.pdf', author: 'Suprimentos', createdAt: '2026-02-20', modifiedAt: '2026-02-20', pages: 2 },
  { id: 'drv-10', name: 'Diagrama Unifilar.png', mime: 'image/png', size: 156000, url: 'https://picsum.photos/seed/drv10/640/420', author: 'Engenharia', createdAt: '2026-02-25', modifiedAt: '2026-02-28' },
  { id: 'drv-11', name: 'Manual de Operação.pdf', mime: 'application/pdf', size: 410000, url: 'https://pdfobject.com/pdf/sample.pdf', author: 'O&M', createdAt: '2026-03-05', modifiedAt: '2026-03-05', pages: 38 },
  { id: 'drv-12', name: 'Relatório de Vistoria.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 48000, author: 'Campo', createdAt: '2026-03-08', modifiedAt: '2026-03-08' },
]

// card com PRE-VISUALIZACAO do arquivo (imagem/pdf embed) + metadados
function FileCard({ f }: { f: FileMeta }) {
  const kind = kindOf(f)
  const { Icon, color, label } = KIND[kind]
  return (
    <div className="w-80 overflow-hidden rounded-md border border-[#E2E8F0] bg-white shadow-xl">
      {/* preview */}
      {kind === 'image' && f.url ? (
        <img src={f.url} alt={f.name} className="h-44 w-full bg-[#0F172A] object-contain" />
      ) : kind === 'pdf' && f.url ? (
        <iframe title={f.name} src={`${f.url}#toolbar=0&navpanes=0`} className="h-52 w-full border-0 bg-[#F8FAFC]" />
      ) : (
        <div className="flex h-28 items-center justify-center bg-[#F8FAFC]">
          <Icon size={44} style={{ color }} />
        </div>
      )}
      {/* metadados */}
      <div className="p-3">
        <div className="mb-2 flex items-center gap-2">
          <Icon size={16} className="shrink-0" style={{ color }} />
          <span className="truncate text-sm font-semibold text-[#0F172A]">{f.name}</span>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-[#94A3B8]">Tipo</dt>
          <dd className="text-[#334155]">{label}{f.pages ? ` · ${f.pages} pág.` : ''}</dd>
          <dt className="text-[#94A3B8]">Tamanho</dt>
          <dd className="text-[#334155]">{fmtBytes(f.size)}</dd>
          <dt className="text-[#94A3B8]">Autor</dt>
          <dd className="truncate text-[#334155]">{f.author || '-'}</dd>
          <dt className="text-[#94A3B8]">Criado</dt>
          <dd className="text-[#334155]">{fmtDate(f.createdAt)}</dd>
          <dt className="text-[#94A3B8]">Modificado</dt>
          <dd className="text-[#334155]">{fmtDate(f.modifiedAt)}</dd>
        </dl>
        {f.url && (
          <a href={f.url} target="_blank" rel="noreferrer" className="pointer-events-auto mt-2 inline-block text-xs font-medium text-[#2563EB] hover:underline">
            Abrir
          </a>
        )}
      </div>
    </div>
  )
}

// modal: visualiza o arquivo em tamanho grande (imagem / pdf embed / sem preview)
export function FilePreviewModal({ f, onClose }: { f: FileMeta; onClose: () => void }) {
  const kind = kindOf(f)
  const { Icon, color, label } = KIND[kind]
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-6" onMouseDown={onClose}>
      <div
        className="flex max-h-[88vh] w-[min(960px,92vw)] flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[#E2E8F0] px-4">
          <Icon size={16} className="shrink-0" style={{ color }} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#0F172A]">{f.name}</span>
          <span className="hidden text-xs text-[#94A3B8] sm:inline">{label} &middot; {fmtBytes(f.size)}</span>
          {f.url && (
            <a href={f.url} target="_blank" rel="noreferrer" className="text-[#475569] hover:text-[#2563EB]" title="Abrir em nova aba">
              <ExternalLink size={16} />
            </a>
          )}
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A]" title="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-[#0F172A]/[0.03]">
          {kind === 'image' && f.url ? (
            <img src={f.url} alt={f.name} className="mx-auto block max-h-[78vh] object-contain" />
          ) : kind === 'pdf' && f.url ? (
            <iframe title={f.name} src={f.url} className="h-[78vh] w-full border-0" />
          ) : (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
              <Icon size={64} style={{ color }} />
              <div className="text-sm text-[#475569]">Sem pré-visualização para {label}.</div>
              {f.url && (
                <a href={f.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-[#2563EB] hover:underline">
                  Baixar / abrir
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// chip (icon por tipo + nome); pre-visualizacao no hover (card hoverable: nao some ao
// mover o mouse p/ dentro dele, da p/ ler/abrir). Clique nao abre nada.
export function FileChip({ f }: { f: FileMeta }) {
  const ref = useRef<HTMLSpanElement>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [card, setCard] = useState<{ top: number; left: number } | null>(null)
  const { Icon, color } = KIND[kindOf(f)]
  function show() {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null }
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const W = 320
    const left = Math.max(8, Math.min(r.left, window.innerWidth - W - 8))
    const top = Math.min(r.bottom + 2, window.innerHeight - 340)
    setCard({ top: Math.max(8, top), left })
  }
  function scheduleHide() {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setCard(null), 140)
  }
  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      className="inline-flex max-w-[170px] shrink-0 items-center gap-1 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-1.5 py-0.5 text-xs text-[#334155]"
      title={f.name}
    >
      <Icon size={12} className="shrink-0" style={{ color }} />
      <span className="truncate">{f.name}</span>
      {card && (
        <span
          className="fixed z-50"
          style={{ top: card.top, left: card.left }}
          onMouseEnter={show}
          onMouseLeave={scheduleHide}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <FileCard f={f} />
        </span>
      )}
    </span>
  )
}

// exibicao na celula: 1+ arquivos como chips, linha unica clipada + "+N"
export function FileChips({ value }: { value: unknown }) {
  const files = toFiles(value)
  if (files.length === 0) return <span className="text-xs text-[#94A3B8]">-</span>
  const shown = files.slice(0, 2)
  const extra = files.length - shown.length
  return (
    <div className="flex items-center gap-1 overflow-hidden whitespace-nowrap">
      {shown.map((f) => (
        <FileChip key={f.id} f={f} />
      ))}
      {extra > 0 && <span className="shrink-0 text-xs text-[#94A3B8]">+{extra}</span>}
    </div>
  )
}

// ---- helpers p/ modo imagem (valor = URL string, nao FileMeta) ----
function basename(url: string): string {
  try { return decodeURIComponent(url.split('?')[0].split('/').pop() || url) } catch { return url }
}
function urlToMeta(url: string, imagesOnly: boolean): FileMeta {
  const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase()
  const known = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'].includes(ext)
  const mime = imagesOnly ? (known ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : 'image/*') : ''
  const name = basename(url) || (imagesOnly ? 'Imagem' : 'Arquivo')
  return { id: url, name: name.includes('.') || !imagesOnly ? name : `${name}.jpg`, url, mime, author: 'Link' }
}
function toUrls(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? x : (x as FileMeta)?.url ?? '')).filter(Boolean)
  if (typeof v === 'string') return v ? [v] : []
  if (v && typeof v === 'object') { const u = (v as FileMeta).url; return u ? [u] : [] }
  return []
}

/**
 * Editor de assets (arquivos OU imagens) num painel flutuante: busca no Drive +
 * upload + ADICIONAR POR LINK (carrega de uma URL). Modo imagem mostra
 * thumbnails e devolve URLs (string|string[]); modo arquivo devolve FileMeta[].
 */
export function FileFieldEditor({
  value,
  onCommit,
  onClose,
  imagesOnly = false,
  multiple = true,
}: {
  value: unknown
  onCommit: (v: unknown) => void
  onClose: () => void
  /** modo imagem: lista thumbnails e persiste URLs. */
  imagesOnly?: boolean
  /** aceita varios (array) ou item unico. */
  multiple?: boolean
}) {
  const triggerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const [q, setQ] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  // uploads/links feitos nesta sessao entram no "drive" tambem
  const [extra, setExtra] = useState<FileMeta[]>([])

  // representacao interna SEMPRE em FileMeta (imagem: deriva de URLs)
  const attached: FileMeta[] = imagesOnly ? toUrls(value).map((u) => urlToMeta(u, true)) : toFiles(value)
  const attachedIds = new Set(attached.map((f) => f.id))

  const base = imagesOnly ? DRIVE_LIBRARY.filter((f) => kindOf(f) === 'image') : DRIVE_LIBRARY
  const catalog = useMemo(() => {
    const map = new Map<string, FileMeta>()
    for (const f of [...base, ...extra, ...attached]) map.set(f.id, f)
    return [...map.values()].sort((a, b) => Number(attachedIds.has(b.id)) - Number(attachedIds.has(a.id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extra, value])
  const query = q.trim().toLowerCase()
  const filtered = query ? catalog.filter((f) => f.name.toLowerCase().includes(query)) : catalog

  useEffect(() => {
    const r = triggerRef.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.max(r.width, 360)
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
    setPos({ top: Math.min(r.bottom + 4, window.innerHeight - 16), left, width })
  }, [])
  useEffect(() => { if (pos) searchRef.current?.focus() }, [pos])

  // persiste uma lista de FileMeta de volta no formato do campo
  function commitList(list: FileMeta[]) {
    if (imagesOnly) {
      const urls = list.map((f) => f.url).filter(Boolean) as string[]
      onCommit(multiple ? urls : urls[0] ?? null)
    } else {
      onCommit(multiple ? list : list[0] ?? null)
    }
  }
  function toggle(f: FileMeta) {
    if (attachedIds.has(f.id)) commitList(attached.filter((a) => a.id !== f.id))
    else {
      commitList(multiple ? [...attached, f] : [f])
      if (!multiple) onClose() // single: escolhe e fecha
    }
  }
  function addUploaded(list: FileList | null) {
    if (!list || !list.length) return
    let novos: FileMeta[] = Array.from(list).map((file) => ({
      id: `up-${file.name}-${file.size}-${file.lastModified}`,
      name: file.name,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      createdAt: new Date(file.lastModified).toISOString(),
      modifiedAt: new Date(file.lastModified).toISOString(),
      author: 'Você',
      url: URL.createObjectURL(file),
    }))
    if (imagesOnly) novos = novos.filter((f) => kindOf(f) === 'image')
    if (!novos.length) return
    setExtra((prev) => [...novos, ...prev])
    commitList(multiple ? dedupe([...attached, ...novos]) : [novos[0]])
  }
  function addLink() {
    const url = linkUrl.trim()
    if (!url) return
    const meta = urlToMeta(url, imagesOnly)
    setExtra((prev) => [meta, ...prev.filter((f) => f.id !== meta.id)])
    commitList(multiple ? dedupe([...attached, meta]) : [meta])
    setLinkUrl('')
    if (!multiple) onClose()
  }

  return (
    <>
      <div ref={triggerRef} className="flex items-center gap-1 overflow-hidden whitespace-nowrap h-5" onMouseDown={(e) => e.stopPropagation()}>
        {attached.length === 0 ? (
          <span className="text-xs text-[#94A3B8]">{imagesOnly ? 'Sem imagens' : 'Sem arquivos'}</span>
        ) : imagesOnly ? (
          attached.slice(0, 4).map((f) => <img key={f.id} src={f.url} alt="" className="size-5 shrink-0 rounded border border-[#E2E8F0] object-cover" />)
        ) : (
          attached.slice(0, 2).map((f) => <FileChip key={f.id} f={f} />)
        )}
        {attached.length > (imagesOnly ? 4 : 2) && <span className="shrink-0 text-xs text-[#94A3B8]">+{attached.length - (imagesOnly ? 4 : 2)}</span>}
      </div>

      <div className="fixed inset-0 z-40" onMouseDown={(e) => { e.stopPropagation(); onClose() }} />

      {pos && (
        <div
          className="fixed z-50 rounded-md border border-[#E2E8F0] bg-white shadow-xl"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* busca no drive (mesmo padrao do combobox) */}
          <div className="flex items-center gap-2 border-b border-[#E2E8F0] px-3 h-9">
            <Search size={14} className="shrink-0 text-[#94A3B8]" />
            <input
              ref={searchRef}
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={imagesOnly ? 'Buscar imagem no Drive...' : 'Buscar no Drive...'}
              className="w-full border-0 bg-transparent p-0 text-sm text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
              onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }}
            />
          </div>
          <div className="px-3 py-1.5 text-[11px] text-[#94A3B8] border-b border-[#E2E8F0]">
            {attached.length} {imagesOnly ? 'imagem' : 'anexado'}{attached.length === 1 ? '' : 's'} &middot; {catalog.length} no Drive
          </div>
          <div className="max-h-[240px] overflow-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-xs text-[#94A3B8]">Nada encontrado no Drive.</div>
            ) : (
              filtered.map((f) => {
                const { Icon, color } = KIND[kindOf(f)]
                const on = attachedIds.has(f.id)
                return (
                  <button
                    key={f.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggle(f) }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[#F1F5F9]"
                  >
                    <Check size={14} className={cn('shrink-0', on ? 'opacity-100 text-[#2563EB]' : 'opacity-0')} />
                    {imagesOnly && f.url ? (
                      <img src={f.url} alt="" className="size-9 shrink-0 rounded border border-[#E2E8F0] object-cover" />
                    ) : (
                      <Icon size={15} className="shrink-0" style={{ color }} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-[#0F172A]">{f.name}</span>
                      <span className="block text-[10px] text-[#94A3B8]">{fmtBytes(f.size)} &middot; {f.author || '-'} &middot; {fmtDate(f.modifiedAt)}</span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
          {/* adicionar por link/URL */}
          <div className="flex items-center gap-1.5 border-t border-[#E2E8F0] px-2 py-2">
            <LinkIcon size={13} className="shrink-0 text-[#94A3B8]" />
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder={imagesOnly ? 'Colar link da imagem...' : 'Colar link do arquivo...'}
              className="h-7 w-full rounded border border-[#E2E8F0] px-2 text-xs text-[#0F172A] outline-none focus:border-[#2563EB]"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink() } else if (e.key === 'Escape') { e.preventDefault(); onClose() } }}
            />
            <button
              type="button"
              disabled={!linkUrl.trim()}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); addLink() }}
              className="h-7 shrink-0 rounded bg-[#2563EB] px-2 text-xs font-medium text-white disabled:opacity-40"
            >
              Adicionar
            </button>
          </div>
          <div className="border-t border-[#E2E8F0] p-2">
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); inputRef.current?.click() }}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-[#CBD5E1] py-1.5 text-xs font-medium text-[#475569] hover:border-[#2563EB] hover:bg-[#EFF6FF] hover:text-[#2563EB]"
            >
              <Upload size={13} /> {imagesOnly ? 'Carregar nova imagem' : 'Carregar novo arquivo'}
            </button>
            <input ref={inputRef} type="file" multiple={multiple} accept={imagesOnly ? 'image/*' : undefined} className="hidden" onChange={(e) => addUploaded(e.target.files)} />
          </div>
        </div>
      )}
    </>
  )
}

function dedupe(list: FileMeta[]): FileMeta[] {
  const map = new Map<string, FileMeta>()
  for (const f of list) map.set(f.id, f)
  return [...map.values()]
}
