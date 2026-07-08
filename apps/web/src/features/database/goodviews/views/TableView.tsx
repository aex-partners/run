import {
  Children,
  useContext,
  useState,
  useMemo,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnOrderState,
  type ColumnSizingState,
  type Header,
} from '@tanstack/react-table'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from '../ui/table'
import {
  ArrowDownAZ,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpAZ,
  Bookmark,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Cloud,
  Columns3,
  Copy,
  Download,
  Eraser,
  RotateCcw,
  ExternalLink,
  EyeOff,
  Filter,
  Layers,
  ListFilter,
  MoreVertical,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Shield,
  Snowflake,
  Trash2 as TrashIcon,
  UserPlus,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { FileChips } from '../components/FileField'
import { EditCell } from '../components/CellEditor'
import { applyMask, type MaskKind } from '../mask'
import { AggFooterCell, defaultAgg, type AggFn } from '../components/AggFooterCell'
import { ContextMenu, type MenuEntry } from '../components/ContextMenu'
import { filterRows, isGroup, sortRows, type FilterCond, type FilterGroup, type FieldAggregate } from '../server'
import { SavedMenu } from '../components/SavedMenu'
import { AuditCloud } from '../components/AuditCloud'
import { LightboxProvider } from '../components/Lightbox'
import { Avatar, AvatarStack, BoolCheck, ImageStack, ImageThumb, Stars, formatDuration } from '../components/CellDisplay'
import { addSaved, deepEqual, FILTERS_KEY, getDefaultView, loadSaved, removeSaved, saveDefaultView, updateSaved, VIEWS_KEY, type Saved, type Scope } from '../storage'
import { ViewKeyContext } from '../viewKeyContext'
import { ViewSkeleton } from '../components/ViewSkeleton'
import { HeaderBtn } from '../components/HeaderBtn'
import { SearchSelect } from '../components/SearchSelect'
import { FieldsPanel } from '../components/FieldsPanel'
import { FilterPanel } from '../components/FilterPanel'
import { countFilterLeaves } from '../components/FilterPanel'
import { cellToText, exportCsv as exportCsvFile, formatCurrency } from '../csv'

interface ViewPayload {
  visibleFieldIds: string[]
  columnOrder: ColumnOrderState
  columnSizing: ColumnSizingState
  frozenCount: number
  pageSize: number
  sorting: SortingState
  /** agrupamento multi-nível: lista ordenada de fieldIds (compat: string legada aceita na leitura). */
  groupBy: string[]
  filter: FilterGroup
  /** função de agregação por coluna (rodapé). opcional p/ compat com payloads antigos. */
  aggs?: Record<string, AggFn>
}

// permissoes de schema (o dev liga conforme o usuario).
// canCreate cobre Duplicar; canDelete cobre Excluir (ambos mutam o schema).
const SCHEMA_PERMS = { canEdit: true, canCreate: false, canDelete: false }

const PAGE_SIZES = [10, 25, 50, 100]
import type { ViewProps, Field, FieldType, FieldOption, Row, AuditEntry, AuditCell, EntityFieldLite, FieldConfigInput } from '../types'

// schema do grid de LOGS (a tabela de auditoria renderiza usando a propria TableView)
const LOG_FIELDS: Field[] = [
  { id: 'kind', label: 'Tipo', type: 'select', options: [
    { value: 'edit', label: 'Edição', color: '#2563EB' },
    { value: 'bulk', label: 'Em massa', color: '#7C3AED' },
    { value: 'delete', label: 'Exclusão', color: '#EF4444' },
    { value: 'duplicate', label: 'Duplicação', color: '#0EA5E9' },
    { value: 'restore', label: 'Restauração', color: '#10B981' },
  ] },
  { id: 'label', label: 'Descrição', type: 'text' },
  { id: 'campo', label: 'Campo', type: 'text' },
  { id: 'antes', label: 'Antes', type: 'text' },
  { id: 'depois', label: 'Depois', type: 'text' },
  { id: 'usuario', label: 'Usuário', type: 'text' },
  { id: 'quando', label: 'Quando', type: 'text' },
]
const LOG_FIELD_IDS = LOG_FIELDS.map((f) => f.id)
function fmtLogVal(v: unknown): string {
  if (v == null || v === '') return '∅'
  if (Array.isArray(v)) return v.length ? v.map(String).join(', ') : '∅'
  return String(v)
}

const DEFAULT_VISIBLE = [
  'nome', 'status', 'responsavel', 'segmento', 'prioridade',
  'cidade', 'valorContrato', 'progresso', 'parentId', 'dependeDe', 'tags',
]

// Todo campo e editavel, menos o id e os somente-leitura (derivados/computados:
// lookup, rollup, formula, autonumber, campos de sistema — marcados no adapter).
function isEditableField(f?: Field): boolean {
  return !!f && f.type !== 'id' && !f.readonly
}

// Normaliza o groupBy vindo da config/view salva: array (multi-nível), string
// legada (single -> [single]) ou vazio.
function normGroupBy(g: unknown): string[] {
  if (Array.isArray(g)) return g.filter((x): x is string => typeof x === 'string' && x.length > 0)
  if (typeof g === 'string' && g) return [g]
  return []
}

// Nó da árvore de agrupamento (um nível por campo do groupBy). `path` identifica o
// nó de forma única na árvore (chave de colapso). Folha: `children === null` e
// `rows` são as linhas do grupo; nó interno: `children` recursa e `rows` é o
// subconjunto acumulado (usado só p/ contagem).
interface GroupNode<R> {
  path: string
  key: string
  field: Field
  depth: number
  count: number
  rows: R[]
  children: GroupNode<R>[] | null
}

// ---------- helpers de formatacao ----------

function formatDate(val: unknown): string {
  if (!val || typeof val !== 'string') return ''
  // ISO datetime ('2026-06-29T14:50:03.008Z'): formata data + hora via Date
  // (o split por '-' só serve p/ data pura 'YYYY-MM-DD' e quebraria no 'T').
  if (val.includes('T')) {
    const d = new Date(val)
    if (!isNaN(d.getTime()))
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  const parts = val.split('-')
  if (parts.length !== 3) return String(val)
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

// ---------- sub-componentes ----------

function Badge({ color, label }: { color?: string; label: string }) {
  const bg = color ? `${color}22` : '#94A3B822'
  const border = color ?? '#E2E8F0'
  const text = color ?? '#475569'
  return (
    <span
      className="inline-flex shrink-0 max-w-full items-center overflow-hidden px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap"
      style={{ background: bg, color: text, border: `1px solid ${border}` }}
    >
      <span className="truncate">{label}</span>
    </span>
  )
}


function PercentBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(value)))
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 h-1.5 rounded-full bg-[#E2E8F0] overflow-hidden">
        <div className="h-full rounded-full bg-[#2563EB] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-[#475569] w-7 text-right shrink-0">{pct}%</span>
    </div>
  )
}

// ---------- render somente-leitura por tipo ----------

/**
 * Tira de chips em LINHA UNICA, altura fixa. Corta por CHIP INTEIRO (nunca no
 * meio de um chip): mostra so os chips que cabem na largura da coluna + um
 * "+N" com o resto. Hover sobre os chips revela TODOS num balao flutuante.
 */
function RevealChips({ children }: { children: ReactNode }) {
  const all = Children.toArray(children)
  const wrapRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(all.length)
  // ancoragem do balao: na metade direita da tela abre da direita p/ esquerda (nao vaza viewport)
  const [alignRight, setAlignRight] = useState(false)

  useEffect(() => {
    const wrap = wrapRef.current
    const measure = measureRef.current
    if (!wrap || !measure) return
    const GAP = 4
    const PLUS = 36 // espaco reservado p/ o "+N"
    const compute = () => {
      const avail = wrap.clientWidth
      const kids = Array.from(measure.children) as HTMLElement[]
      let total = 0
      kids.forEach((k, i) => { total += k.offsetWidth + (i > 0 ? GAP : 0) })
      const rect = wrap.getBoundingClientRect()
      setAlignRight(rect.left + rect.width / 2 > window.innerWidth / 2)
      if (total <= avail) { setFit(kids.length); return } // cabe tudo
      let used = 0
      let n = 0
      for (let i = 0; i < kids.length; i++) {
        const next = used + (i > 0 ? GAP : 0) + kids[i].offsetWidth
        if (next + GAP + PLUS <= avail) { used = next; n++ } else break
      }
      setFit(n) // resto vira "+N"
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [all.length, children])

  const show = fit === 0 ? 1 : fit // 1 chip maior que a coluna: mostra ele com reticencias
  const hidden = all.length - show
  const reveal = hidden > 0 || fit === 0 // algo escondido OU chip unico truncado

  return (
    <div className="group/chips relative">
      {/* medidor invisivel: larguras naturais de cada chip */}
      <div ref={measureRef} aria-hidden className="pointer-events-none absolute -z-10 flex items-center gap-1 whitespace-nowrap opacity-0">
        {all}
      </div>
      {/* tira visivel: so chips inteiros que cabem + "+N" */}
      <div ref={wrapRef} className="flex items-center gap-1 overflow-hidden whitespace-nowrap">
        {all.slice(0, show)}
        {hidden > 0 && (
          <span className="inline-flex shrink-0 items-center rounded-full bg-[#F1F5F9] px-1.5 py-0.5 text-xs font-medium text-[#64748B]">
            +{hidden}
          </span>
        )}
      </div>
      {/* hover revela TODOS (com wrap). Ancora left/right p/ nunca sair do viewport. */}
      {reveal && (
        <div
          className={cn(
            'pointer-events-none absolute top-1/2 z-30 hidden -translate-y-1/2 w-max max-w-[min(460px,80vw)] flex-wrap items-center gap-1 rounded-md border border-[#E2E8F0] bg-white px-2 py-1.5 shadow-lg group-hover/chips:flex',
            alignRight ? 'right-0' : 'left-0',
          )}
        >
          {all}
        </div>
      )}
    </div>
  )
}

function renderDisplay(field: Field, value: unknown, recordsById: Map<string, Row>, row?: Row): ReactNode {
  // Máscara fixa do campo (ex: cpf_cnpj) ou dirigida por campo-irmão (ex: Meios ->
  // `valor` conforme `tipo`). A fixa tem prioridade.
  if (value != null && value !== '') {
    const kind = field.mask ?? (field.formatByField && row ? field.formatMap?.[String(row[field.formatByField] ?? '')] : undefined)
    if (kind) return <span className="block truncate text-sm text-[#0F172A]">{applyMask(kind as MaskKind, value)}</span>
  }
  // avatar (img + nome) p/ person single, quando a coluna pede avatar
  if (field.avatar && field.type === 'person' && field.options) {
    if (value == null || value === '') return <span className="text-[#94A3B8] text-xs">-</span>
    const opt = field.options.find((o) => o.value === value)
    return (
      <span className="flex items-center gap-1.5 overflow-hidden">
        <Avatar label={opt?.label ?? String(value)} image={opt?.image} />
        <span className="truncate text-sm text-[#0F172A]">{opt?.label ?? String(value)}</span>
      </span>
    )
  }
  // avatares aninhados (stacked) p/ array de pessoas
  if (field.avatar && field.type === 'multiselect' && Array.isArray(value) && field.options) {
    if ((value as string[]).length === 0) return <span className="text-[#94A3B8] text-xs">-</span>
    const people = (value as string[]).map((v) => {
      const o = field.options!.find((op) => op.value === v)
      return { label: o?.label ?? v, image: o?.image }
    })
    return <AvatarStack people={people} />
  }
  if ((field.type === 'status' || field.type === 'select' || field.type === 'person') && field.options) {
    if (value == null || value === '') return <span className="text-[#94A3B8] text-xs">-</span>
    const opt = field.options.find((o) => o.value === value)
    // valor criado (sem option no schema): mostra o texto cru como chip
    return <Badge color={opt?.color} label={opt?.label ?? String(value)} />
  }
  if (field.type === 'currency') {
    if (value == null || value === '' || isNaN(Number(value))) return <span className="text-[#94A3B8] text-xs">-</span>
    // moeda por registro (currencyField) tem prioridade; senao fixa (currency); senao BRL.
    const code = (field.currencyField && row ? String(row[field.currencyField] ?? '') : '') || field.currency || 'BRL'
    return <span className="font-mono text-xs text-[#0F172A]">{formatCurrency(value, code)}</span>
  }
  if (field.type === 'percent') {
    return <PercentBar value={Number(value) || 0} />
  }
  if (field.type === 'date') {
    return <span className="text-[#475569] text-xs">{formatDate(value)}</span>
  }
  if (field.type === 'multiselect' && Array.isArray(value) && field.options) {
    if ((value as string[]).length === 0) return <span className="text-[#94A3B8] text-xs">-</span>
    return (
      <RevealChips>
        {(value as string[]).map((v) => {
          const o = field.options!.find((op) => op.value === v)
          // valor criado (sem option): chip com o texto cru
          return <Badge key={v} color={o?.color} label={o?.label ?? v} />
        })}
      </RevealChips>
    )
  }
  if (field.type === 'file') {
    return <FileChips value={value} />
  }
  if (field.type === 'image') {
    // array de imagens -> stack; string -> thumb unico. Pequeno c/ borda, hover mostra maior.
    if (Array.isArray(value)) {
      const srcs = (value as unknown[]).map(String).filter(Boolean)
      if (!srcs.length) return <span className="text-[#94A3B8] text-xs">-</span>
      return <ImageStack srcs={srcs} />
    }
    if (typeof value === 'string' && value) return <ImageThumb src={value} />
    return <span className="text-[#94A3B8] text-xs">-</span>
  }
  if (field.type === 'relation') {
    // Lookup: resolve id(s) para o nome do registro referenciado (single ou array).
    const ids = Array.isArray(value) ? (value as string[]) : value != null && value !== '' ? [String(value)] : []
    if (ids.length === 0) return <span className="text-[#94A3B8] text-xs">-</span>
    return (
      <RevealChips>
        {ids.map((id) => (
          <span
            key={id}
            className="inline-flex shrink-0 max-w-full items-center overflow-hidden px-2 py-0.5 rounded-md text-xs bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] whitespace-nowrap"
          >
            <span className="truncate">{String(recordsById.get(id)?.nome ?? id)}</span>
          </span>
        ))}
      </RevealChips>
    )
  }
  if (field.type === 'number') {
    const n = Number(value)
    // inteiros sem casas; decimais ate 4 casas sem zeros a direita (ex: 100, 1,5)
    return <span className="text-xs text-[#475569] font-mono">{isNaN(n) ? '-' : n.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}</span>
  }
  if (field.type === 'boolean') {
    return <BoolCheck value={value} />
  }
  if (field.type === 'rating') {
    if (value == null || value === '') return <span className="text-[#94A3B8] text-xs">-</span>
    return <Stars value={Number(value)} max={field.maxRating ?? 5} />
  }
  if (field.type === 'duration') {
    if (value == null || value === '') return <span className="text-[#94A3B8] text-xs">-</span>
    return <span className="text-xs text-[#475569] font-mono tabular-nums">{formatDuration(value)}</span>
  }
  if (field.type === 'email') {
    if (value == null || value === '') return <span className="text-[#94A3B8] text-xs">-</span>
    const email = String(value)
    return (
      <a
        href={`mailto:${email}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="block truncate text-sm text-[#2563EB] hover:underline"
      >
        {email}
      </a>
    )
  }
  if (field.type === 'phone') {
    if (value == null || value === '') return <span className="text-[#94A3B8] text-xs">-</span>
    const phone = String(value)
    return (
      <a
        href={`tel:${phone.replace(/[^\d+]/g, '')}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        className="block truncate text-sm text-[#2563EB] hover:underline"
      >
        {phone}
      </a>
    )
  }
  if (field.type === 'address') {
    // Endereço estruturado: objeto { logradouro, numero, bairro, cep, municipio, uf }.
    // (aceita string crua de dados legados.)
    if (value == null || value === '') return <span className="text-[#94A3B8] text-xs">-</span>
    if (typeof value === 'string') return <span className="block truncate text-sm text-[#0F172A]">{value}</span>
    const a = value as Record<string, string>
    const linha1 = [a.logradouro, a.numero].filter(Boolean).join(', ')
    const linha2 = [a.bairro, [a.municipio, a.uf].filter(Boolean).join('/')].filter(Boolean).join(' - ')
    const full = [linha1, linha2, a.cep].filter(Boolean).join(' - ')
    if (!full) return <span className="text-[#94A3B8] text-xs">-</span>
    return <span className="block truncate text-sm text-[#0F172A]" title={full}>{full}</span>
  }
  if (field.type === 'lookup') {
    // Derivado (somente leitura): o valor é resolvido/injetado pelo host (adapter).
    if (value == null || value === '') return <span className="text-[#94A3B8] text-xs">-</span>
    return <span className="block truncate text-sm text-[#475569]">{String(value)}</span>
  }
  return <span className="block truncate text-sm text-[#0F172A]">{value != null ? String(value) : ''}</span>
}


// ---------- largura padrao por tipo ----------

function defaultSize(field: Field): number {
  switch (field.type) {
    case 'currency': return 130
    case 'percent': return 150
    case 'date': return 120
    case 'status':
    case 'select':
    case 'person': return 140
    case 'multiselect': return 190
    case 'relation': return 200
    case 'file': return 200
    case 'image': return 90
    case 'number': return 110
    case 'boolean': return 80
    case 'rating': return 130
    case 'duration': return 100
    case 'email': return 200
    case 'phone': return 150
    case 'address': return 260
    case 'lookup': return 180
    case 'text': return field.id === 'nome' ? 240 : 160
    default: return 150
  }
}

// ---------- header arrastavel (reordenar) + divisor (redimensionar) ----------

// paleta p/ distinguir cada ordenacao no multi-sort
const SORT_COLORS = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

// largura da coluna-gutter (checkbox), congelada a esquerda
const GUTTER = 44
// largura da coluna de acoes (sem titulo), congelada a direita, qdo ha rowActions
const ACTIONS_W = 130
// largura da coluna-affordance "+" (novo campo) no fim do cabecalho, qdo o host liga onFieldAdd
const ADD_FIELD_W = 40

// largura natural do grid de logs (gutter + soma das colunas) -> modal huga as colunas
const LOG_GRID_WIDTH = GUTTER + LOG_FIELDS.reduce((s, f) => s + defaultSize(f), 0) + 2

function DraggableHeader({
  header,
  frozen,
  left,
  onToggleFreeze,
  onOpenMenu,
  onRename,
  selected,
  selectedRef,
  onKeyDown,
}: {
  header: Header<Row, unknown>
  frozen: boolean
  left: number
  onToggleFreeze: () => void
  onOpenMenu: (x: number, y: number) => void
  onRename?: (name: string) => void
  selected: boolean
  selectedRef: React.RefObject<HTMLTableCellElement | null>
  onKeyDown: (e: ReactKeyboardEvent) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({ id: header.column.id })
  // renomear inline: duplo-clique no título abre um input (Enter confirma, Esc cancela)
  const headerLabel = String(header.column.columnDef.header ?? '')
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(headerLabel)
  const canSort = header.column.getCanSort()
  const sorted = header.column.getIsSorted()
  const sortIndex = header.column.getSortIndex() // -1 se nao ordenado
  const totalSorts = header.getContext().table.getState().sorting.length
  const sortColor = sortIndex >= 0 ? SORT_COLORS[sortIndex % SORT_COLORS.length] : undefined
  // colunas congeladas: sticky a esquerda (sem transform de drag, nao reordenam)
  const style: CSSProperties = frozen
    ? { width: header.getSize(), position: 'sticky', left, zIndex: 30 }
    : {
        width: header.getSize(),
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 20 : undefined,
      }
  return (
    <th
      ref={(el) => { setNodeRef(el); if (selected) selectedRef.current = el }}
      style={style}
      tabIndex={selected ? 0 : undefined}
      onKeyDown={selected ? onKeyDown : undefined}
      onContextMenu={(e) => { e.preventDefault(); onOpenMenu(e.clientX, e.clientY) }}
      className={cn(
        'group/h relative h-10 px-3 text-left align-middle text-xs font-semibold text-[#475569] uppercase tracking-wide select-none bg-[#F8FAFC] border-b border-[#E2E8F0] outline-none',
        selected && 'ring-2 ring-inset ring-[#2563EB] z-20',
      )}
    >
      <div className="flex items-center gap-1">
        {renaming && onRename ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            onBlur={() => {
              const n = draft.trim()
              if (n && n !== headerLabel) onRename(n)
              setRenaming(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); const n = draft.trim(); if (n && n !== headerLabel) onRename(n); setRenaming(false) }
              else if (e.key === 'Escape') { e.preventDefault(); setDraft(headerLabel); setRenaming(false) }
            }}
            className="flex-1 min-w-0 rounded border border-[#2563EB] bg-white px-1 py-0.5 text-xs font-semibold normal-case tracking-normal text-[#0F172A] outline-none"
          />
        ) : (
          <span
            className={cn('flex items-center gap-1 flex-1 min-w-0', !frozen && 'cursor-grab active:cursor-grabbing')}
            {...(frozen ? {} : attributes)}
            {...(frozen ? {} : listeners)}
            onDoubleClick={onRename ? (e) => { e.stopPropagation(); setDraft(headerLabel); setRenaming(true) } : undefined}
            title={onRename ? 'Duplo-clique p/ renomear' : undefined}
          >
            <span className="truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
          </span>
        )}
        {/* congelar/descongelar ate esta coluna */}
        <button
          type="button"
          onClick={onToggleFreeze}
          className={cn('shrink-0 transition-opacity', frozen ? 'text-[#2563EB] opacity-100' : 'text-[#CBD5E1] opacity-0 hover:text-[#2563EB] group-hover/h:opacity-100')}
          title={frozen ? 'Descongelar a partir daqui' : 'Congelar até esta coluna'}
        >
          {frozen ? <PinOff size={13} /> : <Pin size={13} />}
        </button>
        {canSort && (
          <button
            type="button"
            onClick={header.column.getToggleSortingHandler()}
            className="shrink-0 flex items-center gap-0.5 leading-none"
            title="Ordenar (clique p/ alternar; varias colunas combinam)"
          >
            {sorted ? (
              <>
                <span className="size-1.5 rounded-full" style={{ background: sortColor }} />
                <span className="text-sm" style={{ color: sortColor }}>{sorted === 'asc' ? '↑' : '↓'}</span>
                {totalSorts > 1 && (
                  <span className="text-[10px] font-bold tabular-nums" style={{ color: sortColor }}>{sortIndex + 1}</span>
                )}
              </>
            ) : (
              <span className="text-base text-[#CBD5E1] hover:text-[#2563EB]">↕</span>
            )}
          </button>
        )}
        {/* menu de contexto da coluna */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpenMenu(e.clientX, e.clientY) }}
          className="shrink-0 text-[#94A3B8] opacity-0 transition-opacity hover:text-[#2563EB] group-hover/h:opacity-100"
          title="Opções da coluna"
        >
          <MoreVertical size={14} />
        </button>
      </div>
      <div
        onMouseDown={header.getResizeHandler()}
        onTouchStart={header.getResizeHandler()}
        className={`absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none select-none ${
          header.column.getIsResizing() ? 'bg-[#2563EB]' : 'bg-transparent hover:bg-[#2563EB]/40'
        }`}
      />
      {/* divisor visual da ultima coluna congelada */}
      {frozen && <div className="pointer-events-none absolute top-0 right-0 h-full w-px bg-[#CBD5E1]" />}
    </th>
  )
}

// ---------- edição de schema (campo): popover de editar/novo campo ----------

// Tipos oferecidos no popover, AGRUPADOS por família com rótulos em linguagem
// simples (o usuário é leigo). Renderizados como <optgroup> p/ dar contexto e não
// misturar "básico" com "ligações entre tabelas".
const FIELD_TYPE_GROUPS: { group: string; options: { value: FieldType; label: string }[] }[] = [
  {
    group: 'Básico',
    options: [
      { value: 'text', label: 'Texto' },
      { value: 'longtext', label: 'Texto longo' },
      { value: 'number', label: 'Número' },
      { value: 'currency', label: 'Moeda (R$)' },
      { value: 'percent', label: 'Percentual (%)' },
      { value: 'date', label: 'Data' },
      { value: 'boolean', label: 'Sim / Não' },
      { value: 'url', label: 'Link (URL)' },
      { value: 'rating', label: 'Avaliação (estrelas)' },
    ],
  },
  {
    group: 'Contato',
    options: [
      { value: 'phone', label: 'Telefone' },
      { value: 'email', label: 'E-mail' },
      { value: 'address', label: 'Endereço' },
    ],
  },
  {
    group: 'Mídia',
    options: [
      { value: 'image', label: 'Imagem' },
    ],
  },
  {
    group: 'Lista de opções',
    options: [
      { value: 'select', label: 'Seleção (uma opção)' },
      { value: 'status', label: 'Status' },
      { value: 'multiselect', label: 'Multi-seleção (várias)' },
      { value: 'person', label: 'Pessoa' },
    ],
  },
  {
    group: 'Outra tabela',
    options: [
      // Um único conceito para o usuário: referenciar outra tabela e escolher qual
      // campo aparece (o "lookup" fica embutido aqui, sem virar um 2º campo). O tipo
      // 'lookup' ainda existe para campos legados, mas não é oferecido em novos.
      { value: 'relation', label: 'Referência a outra tabela' },
    ],
  },
]
// Opção só p/ EDITAR campos lookup legados (não aparece ao criar um campo novo).
const LOOKUP_LEGACY_OPTION = { value: 'lookup' as FieldType, label: 'Buscar dado (avançado)' }
const CHOICE_TYPES: FieldType[] = ['select', 'status', 'multiselect']

// Explicação curta do tipo selecionado (aparece abaixo do seletor). Ajuda o leigo
// e deixa claro, em especial, a diferença entre Relação e "Buscar dado".
const TYPE_HELP: Partial<Record<FieldType, string>> = {
  relation:
    'Liga a outra tabela e mostra o campo que você escolher em "Campo a mostrar". A ligação é criada quando você escolhe o registro. Uma coluna só.',
  lookup: 'Campo derivado (só leitura): mostra um dado do registro ligado por uma referência.',
  select: 'Escolher UMA opção de uma lista que você define.',
  status: 'Como Seleção, para etapas/estados (ex: Aberto, Concluído).',
  multiselect: 'Escolher VÁRIAS opções de uma lista.',
  person: 'Escolher um usuário do sistema (mostra avatar + nome).',
  rating: 'Nota em estrelas.',
  currency: 'Valor em dinheiro, formatado (ex: R$ 1.234,56).',
  percent: 'Número exibido como porcentagem.',
  phone: 'Telefone (vira link de ligar).',
  email: 'E-mail (vira link de enviar).',
  address: 'Endereço com CEP, logradouro, número, bairro, cidade e UF em um campo.',
  image: 'Imagem por URL (mostra miniatura).',
  boolean: 'Marcador Sim / Não.',
}

// Saída do popover: nome + tipo + config type-específica (mapeada pelo host p/ o backend).
type FieldSchemaOut = { name: string; type: FieldType } & FieldConfigInput

// Popover ancorado (perto do cabeçalho) p/ editar um campo ou criar um novo. Além
// de nome + tipo, mostra a config ESPECÍFICA do tipo escolhido:
//  - relation: tabela de destino + campo a exibir (rótulo) + permitir vários;
//  - lookup: via relação (campo relation desta entidade) + campo a puxar do alvo;
//  - select/status/multiselect: editor de opções (add/remover/reordenar);
//  - rating: máximo de estrelas; currency: código da moeda.
function FieldSchemaPopover({
  x,
  y,
  mode,
  initialName = '',
  initialType = 'text',
  initialOptions = [],
  initialRelEntityId = '',
  initialLabelFieldId = '',
  initialMultiple = false,
  initialViaFieldId = '',
  initialLookupFieldId = '',
  initialMaxRating = 5,
  initialCurrencyCode = 'BRL',
  initialRequired = false,
  initialDefault = '',
  entities = [],
  thisFields = [],
  loadEntityFields,
  loadDefaultOptions,
  onSave,
  onClose,
}: {
  x: number
  y: number
  mode: 'edit' | 'add'
  initialName?: string
  initialType?: FieldType
  initialOptions?: FieldOption[]
  initialRelEntityId?: string
  initialLabelFieldId?: string
  initialMultiple?: boolean
  initialViaFieldId?: string
  initialLookupFieldId?: string
  initialMaxRating?: number
  initialCurrencyCode?: string
  initialRequired?: boolean
  initialDefault?: string
  entities?: { id: string; name: string }[]
  thisFields?: Field[]
  loadEntityFields?: (entityId: string) => Promise<EntityFieldLite[]>
  /** carregador das opções do ALVO de uma relação (id + rótulo), p/ o valor-padrão. */
  loadDefaultOptions?: (search: string) => Promise<{ value: string; label: string }[]>
  onSave: (out: FieldSchemaOut) => void
  onClose: () => void
}) {
  const [name, setName] = useState(initialName)
  const [type, setType] = useState<FieldType>(initialType)
  const [options, setOptions] = useState<FieldOption[]>(initialOptions)
  const [relEntityId, setRelEntityId] = useState(initialRelEntityId)
  const [labelFieldId, setLabelFieldId] = useState(initialLabelFieldId)
  const [multiple, setMultiple] = useState(initialMultiple)
  const [viaFieldId, setViaFieldId] = useState(initialViaFieldId)
  const [lookupFieldId, setLookupFieldId] = useState(initialLookupFieldId)
  const [maxRating, setMaxRating] = useState(initialMaxRating)
  const [currencyCode, setCurrencyCode] = useState(initialCurrencyCode)
  const [required, setRequired] = useState(initialRequired)
  const [defaultValue, setDefaultValue] = useState(initialDefault)
  const [relOpts, setRelOpts] = useState<{ value: string; label: string }[]>([])
  const [relSearch, setRelSearch] = useState('')
  // Campos da entidade-alvo (relation) e da entidade apontada pela "via" (lookup),
  // carregados sob demanda via o host (utils.entities.getById).
  const [targetFields, setTargetFields] = useState<EntityFieldLite[]>([])
  const [lookupTargetFields, setLookupTargetFields] = useState<EntityFieldLite[]>([])

  const isChoice = CHOICE_TYPES.includes(type)
  const isRelation = type === 'relation'
  // valor-padrão só p/ seletor: choice (options) ou relação (registros do alvo).
  const canDefault = isChoice || (isRelation && !!loadDefaultOptions)
  // campos relation DESTA entidade, p/ o select "via relação" do lookup
  const relationFieldsHere = useMemo(() => thisFields.filter((f) => f.type === 'relation'), [thisFields])
  // entidade apontada pela relação escolhida no lookup (p/ "campo a puxar")
  const viaTargetEntityId = relationFieldsHere.find((f) => f.id === viaFieldId)?.relationEntityId

  // relation: carrega os campos da entidade-alvo (rótulo)
  useEffect(() => {
    if (type !== 'relation' || !relEntityId || !loadEntityFields) { setTargetFields([]); return }
    let alive = true
    loadEntityFields(relEntityId).then((fs) => { if (alive) setTargetFields(fs) }).catch(() => { if (alive) setTargetFields([]) })
    return () => { alive = false }
  }, [type, relEntityId, loadEntityFields])

  // lookup: carrega os campos da entidade apontada pela relação "via" (campo a puxar)
  useEffect(() => {
    if (type !== 'lookup' || !viaTargetEntityId || !loadEntityFields) { setLookupTargetFields([]); return }
    let alive = true
    loadEntityFields(viaTargetEntityId).then((fs) => { if (alive) setLookupTargetFields(fs) }).catch(() => { if (alive) setLookupTargetFields([]) })
    return () => { alive = false }
  }, [type, viaTargetEntityId, loadEntityFields])

  // relação: carrega as opções do alvo (id + rótulo) p/ o valor-padrão, com busca server-side.
  useEffect(() => {
    if (!isRelation || !loadDefaultOptions) { setRelOpts([]); return }
    let alive = true
    loadDefaultOptions(relSearch).then((o) => { if (alive) setRelOpts(o) }).catch(() => {})
    return () => { alive = false }
  }, [isRelation, loadDefaultOptions, relSearch])

  const left = Math.max(8, Math.min(x, window.innerWidth - 320))
  const top = Math.max(8, Math.min(y, window.innerHeight - 120))

  function save() {
    const n = name.trim()
    if (!n) return
    const out: FieldSchemaOut = { name: n, type }
    if (isChoice) {
      out.options = options
        .filter((o) => o.label.trim())
        .map((o) => ({ value: (o.value || o.label).trim(), label: o.label.trim(), ...(o.color ? { color: o.color } : {}) }))
    }
    if (type === 'relation') {
      out.relationshipEntityId = relEntityId || undefined
      out.labelFieldId = labelFieldId || undefined
      out.multiple = multiple || undefined
    }
    if (type === 'lookup') {
      out.viaFieldId = viaFieldId || undefined
      out.lookupFieldId = lookupFieldId || undefined
    }
    if (type === 'rating') out.maxRating = maxRating
    if (type === 'currency') out.currencyCode = (currencyCode || 'BRL').trim().toUpperCase()
    // obrigatório + valor-padrão (limpa o default se o tipo não é seletor)
    out.required = required
    out.defaultValue = canDefault ? defaultValue : ''
    onSave(out)
    onClose()
  }

  // trocar o tipo limpa a config do tipo anterior (evita enviar lixo cruzado)
  function changeType(next: FieldType) {
    setType(next)
    if (next !== 'relation') { setRelEntityId(''); setLabelFieldId(''); setMultiple(false) }
    if (next !== 'lookup') { setViaFieldId(''); setLookupFieldId('') }
  }

  const inputCls =
    'w-full rounded-md border border-[#E2E8F0] px-2 py-1.5 text-sm text-[#0F172A] outline-none focus:border-[#2563EB]'
  const labelCls = 'mb-1 mt-3 block text-[11px] font-medium text-[#94A3B8]'

  return (
    <>
      <div className="fixed inset-0 z-[60]" onMouseDown={onClose} />
      <div
        className="fixed z-[61] flex max-h-[82vh] w-[300px] flex-col overflow-y-auto rounded-lg border border-[#E2E8F0] bg-white p-3 shadow-xl"
        style={{ top, left }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#475569]">
          {mode === 'add' ? 'Novo campo' : 'Editar campo'}
        </div>
        <label className="mb-1 block text-[11px] font-medium text-[#94A3B8]">Nome</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); save() }
            else if (e.key === 'Escape') { e.preventDefault(); onClose() }
          }}
          placeholder="Nome do campo"
          className={inputCls}
        />
        <label className={labelCls}>Tipo</label>
        <select value={type} onChange={(e) => changeType(e.target.value as FieldType)} className={inputCls}>
          {FIELD_TYPE_GROUPS.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ))}
          {/* campo lookup legado: mantém a opção visível só ao editá-lo */}
          {type === 'lookup' && (
            <optgroup label="Avançado">
              <option value={LOOKUP_LEGACY_OPTION.value}>{LOOKUP_LEGACY_OPTION.label}</option>
            </optgroup>
          )}
        </select>
        {TYPE_HELP[type] && (
          <p className="mt-1.5 text-[11px] leading-snug text-[#64748B]">{TYPE_HELP[type]}</p>
        )}

        {/* select / status / multiselect: editor de opções (add / remover / reordenar) */}
        {isChoice && (
          <div className="mt-3">
            <div className="mb-1 text-[11px] font-medium text-[#94A3B8]">Opções</div>
            <div className="flex max-h-[160px] flex-col gap-1 overflow-auto">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input
                    value={o.label}
                    onChange={(e) =>
                      setOptions((prev) => prev.map((p, j) => (j === i ? { ...p, label: e.target.value } : p)))
                    }
                    placeholder={`Opção ${i + 1}`}
                    className={`${inputCls} py-1`}
                  />
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => setOptions((prev) => (i === 0 ? prev : prev.map((p, j) => (j === i - 1 ? prev[i] : j === i ? prev[i - 1] : p))))}
                    className="shrink-0 text-[#94A3B8] hover:text-[#2563EB] disabled:opacity-30"
                    title="Mover para cima"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    disabled={i === options.length - 1}
                    onClick={() => setOptions((prev) => (i === prev.length - 1 ? prev : prev.map((p, j) => (j === i + 1 ? prev[i] : j === i ? prev[i + 1] : p))))}
                    className="shrink-0 text-[#94A3B8] hover:text-[#2563EB] disabled:opacity-30"
                    title="Mover para baixo"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOptions((prev) => prev.filter((_, j) => j !== i))}
                    className="shrink-0 text-[#94A3B8] hover:text-[#EF4444]"
                    title="Remover opção"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setOptions((prev) => [...prev, { value: '', label: '' }])}
              className="mt-1 flex items-center gap-1 text-xs text-[#2563EB] hover:underline"
            >
              <Plus size={13} /> Adicionar opção
            </button>
          </div>
        )}

        {/* relation: tabela de destino + campo a exibir (rótulo) + permitir vários */}
        {type === 'relation' && (
          <>
            <label className={labelCls}>Tabela de destino</label>
            <SearchSelect
              value={relEntityId}
              onChange={(v) => { setRelEntityId(v); setLabelFieldId('') }}
              options={entities.map((e) => ({ value: e.id, label: e.name }))}
              placeholder="Selecione uma tabela…"
            />

            <label className={labelCls}>Campo a mostrar</label>
            <SearchSelect
              value={labelFieldId}
              onChange={setLabelFieldId}
              disabled={!relEntityId || targetFields.length === 0}
              placeholder="Título padrão (nome)"
              options={[
                { value: '', label: 'Título padrão (nome)' },
                ...targetFields.map((f) => ({ value: f.id, label: f.name || f.slug })),
              ]}
            />

            <label className="mt-3 flex items-center gap-2 text-xs text-[#475569]">
              <input
                type="checkbox"
                checked={multiple}
                onChange={(e) => setMultiple(e.target.checked)}
                className="size-3.5 cursor-pointer accent-[#2563EB]"
              />
              Permitir vários (multi)
            </label>
          </>
        )}

        {/* lookup: via relação (campo relation desta entidade) + campo a puxar do alvo */}
        {type === 'lookup' && (
          <>
            <label className={labelCls}>Via relação</label>
            <SearchSelect
              value={viaFieldId}
              onChange={(v) => { setViaFieldId(v); setLookupFieldId('') }}
              options={relationFieldsHere.map((f) => ({ value: f.id, label: f.label }))}
              placeholder="Selecione um campo de relação…"
            />
            {relationFieldsHere.length === 0 && (
              <div className="mt-1 text-[11px] text-[#94A3B8]">Crie um campo de relação primeiro.</div>
            )}

            <label className={labelCls}>Campo a puxar</label>
            <SearchSelect
              value={lookupFieldId}
              onChange={setLookupFieldId}
              disabled={!viaFieldId || lookupTargetFields.length === 0}
              placeholder="Selecione um campo…"
              options={lookupTargetFields.map((f) => ({ value: f.id, label: f.name || f.slug }))}
            />
          </>
        )}

        {/* rating: máximo de estrelas */}
        {type === 'rating' && (
          <>
            <label className={labelCls}>Máximo de estrelas</label>
            <input
              type="number"
              min={1}
              max={10}
              value={maxRating}
              onChange={(e) => setMaxRating(Math.max(1, Math.min(10, Number(e.target.value) || 5)))}
              className={inputCls}
            />
          </>
        )}

        {/* currency: código ISO da moeda */}
        {type === 'currency' && (
          <>
            <label className={labelCls}>Código da moeda</label>
            <input
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value)}
              placeholder="BRL"
              maxLength={3}
              className={`${inputCls} uppercase`}
            />
          </>
        )}

        {/* obrigatório */}
        <label className="mt-3 flex cursor-pointer select-none items-center gap-2">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#2563EB]"
          />
          <span className="text-xs text-[#475569]">Obrigatório</span>
        </label>

        {/* valor padrão (só p/ seletor: choice ou relação) */}
        {canDefault && (
          <div className="mt-3">
            <label className="mb-1 block text-[11px] font-medium text-[#94A3B8]">Valor padrão</label>
            {isChoice ? (
              <select value={defaultValue} onChange={(e) => setDefaultValue(e.target.value)} className={inputCls}>
                <option value="">Nenhum</option>
                {options
                  .filter((o) => o.label.trim())
                  .map((o, i) => {
                    const v = (o.value || o.label).trim()
                    return (
                      <option key={i} value={v}>
                        {o.label.trim()}
                      </option>
                    )
                  })}
              </select>
            ) : (
              <>
                <input
                  value={relSearch}
                  onChange={(e) => setRelSearch(e.target.value)}
                  placeholder="Buscar registro do alvo..."
                  className={`${inputCls} mb-1`}
                />
                <select value={defaultValue} onChange={(e) => setDefaultValue(e.target.value)} className={inputCls}>
                  <option value="">Nenhum</option>
                  {relOpts.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#E2E8F0] px-3 py-1 text-xs text-[#475569] hover:bg-[#F8FAFC]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!name.trim()}
            className="rounded-md bg-[#2563EB] px-3 py-1 text-xs font-medium text-white hover:bg-[#1D4ED8] disabled:opacity-40"
          >
            Salvar
          </button>
        </div>
      </div>
    </>
  )
}

// ---------- componente principal ----------

type Cell = { r: number; c: number }
// acao desfazivel (Ctrl+Z): dado (vira log de restore) OU filtro (UI, nao loga)
type UndoAction = { type: 'audit'; entry: AuditEntry } | { type: 'filter'; prev: FilterGroup }

export default function TableView({
  records,
  fields,
  config,
  onConfigChange,
  onEdit,
  onRowOpen,
  onRowDelete,
  fetchPage,
  audit,
  minimal = false,
  rowActions,
  rowActionsInline = false,
  onFieldUpdate,
  onFieldDelete,
  onFieldDuplicate,
  onFieldAdd,
  loadRelationOptions,
  entities: entityList,
  loadEntityFields,
}: ViewProps) {
  // modo: servidor (host fornece fetchPage) ou cliente (usa `records` local)
  const serverMode = !!fetchPage
  // auditoria + Ctrl+Z: so quando o host habilita o adapter
  const auditOn = !!audit?.enabled
  const auditUser = audit?.currentUser ?? 'você'
  // tipo da view ativa p/ escopar a view padrão do usuário (por tipo de view)
  const viewKey = useContext(ViewKeyContext)
  const [sorting, setSorting] = useState<SortingState>([])
  const [configOpen, setConfigOpen] = useState(false)
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([])
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [active, setActive] = useState<Cell | null>(null)
  const [anchor, setAnchor] = useState<Cell | null>(null) // ancora do intervalo (range de celulas)
  const [editMode, setEditMode] = useState(false)
  const [aggs, setAggs] = useState<Record<string, AggFn>>({})
  const [rowHeight, setRowHeight] = useState(40)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const lastClickedRef = useRef<number | null>(null)
  const [frozenCount, setFrozenCount] = useState(0) // nº de colunas congeladas a partir da esquerda
  const [colMenu, setColMenu] = useState<{ colId: string; index: number; x: number; y: number } | null>(null)
  // edição de schema (campos): popover de editar campo + popover de novo campo
  const [fieldEdit, setFieldEdit] = useState<{ colId: string; x: number; y: number } | null>(null)
  const [newFieldAt, setNewFieldAt] = useState<{ x: number; y: number } | null>(null)
  // editor de relação: opções da entidade-alvo (carregadas via host) + busca
  const [relEditOpts, setRelEditOpts] = useState<{ value: string; label: string }[]>([])
  const [relEditSearch, setRelEditSearch] = useState('')
  // rótulos de relação conhecidos (id -> label), p/ exibir o rótulo após editar
  const relLabelRef = useRef<Map<string, string>>(new Map())
  const [cellMenu, setCellMenu] = useState<{ r: number; c: number; x: number; y: number } | null>(null)
  const [rowMenu, setRowMenu] = useState<{ r: number; x: number; y: number } | null>(null)
  const [savedViews, setSavedViews] = useState<Saved<ViewPayload>[]>(() => loadSaved<ViewPayload>(VIEWS_KEY))
  const [savedFilters, setSavedFilters] = useState<Saved<FilterGroup>[]>(() => loadSaved<FilterGroup>(FILTERS_KEY))
  const [appliedView, setAppliedView] = useState<{ id: string; name: string } | null>(null)
  const [saved, setSaved] = useState(false) // indicador de autosave: pisca verde ao persistir
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [viewsMenu, setViewsMenu] = useState<{ x: number; y: number } | null>(null)
  const [savedFiltersMenu, setSavedFiltersMenu] = useState<{ x: number; y: number } | null>(null)
  // Agrupamento multi-nível: lista ordenada de fieldIds (nível 0 = mais externo).
  // Compat: aceita string legada (single) ou array.
  const [groupBy, setGroupBy] = useState<string[]>(() => normGroupBy(config.roles?.groupBy))
  const [groupDir, setGroupDir] = useState<'asc' | 'desc'>('asc')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [groupMenu, setGroupMenu] = useState<{ x: number; y: number } | null>(null)
  // paginacao server-side
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [serverRows, setServerRows] = useState<Row[]>([])
  const [serverAggRows, setServerAggRows] = useState<Row[]>([])
  // agregações numéricas por campo (SQL, conjunto filtrado inteiro) p/ o rodapé
  const [serverAggregates, setServerAggregates] = useState<Record<string, FieldAggregate>>({})
  const [serverTotal, setServerTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [filterRoot, setFilterRoot] = useState<FilterGroup>({ conj: 'and', items: [] })
  const [filterOpen, setFilterOpen] = useState(false)
  // auditoria: log append-only + pilha de undo (Ctrl+Z) + ids ja revertidos
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const auditSeq = useRef(0)
  const undoRef = useRef<UndoAction[]>([]) // pilha de undo (dados + filtros) nesta sessao
  const filterRootRef = useRef<FilterGroup>(filterRoot)
  filterRootRef.current = filterRoot
  const revertedRef = useRef<Set<string>>(new Set())
  const applyRevertRef = useRef<(e: AuditEntry) => void>(() => {})
  // confirmacao do Ctrl+Z (reverter dado): pede "tem certeza?" antes de aplicar
  const [confirmUndo, setConfirmUndo] = useState<AuditEntry | null>(null)
  const confirmUndoRef = useRef<AuditEntry | null>(null)
  confirmUndoRef.current = confirmUndo
  const undoNoBtnRef = useRef<HTMLButtonElement>(null)

  // SERVER MODE: busca a pagina no backend qdo muda pagina / tamanho / ordenacao / filtro
  useEffect(() => {
    if (!fetchPage) return
    let alive = true
    setLoading(true)
    fetchPage({ limit: pageSize, offset: pageIndex * pageSize, sort: sorting.map((s) => ({ id: s.id, desc: s.desc })), filter: filterRoot }).then((res) => {
      if (!alive) return
      setServerRows(res.rows)
      setServerAggRows(res.aggregateRows)
      setServerAggregates(res.aggregates ?? {})
      setServerTotal(res.total)
      setLoading(false)
    })
    return () => { alive = false }
  }, [fetchPage, pageIndex, pageSize, sorting, filterRoot])

  // carrega o historico do adapter (produto: SELECT na tabela de auditoria)
  useEffect(() => {
    if (!audit?.list) return
    Promise.resolve(audit.list()).then(setAuditLog)
  }, [audit])

  // Ctrl+Z global: desfaz a ultima acao (dado -> log de restore; filtro -> sem log).
  // Ignora quando o foco esta num input/editor de celula.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.key !== 'z' && e.key !== 'Z') || e.shiftKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      // pega a ultima acao "viva" (pula ops de dado ja revertidas)
      let act = undoRef.current.pop()
      while (act && act.type === 'audit' && revertedRef.current.has(act.entry.id)) act = undoRef.current.pop()
      if (!act) return
      e.preventDefault()
      if (act.type === 'filter') {
        setFilterRoot(act.prev) // restaura o filtro anterior (UI, nao loga)
        setPageIndex(0)
      } else if (!confirmUndoRef.current) {
        setConfirmUndo(act.entry) // dado: pede confirmacao antes de reverter
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // foca o botao "Não" (default seguro) ao abrir o dialog de confirmacao
  useEffect(() => { if (confirmUndo) undoNoBtnRef.current?.focus() }, [confirmUndo])
  // cancelar = devolve a acao p/ a pilha (pode tentar de novo); confirmar = reverte
  const cancelUndo = () => {
    if (confirmUndo) undoRef.current.push({ type: 'audit', entry: confirmUndo })
    setConfirmUndo(null)
  }
  const confirmUndoNow = () => {
    if (confirmUndo) applyRevert(confirmUndo)
    setConfirmUndo(null)
  }

  // ---- filtros em arvore: a UI mora no FilterPanel; aqui so estado + undo ----
  const filterCount = countFilterLeaves(filterRoot)
  // aplica uma nova arvore de filtro inteira (FilterPanel emite o root ja transformado)
  const commitFilter = (next: FilterGroup) => {
    undoRef.current.push({ type: 'filter', prev: filterRootRef.current }) // Ctrl+Z desfaz (sem logar)
    setFilterRoot(next)
    setPageIndex(0)
  }
  // adiciona uma condicao de igualdade no filtro raiz (clique no resumo do rodape)
  const addFilterValue = (fieldId: string, value: string) => {
    const f = fields.find((x) => x.id === fieldId)
    const op = f && (f.type === 'multiselect' || f.type === 'relation') ? 'tem' : '='
    const root = filterRootRef.current
    if (root.items.some((it) => !isGroup(it) && it.fieldId === fieldId && it.op === op && it.value === value)) return
    commitFilter({ ...root, items: [...root.items, { fieldId, op, value }] })
  }

  const visibleIds: string[] = config.visibleFieldIds?.length ? config.visibleFieldIds : DEFAULT_VISIBLE

  const visibleFields = useMemo(
    () => visibleIds.flatMap((id) => fields.find((f) => f.id === id) ?? []),
    [visibleIds, fields],
  )

  // Lookup: mapa id -> registro, e opcoes (id -> nome) p/ editar relacoes.
  const recordsById = useMemo(() => {
    const m = new Map<string, Row>()
    for (const r of records) m.set(r.id, r)
    return m
  }, [records])
  const recordOptions = useMemo(
    () => records.map((r) => ({ value: r.id, label: String(r.nome ?? r.id) })),
    [records],
  )
  // usuarios p/ compartilhar views/filtros (no lab: opcoes do campo pessoa)
  const userOptions = useMemo(
    () => (fields.find((f) => f.type === 'person')?.options ?? []).map((o) => ({ value: o.value, label: o.label })),
    [fields],
  )

  useEffect(() => {
    setColumnOrder((prev) => {
      const ids = visibleFields.map((f) => f.id)
      const kept = prev.filter((id) => ids.includes(id))
      const added = ids.filter((id) => !kept.includes(id))
      return [...kept, ...added]
    })
  }, [visibleFields])

  const columns = useMemo<ColumnDef<Row>[]>(
    () =>
      visibleFields.map((field) => ({
        id: field.id,
        accessorFn: (row: Row) => row[field.id],
        header: field.label,
        size: defaultSize(field),
        minSize: 60,
        enableResizing: true,
        enableSorting: !['id', 'multiselect', 'image', 'relation', 'lookup'].includes(field.type),
        cell: ({ row, getValue }) => renderDisplay(field, getValue(), recordsById, row.original),
      })),
    [visibleFields, recordsById],
  )

  // CLIENT MODE: filtra/ordena/pagina `records` localmente (mesmos helpers do mock)
  const clientFiltered = useMemo(
    () => (serverMode ? [] : sortRows(filterRows(records, filterRoot), sorting.map((s) => ({ id: s.id, desc: s.desc })))),
    [serverMode, records, filterRoot, sorting],
  )
  const clientPage = useMemo(
    () => (serverMode ? [] : clientFiltered.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize)),
    [serverMode, clientFiltered, pageIndex, pageSize],
  )

  // dados da grade: pagina do servidor (server mode) ou pagina local (client)
  const pageRows = serverMode ? serverRows : clientPage
  // base p/ agregacoes do rodape/indicadores: o conjunto FILTRADO completo (ambos modos)
  const aggRecords = serverMode ? serverAggRows : clientFiltered
  // total p/ paginacao (server: backend; client: tamanho do filtrado)
  const effectiveTotal = serverMode ? serverTotal : clientFiltered.length
  // ordenacao e paginacao sao sempre manuais (server faz no backend, client faz nos memos acima)
  const onSortingChange = (updater: SortingState | ((s: SortingState) => SortingState)) => {
    setSorting((prev) => (typeof updater === 'function' ? updater(prev) : updater))
    setPageIndex(0)
  }

  const table = useReactTable({
    data: pageRows,
    columns,
    state: { sorting, columnOrder, columnSizing },
    onSortingChange,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    enableMultiSort: true,
    isMultiSortEvent: () => true, // todo clique combina (nao precisa segurar Shift)
    maxMultiSortColCount: 99,
    manualSorting: true, // ja vem ordenado (server ou memo client)
    manualPagination: true, // ja vem paginado
    rowCount: effectiveTotal,
    getRowId: (row) => String(row.id), // id LOGICO = id do dado (nao o indice). p/ abrir/selecionar/excluir
    getCoreRowModel: getCoreRowModel(),
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function handleDragEnd(e: DragEndEvent) {
    const { active: a, over } = e
    if (!over || a.id === over.id) return
    setColumnOrder((prev) => {
      const oldI = prev.indexOf(a.id as string)
      const newI = prev.indexOf(over.id as string)
      if (oldI < 0 || newI < 0) return prev
      return arrayMove(prev, oldI, newI)
    })
  }

  const rows = table.getRowModel().rows
  const orderedCols = table.getVisibleLeafColumns()
  const numCols = orderedCols.length
  // coluna de acoes (sem titulo) com botoes inline. So aparece quando o host
  // pede rowActionsInline (ex: grid de logs). Senao, as acoes ficam no menu de
  // contexto da linha (botao direito), pra nao poluir a tabela.
  const hasRowActions = !!rowActions?.length && rowActionsInline
  const bodyColSpan = numCols + 1 + (hasRowActions ? 1 : 0)
  // affordance "+" (novo campo) no fim do cabecalho, so quando o host liga onFieldAdd
  const showAddField = !!onFieldAdd

  // ---- agrupamento multi-nível (indisponivel no modo paginado server) ----
  // groupBy é uma lista ordenada de fieldIds; cada nível vira uma faixa aninhada.
  type GRow = (typeof rows)[number]
  const groupFields = useMemo(
    () => groupBy.map((id) => fields.find((f) => f.id === id)).filter((f): f is Field => !!f),
    [groupBy, fields],
  )
  const groupLabelOf = (field: Field | undefined, k: string): string => {
    if (k === '∅') return '(vazio)'
    const opt = field?.options?.find((o) => o.value === k)
    if (opt) return opt.label
    const rec = recordsById.get(k)
    if (rec) return String(rec.nome ?? k)
    return k
  }
  const groupKeyOf = (row: GRow, field: Field): string => {
    const raw = (row.original as Row)[field.id]
    return Array.isArray(raw) ? (raw.length ? String(raw[0]) : '∅') : raw == null || raw === '' ? '∅' : String(raw)
  }
  const groups = useMemo(() => {
    if (!groupFields.length) return null
    const build = (subset: GRow[], depth: number, parentPath: string): GroupNode<GRow>[] => {
      const field = groupFields[depth]!
      const map = new Map<string, GRow[]>()
      for (const row of subset) {
        const key = groupKeyOf(row, field)
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(row)
      }
      const keys = [...map.keys()].sort((a, b) => groupLabelOf(field, a).localeCompare(groupLabelOf(field, b), 'pt-BR'))
      if (groupDir === 'desc') keys.reverse()
      const isLast = depth === groupFields.length - 1
      return keys.map((k) => {
        const rowsHere = map.get(k)!
        // path acumula as chaves dos níveis pais (separador ¦), garantindo colapso
        // independente de grupos homônimos sob pais diferentes.
        const path = parentPath ? `${parentPath}¦${k}` : k
        return {
          path, key: k, field, depth, count: rowsHere.length, rows: rowsHere,
          children: isLast ? null : build(rowsHere, depth + 1, path),
        }
      })
    }
    return build(rows, 0, '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupFields, groupDir, rows, recordsById])

  // linhas na ordem de exibição = folhas em DFS (nós internos só rotulam).
  const orderedRows = useMemo(() => {
    if (!groups) return rows
    const out: GRow[] = []
    const walk = (nodes: GroupNode<GRow>[]) => {
      for (const n of nodes) {
        if (n.children) walk(n.children)
        else out.push(...n.rows)
      }
    }
    walk(groups)
    return out
  }, [groups, rows])
  const numRows = orderedRows.length
  const rowIndex = useMemo(() => {
    const m = new Map<string, number>()
    orderedRows.forEach((row, i) => m.set(row.id, i))
    return m
  }, [orderedRows])

  // ---- editor de relação (server-side): campo em edição -> opções do alvo ----
  // Quando o host fornece `loadRelationOptions`, o editor de uma célula relation
  // busca as opções na entidade-ALVO (id + rótulo), com busca server-side. Sem o
  // host (sandbox/lab) o editor cai no `recordOptions` local.
  const editingColId = editMode && active && active.r >= 0 ? orderedCols[active.c]?.id : undefined
  const editingField = editingColId ? fields.find((f) => f.id === editingColId) : undefined
  const relEditing = editingField?.type === 'relation' && !!loadRelationOptions
  // reseta a busca ao trocar o campo/célula em edição
  useEffect(() => { setRelEditSearch('') }, [editingColId])
  // carrega (debounced) as opções da entidade-alvo do campo relation em edição
  useEffect(() => {
    if (!relEditing || !loadRelationOptions || !editingColId) { setRelEditOpts([]); return }
    let alive = true
    const t = setTimeout(() => {
      loadRelationOptions(editingColId, relEditSearch)
        .then((opts) => {
          if (!alive) return
          setRelEditOpts(opts)
          for (const o of opts) relLabelRef.current.set(o.value, o.label)
        })
        .catch(() => { if (alive) setRelEditOpts([]) })
    }, relEditSearch ? 180 : 0)
    return () => { alive = false; clearTimeout(t) }
  }, [relEditing, editingColId, relEditSearch, loadRelationOptions])

  // ---- selecao de linhas (checkbox + selecionar tudo + shift-range) ----
  const allSelected = numRows > 0 && orderedRows.every((r) => selected.has(r.id)) // todas da PAGINA
  const someSelected = selected.size > 0 && !allSelected
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(orderedRows.map((r) => r.id)))
  }
  // seleciona TODOS os registros do conjunto filtrado, ignorando a paginacao
  const selectAllAcross = () => setSelected(new Set(aggRecords.map((r) => r.id)))
  function toggleRow(index: number, shift: boolean) {
    const id = orderedRows[index]?.id
    if (!id) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (shift && lastClickedRef.current != null) {
        const a = Math.min(lastClickedRef.current, index)
        const b = Math.max(lastClickedRef.current, index)
        const target = !prev.has(id) // estado alvo = oposto do estado atual do clicado
        for (let i = a; i <= b; i++) {
          const rid = orderedRows[i]?.id
          if (!rid) continue
          if (target) next.add(rid)
          else next.delete(rid)
        }
      } else {
        if (next.has(id)) next.delete(id)
        else next.add(id)
      }
      return next
    })
    lastClickedRef.current = index
  }
  function toggleCollapse(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // ---- congelar colunas (pin a esquerda): frozenCount colunas a partir da esquerda ----
  const colLeft = (c: number) => {
    let x = GUTTER
    for (let i = 0; i < c && i < orderedCols.length; i++) x += orderedCols[i].getSize()
    return x
  }
  const toggleFreeze = (c: number) => setFrozenCount((prev) => (c < prev ? c : c + 1))

  // itens do menu de contexto da coluna. Built-ins reais + acoes opcionais (schema/permissao).
  // Quando o host liga os callbacks de schema (onFieldUpdate/Duplicate/Delete), as
  // ações mutam o schema de verdade (via backend); senão respeitam SCHEMA_PERMS.
  const canEditSchema = SCHEMA_PERMS.canEdit && !!onFieldUpdate
  const canDupSchema = SCHEMA_PERMS.canCreate || !!onFieldDuplicate
  const canDelSchema = SCHEMA_PERMS.canDelete || !!onFieldDelete
  function buildColMenu(colId: string, index: number, x: number, y: number): MenuEntry[] {
    const field = fields.find((f) => f.id === colId)
    const label = field?.label ?? colId
    const isFrozen = index < frozenCount
    return [
      { icon: <ArrowUpAZ size={15} />, label: 'Classificar crescente', onSelect: () => setSorting([{ id: colId, desc: false }]) },
      { icon: <ArrowDownAZ size={15} />, label: 'Classificar decrescente', onSelect: () => setSorting([{ id: colId, desc: true }]) },
      null,
      { icon: <ArrowLeftToLine size={15} />, label: 'Mover para o início', onSelect: () => setColumnOrder((prev) => [colId, ...prev.filter((x) => x !== colId)]) },
      { icon: <ArrowRightToLine size={15} />, label: 'Mover para o final', onSelect: () => setColumnOrder((prev) => [...prev.filter((x) => x !== colId), colId]) },
      { icon: <Snowflake size={15} />, label: isFrozen ? 'Descongelar' : 'Congelar até aqui', onSelect: () => toggleFreeze(index) },
      null,
      { icon: <EyeOff size={15} />, label: 'Ocultar coluna', onSelect: () => toggleField(colId) },
      null,
      ...(SCHEMA_PERMS.canEdit
        ? [
            {
              icon: <Pencil size={15} />,
              label: 'Editar campo',
              disabled: !canEditSchema,
              hint: canEditSchema ? undefined : 'sem permissão',
              onSelect: () =>
                canEditSchema
                  ? setFieldEdit({ colId, x, y })
                  : toast.info(`Editar "${label}" requer permissão`),
            },
            { icon: <Shield size={15} />, label: 'Privacidade e permissões', onSelect: () => toast.info('Permissões , ação do dev') },
          ]
        : []),
      // mutacoes de schema: usam o host (backend) quando ligado; senao respeitam SCHEMA_PERMS
      {
        icon: <Copy size={15} />,
        label: 'Duplicar campo',
        disabled: !canDupSchema,
        hint: canDupSchema ? undefined : 'sem permissão',
        onSelect: () =>
          onFieldDuplicate ? onFieldDuplicate(colId) : toast.info(`Duplicar "${label}" , ação do dev`),
      },
      {
        icon: <TrashIcon size={15} />,
        label: 'Excluir campo',
        danger: true,
        disabled: !canDelSchema,
        hint: canDelSchema ? undefined : 'sem permissão',
        onSelect: () =>
          onFieldDelete ? onFieldDelete(colId) : toast.warning(`Excluir "${label}" requer permissão`),
      },
    ]
  }

  // salva a edição de um campo: envia ao host só o que mudou (nome / tipo / config).
  // Enviar `type` força o backend a reconstruir o config — então TODA config
  // type-específica (opções / relação / lookup / rating / moeda) só persiste junto
  // do tipo; por isso, se qualquer config mudar, reenvia o tipo com ela.
  const editingCol = fieldEdit ? fields.find((f) => f.id === fieldEdit.colId) : undefined
  function saveFieldEdit(out: FieldSchemaOut) {
    if (!fieldEdit || !onFieldUpdate || !editingCol) { setFieldEdit(null); return }
    const updates: { name?: string; type?: FieldType; required?: boolean; defaultValue?: string } & FieldConfigInput = {}
    if (out.name !== editingCol.label) updates.name = out.name
    const isChoice = CHOICE_TYPES.includes(out.type)
    const typeChanged = out.type !== editingCol.type
    const optsChanged = isChoice && JSON.stringify(out.options ?? []) !== JSON.stringify(editingCol.options ?? [])
    const relChanged =
      out.type === 'relation' &&
      ((out.relationshipEntityId ?? '') !== (editingCol.relationEntityId ?? '') ||
        (out.labelFieldId ?? '') !== (editingCol.labelFieldId ?? '') ||
        !!out.multiple !== !!editingCol.multiple)
    const lookupChanged =
      out.type === 'lookup' &&
      ((out.viaFieldId ?? '') !== (editingCol.viaFieldId ?? '') ||
        (out.lookupFieldId ?? '') !== (editingCol.lookupFieldId ?? ''))
    const ratingChanged = out.type === 'rating' && (out.maxRating ?? 5) !== (editingCol.maxRating ?? 5)
    const currencyChanged = out.type === 'currency' && (out.currencyCode ?? 'BRL') !== (editingCol.currency ?? 'BRL')
    if (typeChanged || optsChanged || relChanged || lookupChanged || ratingChanged || currencyChanged) {
      updates.type = out.type
      if (isChoice) updates.options = out.options ?? []
      if (out.type === 'relation') {
        updates.relationshipEntityId = out.relationshipEntityId
        updates.labelFieldId = out.labelFieldId
        updates.multiple = out.multiple
      }
      if (out.type === 'lookup') {
        updates.viaFieldId = out.viaFieldId
        updates.lookupFieldId = out.lookupFieldId
      }
      if (out.type === 'rating') updates.maxRating = out.maxRating
      if (out.type === 'currency') updates.currencyCode = out.currencyCode
    }
    // required + valor-padrão: só enviam quando mudam (evita reescrita à toa).
    if (!!out.required !== !!editingCol.required) updates.required = !!out.required
    if ((out.defaultValue ?? '') !== (editingCol.defaultValue ?? '')) updates.defaultValue = out.defaultValue ?? ''
    if (Object.keys(updates).length) onFieldUpdate(editingCol.id, updates)
    setFieldEdit(null)
  }

  const activeCellRef = useRef<HTMLTableCellElement | null>(null)
  const activeHeaderRef = useRef<HTMLTableCellElement | null>(null)
  // drag-select (clicar e arrastar p/ selecionar intervalo)
  const draggingRef = useRef(false)
  const movedRef = useRef(false)
  const pendingEditRef = useRef(false)
  // limites do intervalo de celulas selecionado (anchor..active)
  const rng = active && anchor ? { minR: Math.min(anchor.r, active.r), maxR: Math.max(anchor.r, active.r), minC: Math.min(anchor.c, active.c), maxC: Math.max(anchor.c, active.c) } : null
  const isMultiSel = !!rng && (rng.minR !== rng.maxR || rng.minC !== rng.maxC)
  // borda grossa no PERIMETRO do intervalo (estilo planilha), via box-shadow (sem deslocar layout)
  function rangeBorder(r: number, c: number): string | undefined {
    if (!rng || !isMultiSel || r < rng.minR || r > rng.maxR || c < rng.minC || c > rng.maxC) return undefined
    const s: string[] = []
    if (r === rng.minR) s.push('inset 0 2px 0 0 #2563EB')
    if (r === rng.maxR) s.push('inset 0 -2px 0 0 #2563EB')
    if (c === rng.minC) s.push('inset 2px 0 0 0 #2563EB')
    if (c === rng.maxC) s.push('inset -2px 0 0 0 #2563EB')
    return s.length ? s.join(', ') : undefined
  }

  function clamp(n: number, max: number): number {
    return Math.max(0, Math.min(n, max))
  }
  // linhas vao de -1 (cabecalho) ate numRows-1
  function clampRow(n: number): number {
    return Math.max(-1, Math.min(n, numRows - 1))
  }
  function isEditableCol(c: number): boolean {
    const id = orderedCols[c]?.id
    return isEditableField(fields.find((x) => x.id === id))
  }
  // setSel = posiciona a celula ativa E colapsa o intervalo (anchor = active)
  function setSel(r: number, c: number, edit: boolean) {
    const cell = { r: clampRow(r), c: clamp(c, numCols - 1) }
    setActive(cell)
    setAnchor(cell)
    setEditMode(edit && isEditableCol(cell.c))
  }
  function selectCell(r: number, c: number, edit: boolean) {
    setSel(r, c, edit)
  }
  // estende o intervalo: move a ativa mantendo a ancora
  function extendTo(r: number, c: number) {
    setActive({ r: clampRow(r), c: clamp(c, numCols - 1) })
    setEditMode(false)
  }
  function extendBy(dr: number, dc: number) {
    if (!active) return
    extendTo(active.r + dr, active.c + dc)
  }
  function moveBy(dr: number, dc: number) {
    if (!active) return
    setSel(active.r + dr, active.c + dc, false)
  }
  // Tab/Shift+Tab apenas MOVE a selecao (nao entra em edicao; isso so no Enter).
  function moveRight() {
    if (!active) return
    let r = active.r
    let c = active.c + 1
    if (c >= numCols) { c = 0; r = clampRow(r + 1) }
    setSel(r, c, false)
  }
  function moveLeft() {
    if (!active) return
    let r = active.r
    let c = active.c - 1
    if (c < 0) { c = numCols - 1; r = clampRow(r - 1) }
    setSel(r, c, false)
  }
  // indicador de autosave: pisca verde por ~1.5s a cada persistencia
  function markSaved() {
    setSaved(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }

  // ---- auditoria + Ctrl+Z ----
  const fieldLabel = (id: string) => fields.find((f) => f.id === id)?.label ?? id
  // grava uma entry (append-only). Ops "forward" entram na pilha de undo.
  function pushAudit(p: Omit<AuditEntry, 'id' | 'ts' | 'user'>): AuditEntry | null {
    if (!auditOn) return null
    const entry: AuditEntry = { id: `a${Date.now()}-${auditSeq.current++}`, ts: Date.now(), user: auditUser, ...p }
    audit?.log?.(entry)
    setAuditLog((prev) => [...prev, entry])
    if (entry.kind !== 'restore') undoRef.current.push({ type: 'audit', entry })
    return entry
  }
  // aplica os valores 'before' de um conjunto de celulas (reusado por edit/bulk/restore)
  function applyCells(cells: AuditCell[]) {
    const patches = new Map<string, Record<string, unknown>>()
    for (const c of cells) {
      onEdit(c.rowId, c.fieldId, c.before)
      const p = patches.get(c.rowId) ?? {}
      p[c.fieldId] = c.before
      patches.set(c.rowId, p)
    }
    if (serverMode) setServerRows((prev) => prev.map((row) => (patches.has(row.id) ? { ...row, ...patches.get(row.id) } : row)))
  }
  // reverter = reaplica o estado anterior como uma NOVA operacao (kind 'restore'),
  // sem anular a entry original (auditoria imutavel).
  function applyRevert(entry: AuditEntry) {
    if (!auditOn || revertedRef.current.has(entry.id)) return
    revertedRef.current.add(entry.id)
    if (entry.kind === 'delete' && entry.row) {
      if (serverMode) {
        setServerRows((p) => [entry.row as Row, ...p])
        setServerAggRows((p) => [entry.row as Row, ...p])
        setServerTotal((t) => t + 1)
      }
      pushAudit({ kind: 'restore', label: 'Restaurou linha excluída', row: entry.row, restoreOf: entry.id })
    } else if (entry.kind === 'duplicate' && entry.row) {
      if (serverMode) {
        setServerRows((p) => p.filter((x) => x.id !== entry.row!.id))
        setServerTotal((t) => Math.max(0, t - 1))
      }
      pushAudit({ kind: 'restore', label: 'Desfez duplicação', row: entry.row, restoreOf: entry.id })
    } else if (entry.cells?.length) {
      applyCells(entry.cells)
      const swapped: AuditCell[] = entry.cells.map((c) => ({ rowId: c.rowId, fieldId: c.fieldId, before: c.after, after: c.before }))
      const what = entry.cells.length === 1 ? fieldLabel(entry.cells[0].fieldId) : `${entry.cells.length} células`
      pushAudit({ kind: 'restore', label: `Reverteu ${what}`, cells: swapped, restoreOf: entry.id })
    }
    markSaved()
  }
  applyRevertRef.current = applyRevert
  // se a entry ainda pode ser revertida (estrutural so faz sentido no server mode)
  const canRevert = (e: AuditEntry) =>
    auditOn && e.kind !== 'restore' && !revertedRef.current.has(e.id) &&
    (e.kind === 'delete' || e.kind === 'duplicate' ? serverMode : !!e.cells?.length)

  // grid de logs: a propria TableView (modo cliente + enxuto) com acao "Reverter"
  function renderLogGrid(list: AuditEntry[]) {
    const logRows: Row[] = list.map((e) => ({
      id: e.id,
      kind: e.kind,
      label: e.label,
      campo: e.cells?.map((c) => fieldLabel(c.fieldId)).join(', ') ?? (e.row ? 'linha' : ''),
      antes: e.cells?.map((c) => fmtLogVal(c.before)).join(' | ') ?? '',
      depois: e.cells?.map((c) => fmtLogVal(c.after)).join(' | ') ?? '',
      usuario: e.user,
      quando: new Date(e.ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }),
    }))
    const byId = new Map(list.map((e) => [e.id, e]))
    return (
      <TableView
        records={logRows}
        fields={LOG_FIELDS}
        config={{ visibleFieldIds: LOG_FIELD_IDS }}
        onConfigChange={() => {}}
        onEdit={() => {}}
        minimal
        rowActionsInline
        rowActions={[{
          label: 'Reverter',
          onSelect: (rowId) => { const e = byId.get(rowId); if (e) applyRevert(e) },
          enabled: (rowId) => { const e = byId.get(rowId); return !!e && canRevert(e) },
        }]}
      />
    )
  }

  function commit(cell: Cell, val: unknown) {
    const row = rows[cell.r]
    const colId = orderedCols[cell.c]?.id
    if (!row || !colId) return
    const before = row.original[colId]
    onEdit(row.original.id, colId, val)
    // server mode: atualiza a linha da pagina na hora (otimista); client mode re-renderiza via `records` do host.
    // relacao: persiste o id (via onEdit), mas exibe o RÓTULO conhecido (a injeção de rótulo do host confirma no refetch).
    const field = fields.find((f) => f.id === colId)
    const display =
      field?.type === 'relation'
        ? Array.isArray(val)
          ? (val as unknown[]).map((v) => relLabelRef.current.get(String(v)) ?? v)
          : val == null || val === ''
            ? val
            : (relLabelRef.current.get(String(val)) ?? val)
        : val
    if (serverMode) setServerRows((prev) => prev.map((r) => (r.id === row.original.id ? { ...r, [colId]: display } : r)))
    if (auditOn && before !== val)
      pushAudit({ kind: 'edit', label: `Editou ${fieldLabel(colId)}`, cells: [{ rowId: row.original.id, fieldId: colId, before, after: val }] })
    markSaved()
  }

  // Foca a celula ativa quando SELECIONADA (nao editando). r === -1 = cabecalho.
  useEffect(() => {
    if (!active || editMode) return
    if (active.r === -1) activeHeaderRef.current?.focus()
    else activeCellRef.current?.focus()
  }, [active, editMode])

  // fim do drag-select; se foi clique simples numa celula ja selecionada, entra em edicao
  useEffect(() => {
    const up = () => {
      if (!draggingRef.current) return
      draggingRef.current = false
      if (!movedRef.current && pendingEditRef.current) setEditMode(true)
      pendingEditRef.current = false
    }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  // Teclado da celula SELECIONADA: setas, Enter, Tab/Shift+Tab, Esc, Ctrl+C.
  function jumpTo(r: number, c: number) {
    if (!active) return
    setSel(r, c, false)
  }
  // copia o intervalo selecionado como CSV
  function copyRangeCsv() {
    if (!active) return
    const a = anchor ?? active
    const minR = Math.max(0, Math.min(a.r, active.r))
    const maxR = Math.min(numRows - 1, Math.max(a.r, active.r))
    const minC = Math.min(a.c, active.c)
    const maxC = Math.max(a.c, active.c)
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
    const out: string[] = []
    for (let r = minR; r <= maxR; r++) {
      const orig = orderedRows[r]?.original
      const cells: string[] = []
      for (let c = minC; c <= maxC; c++) {
        const colId = orderedCols[c]?.id
        const field = colId ? fields.find((f) => f.id === colId) : undefined
        cells.push(esc(field && orig ? cellToText(field, orig[colId!], recordsById) : ''))
      }
      out.push(cells.join(','))
    }
    copyText(out.join('\n'))
  }
  // celulas do intervalo selecionado (com field/rowId)
  function rangeCells(): { r: number; c: number; colId: string; field?: Field; rowId: string }[] {
    if (!rng) return []
    const out: { r: number; c: number; colId: string; field?: Field; rowId: string }[] = []
    for (let r = Math.max(0, rng.minR); r <= rng.maxR; r++) {
      const rowObj = orderedRows[r]
      if (!rowObj) continue
      for (let c = rng.minC; c <= rng.maxC; c++) {
        const colId = orderedCols[c]?.id
        if (!colId) continue
        out.push({ r, c, colId, field: fields.find((f) => f.id === colId), rowId: rowObj.original.id })
      }
    }
    return out
  }
  // aplica um valor (por celula) a TODAS as celulas editaveis do intervalo
  function bulkApply(getVal: (cell: { r: number; c: number; colId: string; field?: Field; rowId: string }) => unknown) {
    const cells = rangeCells().filter((c) => isEditableField(c.field))
    const patches = new Map<string, Record<string, unknown>>()
    const auditCells: AuditCell[] = []
    for (const cell of cells) {
      const v = getVal(cell)
      if (v === undefined) continue
      const before = orderedRows[cell.r]?.original[cell.colId]
      onEdit(cell.rowId, cell.colId, v)
      const p = patches.get(cell.rowId) ?? {}
      p[cell.colId] = v
      patches.set(cell.rowId, p)
      if (before !== v) auditCells.push({ rowId: cell.rowId, fieldId: cell.colId, before, after: v })
    }
    if (!patches.size) return
    if (serverMode) setServerRows((prev) => prev.map((row) => (patches.has(row.id) ? { ...row, ...patches.get(row.id) } : row)))
    if (auditOn && auditCells.length)
      pushAudit({ kind: 'bulk', label: `Alterou ${auditCells.length} célula${auditCells.length === 1 ? '' : 's'}`, cells: auditCells })
    markSaved()
  }
  function onCellKeyDown(e: ReactKeyboardEvent) {
    if (editMode) return
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); copyRangeCsv(); return }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      if (isMultiSel) bulkApply(() => null)
      else if (active && active.r >= 0 && isEditableCol(active.c)) commit({ r: active.r, c: active.c }, null)
      return
    }
    const jump = e.ctrlKey || e.metaKey // Ctrl/Cmd = extremo
    const ext = e.shiftKey // Shift = estende o intervalo (mantem ancora)
    // Ctrl+Shift = estende ATE o extremo (ex: selecionar tudo ate o fim)
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); jump && ext ? extendTo(active!.r, numCols - 1) : jump ? jumpTo(active!.r, numCols - 1) : ext ? extendBy(0, 1) : moveBy(0, 1); break
      case 'ArrowLeft': e.preventDefault(); jump && ext ? extendTo(active!.r, 0) : jump ? jumpTo(active!.r, 0) : ext ? extendBy(0, -1) : moveBy(0, -1); break
      case 'ArrowDown': e.preventDefault(); jump && ext ? extendTo(numRows - 1, active!.c) : jump ? jumpTo(numRows - 1, active!.c) : ext ? extendBy(1, 0) : moveBy(1, 0); break
      case 'ArrowUp': e.preventDefault(); jump && ext ? extendTo(0, active!.c) : jump ? jumpTo(-1, active!.c) : ext ? extendBy(-1, 0) : moveBy(-1, 0); break
      case 'Enter':
        e.preventDefault()
        if (active?.r === -1) orderedCols[active.c]?.toggleSorting(undefined, true) // header: ordena
        else if (active && isEditableCol(active.c)) setEditMode(true)
        else moveBy(1, 0)
        break
      case 'Tab':
        e.preventDefault()
        if (e.shiftKey) moveLeft()
        else moveRight()
        break
      case 'Escape': e.preventDefault(); setActive(null); setAnchor(null); break
    }
  }

  // Todos os campos entram no painel "Campos" (inclui a coluna sintética UUID,
  // type 'id', que nasce oculta e pode ser ligada aqui).
  const toggleableFields = fields
  function toggleField(fieldId: string) {
    const next = fields
      .filter((f) => (f.id === fieldId ? !visibleIds.includes(f.id) : visibleIds.includes(f.id)))
      .map((f) => f.id)
    onConfigChange({ visibleFieldIds: next })
  }

  const getAgg = (field: Field): AggFn => aggs[field.id] ?? defaultAgg(field)
  const setAgg = (id: string, fn: AggFn) => setAggs((p) => ({ ...p, [id]: fn }))

  // arrastar p/ ajustar altura das linhas (global, igual largura de coluna)
  function startRowResize(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const startY = e.clientY
    const startH = rowHeight
    const onMove = (ev: MouseEvent) => setRowHeight(Math.max(32, Math.min(240, startH + (ev.clientY - startY))))
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // uma linha do corpo (reutilizada no modo plano e agrupado). `r` = indice global.
  function renderBodyRow(row: (typeof rows)[number], r: number) {
    const isSel = selected.has(row.id)
    const rowBg = isSel ? 'bg-[#EFF6FF]' : r % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'
    return (
      <TableRow
        key={row.id}
        style={{ height: rowHeight }}
        className={['border-b border-[#E2E8F0] transition-colors', rowBg].join(' ')}
      >
        <td
          className={['sticky left-0 z-10 px-0 align-middle', rowBg].join(' ')}
          style={{ width: GUTTER, left: 0 }}
          onContextMenu={(e) => { e.preventDefault(); setRowMenu({ r, x: e.clientX, y: e.clientY }) }}
        >
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={isSel}
              readOnly
              onClick={(e) => { e.stopPropagation(); toggleRow(r, e.shiftKey) }}
              className="size-3.5 cursor-pointer accent-[#2563EB]"
            />
          </div>
        </td>
        {row.getVisibleCells().map((cell, c) => {
          const field = visibleFields.find((f) => f.id === cell.column.id)
          const isActive = active?.r === r && active?.c === c
          const isEditing = isActive && editMode && isEditableField(field)
          const isSelected = isActive && !editMode
          const inRange = !!rng && r >= rng.minR && r <= rng.maxR && c >= rng.minC && c <= rng.maxC
          const isCurrency = cell.column.id === 'valorContrato'
          const frozen = c < frozenCount
          return (
            <td
              key={cell.id}
              ref={isSelected ? activeCellRef : undefined}
              tabIndex={isSelected ? 0 : undefined}
              onKeyDown={isSelected ? onCellKeyDown : undefined}
              onMouseDown={(e) => {
                if (e.button !== 0) return
                if (e.shiftKey && active) { e.preventDefault(); extendTo(r, c); return }
                draggingRef.current = true
                movedRef.current = false
                pendingEditRef.current = isSelected && isEditableCol(c) // clique simples em celula ja selecionada -> edita no mouseup
                selectCell(r, c, false)
              }}
              onMouseEnter={() => { if (draggingRef.current) { movedRef.current = true; extendTo(r, c) } }}
              onDoubleClick={() => selectCell(r, c, true)}
              onContextMenu={(e) => { e.preventDefault(); if (!inRange) selectCell(r, c, false); setCellMenu({ r, c, x: e.clientX, y: e.clientY }) }}
              style={{ width: cell.column.getSize(), ...(frozen ? { position: 'sticky', left: colLeft(c), zIndex: isActive ? 15 : 11 } : {}), ...(rangeBorder(r, c) ? { boxShadow: rangeBorder(r, c) } : {}) }}
              className={[
                'py-2 px-3 align-middle cursor-default outline-none group relative select-none',
                isCurrency ? 'text-right' : '',
                inRange && !isActive ? 'bg-[#EFF6FF]' : frozen && !isActive ? rowBg : '',
                frozen ? 'after:pointer-events-none after:absolute after:top-0 after:right-0 after:h-full after:w-px after:bg-[#E2E8F0]' : '',
                isActive && !isMultiSel ? 'z-10 bg-[#DBEAFE]' : '',
                isActive && isMultiSel ? 'bg-[#DBEAFE] z-10' : '',
              ].join(' ')}
            >
              {isEditing && field ? (
                <EditCell
                  field={field}
                  value={cell.getValue()}
                  recordOptions={recordOptions}
                  relationOptions={field.type === 'relation' && loadRelationOptions ? relEditOpts : undefined}
                  onRelationSearch={field.type === 'relation' && loadRelationOptions ? setRelEditSearch : undefined}
                  mask={(field.mask as MaskKind | undefined) ?? (field.formatByField ? (field.formatMap?.[String((cell.row.original as Row)[field.formatByField] ?? '')] as MaskKind | undefined) : undefined)}
                  onCommit={(val) => commit({ r, c }, val)}
                  onTab={moveRight}
                  onShiftTab={moveLeft}
                  onEnter={() => moveBy(1, 0)}
                  onEsc={() => setEditMode(false)}
                />
              ) : (
                <div className="min-w-0">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              )}
              {/* borda da celula ativa via overlay (box-shadow no <td> e cortado pelo border-collapse) */}
              {isActive && !isMultiSel && (
                <div className="pointer-events-none absolute inset-0 z-20 ring-2 ring-inset ring-[#2563EB]" />
              )}
              {c === 0 && (
                <div
                  onMouseDown={startRowResize}
                  title="Arraste p/ ajustar a altura das linhas"
                  className="absolute bottom-0 left-0 right-0 h-1.5 z-20 cursor-row-resize bg-transparent opacity-0 transition-opacity hover:bg-[#2563EB]/50 group-hover:opacity-100"
                />
              )}
            </td>
          )
        })}
        {hasRowActions && (
          <td
            style={{ width: ACTIONS_W, right: 0 }}
            className={['sticky right-0 z-10 border-l border-[#E2E8F0] px-2 align-middle', rowBg].join(' ')}
          >
            <div className="flex items-center justify-end gap-1">
              {rowActions!.map((a, i) => {
                const ok = a.enabled ? a.enabled(row.original.id) : true
                if (!ok) return null
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => a.onSelect(row.original.id)}
                    className={cn(
                      'flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                      a.danger
                        ? 'border-[#FECACA] text-[#EF4444] hover:bg-[#FEF2F2]'
                        : 'border-[#E2E8F0] text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB]',
                    )}
                  >
                    <RotateCcw size={12} /> {a.label}
                  </button>
                )
              })}
            </div>
          </td>
        )}
      </TableRow>
    )
  }

  // cabecalho de um grupo (linha colapsavel). Indenta por profundidade e mostra o
  // rótulo do campo daquele nível + o valor + a contagem.
  function renderGroupHeader(n: GroupNode<GRow>) {
    const isCollapsed = collapsed.has(n.path)
    // realce sutil por nível: níveis mais externos com fundo um pouco mais forte.
    const bg = n.depth === 0 ? 'bg-[#F1F5F9]' : 'bg-[#F8FAFC]'
    return (
      <tr key={`g-${n.path}`} className={cn('border-b border-[#E2E8F0]', bg)}>
        <td colSpan={bodyColSpan} className="p-0">
          <div className="sticky left-0 flex w-max items-center gap-2 py-1.5" style={{ paddingLeft: 12 + n.depth * 20, paddingRight: 12 }}>
            <button
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); toggleCollapse(n.path) }}
              className="flex items-center gap-1.5 text-sm font-medium text-[#0F172A]"
            >
              <ChevronRight size={15} className={cn('text-[#64748B] transition-transform', !isCollapsed && 'rotate-90')} />
              <span className="text-xs font-normal text-[#94A3B8]">{n.field.label}:</span>
              {renderDisplay(n.field, n.key === '∅' ? null : n.key, recordsById)}
              <span className="rounded-full bg-[#E2E8F0] px-1.5 text-xs font-semibold text-[#475569]">{n.count}</span>
            </button>
          </div>
        </td>
      </tr>
    )
  }

  // renderiza a árvore de grupos em DFS: cabeçalho de cada nó e, se não colapsado,
  // seus subgrupos (nível seguinte) ou, na folha, as linhas.
  function renderGroupNodes(nodes: GroupNode<GRow>[]): ReactNode[] {
    const out: ReactNode[] = []
    for (const n of nodes) {
      out.push(renderGroupHeader(n))
      if (collapsed.has(n.path)) continue
      if (n.children) out.push(...renderGroupNodes(n.children))
      else out.push(...n.rows.map((row) => renderBodyRow(row, rowIndex.get(row.id) ?? 0)))
    }
    return out
  }

  // ---- exportar CSV / copiar / acoes de linha ----
  function copyText(s: string) {
    navigator.clipboard?.writeText(s).then(() => toast.success('Copiado')).catch(() => {})
  }
  function exportCsv() {
    const n = exportCsvFile(visibleFields, aggRecords, recordsById, 'tabela.csv')
    toast.success(`CSV exportado (${n} linhas)`)
  }
  const addFilterLeaf = (cond: FilterCond) => {
    const root = filterRootRef.current
    commitFilter({ ...root, items: [...root.items, cond] })
    setFilterOpen(true)
  }
  // abre o detalhe do registro (host fornece onRowOpen; senao stub no sandbox)
  const openRow = (id: string) => {
    if (onRowOpen) onRowOpen(id)
    else toast.info('Abrir detalhe , conecte onRowOpen(rowId)')
  }
  const deleteRow = (r: number) => {
    const orig = rows[r]?.original
    const id = orig?.id
    if (!orig || !id) return
    onRowDelete?.(id) // exclusao persistida (host)
    // server mode: remocao otimista da pagina; client mode re-renderiza via `records` do host
    if (serverMode) {
      setServerRows((p) => p.filter((x) => x.id !== id))
      setServerAggRows((p) => p.filter((x) => x.id !== id))
      setServerTotal((t) => Math.max(0, t - 1))
    }
    if (auditOn) pushAudit({ kind: 'delete', label: 'Excluiu linha', row: orig })
    markSaved()
  }
  const duplicateRow = (r: number) => {
    const orig = rows[r]?.original
    if (!orig) return
    const copy = { ...orig, id: `${orig.id}-copy` } as Row
    // so faz sentido otimista no server mode (no client o host e dono dos `records`)
    if (serverMode) {
      setServerRows((p) => { const i = p.findIndex((x) => x.id === orig.id); const n = [...p]; n.splice(i + 1, 0, copy); return n })
      setServerTotal((t) => t + 1)
    }
    if (auditOn) pushAudit({ kind: 'duplicate', label: 'Duplicou linha', row: copy })
    markSaved()
  }

  function buildCellMenu(r: number, c: number): MenuEntry[] {
    const colId = orderedCols[c]?.id
    const field = fields.find((f) => f.id === colId)
    const row = rows[r]
    const value = colId ? row?.original[colId] : undefined
    const editable = isEditableCol(c)
    const text = field ? cellToText(field, value, recordsById) : String(value ?? '')
    const filterVal = Array.isArray(value) ? String((value as unknown[])[0] ?? '') : String(value ?? '')

    // ---- selecao de MULTIPLAS celulas: acoes em massa ----
    if (isMultiSel && rng) {
      const editaveis = rangeCells().filter((cc) => isEditableField(cc.field)).length
      const singleCol = rng.minC === rng.maxC
      const activeVal = active ? orderedRows[active.r]?.original[orderedCols[active.c]?.id ?? ''] : undefined
      const topVal = (cell: { colId: string }) => orderedRows[rng.minR]?.original[cell.colId]
      const bulk: MenuEntry[] = [
        { icon: <Copy size={15} />, label: 'Copiar como CSV', onSelect: () => copyRangeCsv() },
        { icon: <Eraser size={15} />, label: `Limpar valores (${editaveis})`, disabled: editaveis === 0, onSelect: () => bulkApply(() => null) },
        { icon: <ArrowDownAZ size={15} />, label: 'Preencher abaixo', disabled: editaveis === 0, onSelect: () => bulkApply((cell) => topVal(cell)) },
      ]
      if (singleCol) bulk.push({ icon: <Check size={15} />, label: 'Aplicar valor da célula ativa', disabled: editaveis === 0, onSelect: () => bulkApply(() => activeVal) })
      bulk.push(null,
        { icon: <ArrowUpAZ size={15} />, label: 'Ordenar crescente', onSelect: () => colId && setSorting([{ id: colId, desc: false }]) },
        { icon: <ArrowDownAZ size={15} />, label: 'Ordenar decrescente', onSelect: () => colId && setSorting([{ id: colId, desc: true }]) },
        { icon: <EyeOff size={15} />, label: 'Ocultar coluna', onSelect: () => colId && toggleField(colId) },
      )
      return bulk
    }

    const items: MenuEntry[] = [
      { icon: <ExternalLink size={15} />, label: 'Abrir registro', onSelect: () => row && openRow(row.id) },
      { icon: <Pencil size={15} />, label: 'Editar célula', disabled: !editable, onSelect: () => selectCell(r, c, true) },
      { icon: <Copy size={15} />, label: 'Copiar valor', onSelect: () => copyText(text) },
      { icon: <Copy size={15} />, label: 'Copiar como CSV', onSelect: () => copyRangeCsv() },
      { icon: <Eraser size={15} />, label: 'Limpar valor', disabled: !editable, onSelect: () => commit({ r, c }, null) },
      null,
      { icon: <ListFilter size={15} />, label: 'Filtrar por este valor', onSelect: () => colId && addFilterLeaf({ fieldId: colId, op: field && ['multiselect', 'relation'].includes(field.type) ? 'tem' : '=', value: filterVal }) },
      { icon: <ArrowUpAZ size={15} />, label: 'Ordenar crescente', onSelect: () => colId && setSorting([{ id: colId, desc: false }]) },
      { icon: <ArrowDownAZ size={15} />, label: 'Ordenar decrescente', onSelect: () => colId && setSorting([{ id: colId, desc: true }]) },
      { icon: <Layers size={15} />, label: 'Agrupar por este campo', onSelect: () => { if (colId) { setGroupBy((prev) => (prev.includes(colId) ? prev : [...prev, colId])); setCollapsed(new Set()) } } },
      { icon: <EyeOff size={15} />, label: 'Ocultar coluna', onSelect: () => colId && toggleField(colId) },
    ]
    if (field?.type === 'url' && value) items.push(null, { icon: <ExternalLink size={15} />, label: 'Abrir link', onSelect: () => window.open(String(value), '_blank') }, { icon: <Copy size={15} />, label: 'Copiar URL', onSelect: () => copyText(String(value)) })
    if (field?.type === 'date') items.push(null, { icon: <CalendarClock size={15} />, label: 'Definir hoje', disabled: !editable, onSelect: () => commit({ r, c }, new Date().toISOString().slice(0, 10)) })
    if (field?.type === 'person') items.push(null, { icon: <UserPlus size={15} />, label: 'Atribuir a mim', disabled: !editable, onSelect: () => commit({ r, c }, field.options?.[0]?.value ?? 'andre') })
    if (field?.type === 'relation') {
      const linkedId = Array.isArray(value) ? String((value as unknown[])[0] ?? '') : String(value ?? '')
      const linkedName = linkedId ? String(recordsById.get(linkedId)?.nome ?? linkedId) : ''
      if (linkedId) items.push(null, { icon: <ExternalLink size={15} />, label: `Abrir ${linkedName}`, onSelect: () => openRow(linkedId) })
    }
    if (field?.type === 'file') items.push(null, { icon: <ExternalLink size={15} />, label: 'Gerenciar arquivos', onSelect: () => selectCell(r, c, true) })
    return items
  }

  function buildRowMenu(r: number): MenuEntry[] {
    const row = rows[r]
    const id = row?.id
    const firstEditable = Math.max(0, orderedCols.findIndex((_, i) => isEditableCol(i)))
    const canDelete = !!onRowDelete || SCHEMA_PERMS.canDelete // host (persistido) ou permissao
    return [
      { icon: <ExternalLink size={15} />, label: 'Abrir registro', onSelect: () => id && openRow(id) },
      { icon: <Pencil size={15} />, label: 'Editar', onSelect: () => selectCell(r, firstEditable, true) },
      null,
      {
        icon: <Check size={15} />,
        label: id && selected.has(id) ? 'Desmarcar linha' : 'Selecionar linha',
        onSelect: () => { if (!id) return; setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n }) },
      },
      { icon: <Copy size={15} />, label: 'Copiar linha', onSelect: () => row && copyText(visibleFields.map((f) => cellToText(f, row.original[f.id], recordsById)).join('\t')) },
      null,
      { icon: <Plus size={15} />, label: 'Duplicar linha', disabled: !SCHEMA_PERMS.canCreate, hint: SCHEMA_PERMS.canCreate ? undefined : 'sem permissão', onSelect: () => duplicateRow(r) },
      { icon: <TrashIcon size={15} />, label: 'Excluir linha', danger: true, disabled: !canDelete, hint: canDelete ? undefined : 'sem permissão', onSelect: () => deleteRow(r) },
      ...(rowActions?.length && id
        ? [null as MenuEntry, ...rowActions.map((a): MenuEntry => ({
            icon: <RotateCcw size={15} />,
            label: a.label,
            danger: a.danger,
            disabled: a.enabled ? !a.enabled(id) : false,
            onSelect: () => a.onSelect(id),
          }))]
        : []),
    ]
  }

  // ---- views / filtros salvos (privado ou geral) ----
  const captureView = (): ViewPayload => ({ visibleFieldIds: visibleIds, columnOrder, columnSizing, frozenCount, pageSize, sorting, groupBy, filter: filterRoot, aggs })
  // baseline p/ detectar mudanças não salvas (dirty). Não inclui dados/seleção/página.
  const viewBaselineRef = useRef<ViewPayload | null>(null)
  if (viewBaselineRef.current === null) viewBaselineRef.current = captureView()
  // pristine = snapshot do 1º render (a "View Padrão" p/ onde o usuário volta)
  const pristineRef = useRef<ViewPayload | null>(null)
  if (pristineRef.current === null) pristineRef.current = captureView()
  const viewDirty = !deepEqual(captureView(), viewBaselineRef.current)
  // restaura um snapshot (layout de grid + filtro + agrupamento) e fixa o baseline
  const restoreView = (p: ViewPayload) => {
    onConfigChange({ visibleFieldIds: p.visibleFieldIds })
    setColumnOrder(p.columnOrder ?? [])
    setColumnSizing(p.columnSizing ?? {})
    setFrozenCount(p.frozenCount ?? 0)
    setPageSize(p.pageSize ?? 25)
    setSorting(p.sorting ?? [])
    setGroupBy(normGroupBy(p.groupBy))
    setCollapsed(new Set())
    setFilterRoot(p.filter ?? { conj: 'and', items: [] })
    setAggs(p.aggs ?? {})
    setPageIndex(0)
    viewBaselineRef.current = {
      visibleFieldIds: p.visibleFieldIds,
      columnOrder: p.columnOrder ?? [],
      columnSizing: p.columnSizing ?? {},
      frozenCount: p.frozenCount ?? 0,
      pageSize: p.pageSize ?? 25,
      sorting: p.sorting ?? [],
      groupBy: normGroupBy(p.groupBy),
      filter: p.filter ?? { conj: 'and', items: [] },
      aggs: p.aggs ?? {},
    }
  }
  const applyView = (p: ViewPayload, meta: { id: string; name: string }) => { restoreView(p); setAppliedView(meta) }
  // volta ao pristine (a "View Padrão")
  const applyDefault = () => { if (pristineRef.current) restoreView(pristineRef.current); setAppliedView(null) }
  const scopeMsg = (s: Scope) => (s === 'public' ? 'pública' : s === 'shared' ? 'compartilhada' : 'privada')
  const onSaveView = (name: string, scope: Scope, sharedWith: string[] | undefined, editingId: string | null) => {
    if (editingId) {
      setSavedViews(updateSaved<ViewPayload>(VIEWS_KEY, editingId, { name, scope, sharedWith }))
    } else {
      const id = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
      setSavedViews(addSaved<ViewPayload>(VIEWS_KEY, { id, name, scope, sharedWith, payload: captureView() }))
      setAppliedView({ id, name })
      viewBaselineRef.current = captureView()
    }
    toast.success(`View salva (${scopeMsg(scope)})`)
  }
  const onUpdateView = () => {
    if (!appliedView) return
    setSavedViews(updateSaved<ViewPayload>(VIEWS_KEY, appliedView.id, { payload: captureView() }))
    viewBaselineRef.current = captureView()
    toast.success('View atualizada')
  }
  // ---- view padrão do usuário (estrela): auto-aplica ao entrar, por tipo de view ----
  const [defaultViewId, setDefaultViewIdState] = useState<string | null>(() => getDefaultView(viewKey))
  const setDefaultViewId = (id: string | null) => {
    setDefaultViewIdState(id)
    saveDefaultView(viewKey, id)
    if (id) { const it = savedViews.find((v) => v.id === id); if (it) applyView(it.payload, { id: it.id, name: it.name }) }
    else applyDefault()
  }
  const onDeleteView = (id: string) => {
    setSavedViews(removeSaved<ViewPayload>(VIEWS_KEY, id))
    if (appliedView?.id === id) setAppliedView(null)
    if (defaultViewId === id) { setDefaultViewIdState(null); saveDefaultView(viewKey, null) }
  }
  // ao montar: se há uma view padrão salva p/ este tipo de view (não em modo enxuto), aplica-a
  const didInitDefault = useRef(false)
  useEffect(() => {
    if (didInitDefault.current || minimal) return
    didInitDefault.current = true
    if (defaultViewId) { const it = savedViews.find((v) => v.id === defaultViewId); if (it) applyView(it.payload, { id: it.id, name: it.name }) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const onSaveFilter = (name: string, scope: Scope, sharedWith: string[] | undefined, editingId: string | null) => {
    if (editingId) setSavedFilters(updateSaved<FilterGroup>(FILTERS_KEY, editingId, { name, scope, sharedWith }))
    else setSavedFilters(addSaved<FilterGroup>(FILTERS_KEY, { id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`, name, scope, sharedWith, payload: filterRoot }))
    toast.success(`Filtro salvo (${scopeMsg(scope)})`)
  }

  // modo server: enquanto busca a 1ª página, mostra skeleton (evita o "blink")
  if (serverMode && loading && serverRows.length === 0) {
    return <ViewSkeleton variant="table" />
  }

  return (
    <LightboxProvider>
    <div className="relative flex flex-col h-full min-h-0 w-full overflow-hidden">
      <style>{`
.lab-scroll{scrollbar-width:thin;scrollbar-color:#CBD5E1 transparent}
.lab-scroll::-webkit-scrollbar{height:9px;width:9px}
.lab-scroll::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:9999px}
.lab-scroll::-webkit-scrollbar-thumb:hover{background:#94A3B8}
.lab-scroll::-webkit-scrollbar-track{background:transparent}
.lab-scroll::-webkit-scrollbar-corner{background:transparent}
`}</style>
      {/* Header (toolbar) , botoes em icone que expandem o texto no hover/ativo */}
      <div className="border-b border-[#E2E8F0] bg-white px-3 h-11 flex items-center gap-1.5 shrink-0">
        <HeaderBtn icon={<Columns3 size={15} />} label="Campos" active={configOpen} onClick={() => setConfigOpen((o) => !o)} />
        {!minimal && (
          <HeaderBtn
            icon={<Layers size={15} />}
            label={groupFields.length ? `Agrupar: ${groupFields.map((f) => f.label).join(' › ')}` : 'Agrupar'}
            active={groupBy.length > 0}
            onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setGroupMenu({ x: r.left, y: r.bottom + 2 }) }}
          />
        )}
        <HeaderBtn icon={<Filter size={15} />} label="Filtros" active={filterCount > 0} badge={filterCount} onClick={() => setFilterOpen((o) => !o)} />
        <HeaderBtn icon={<Download size={15} />} label="Exportar" onClick={exportCsv} />
        {!minimal && (
          <HeaderBtn
            icon={<Bookmark size={15} />}
            label={appliedView?.name ?? 'Views'}
            active={!!appliedView}
            dot={viewDirty}
            onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setViewsMenu({ x: r.left, y: r.bottom + 2 }) }}
          />
        )}

        {groupBy.length > 0 && (
          <>
            <button
              onClick={() => setGroupDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
              className="flex h-7 items-center rounded-md border border-[#E2E8F0] px-2 text-xs font-medium text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB]"
              title="Direção do agrupamento (todos os níveis)"
            >
              {groupDir === 'asc' ? 'A → Z' : 'Z → A'}
            </button>
            <button onClick={() => { setGroupBy([]); setCollapsed(new Set()) }} className="flex size-7 items-center justify-center rounded-md text-[#94A3B8] hover:text-[#EF4444]" title="Remover agrupamento">
              <X size={14} />
            </button>
          </>
        )}

        {selected.size > 0 && (
          <span className="flex items-center gap-2 text-xs text-[#2563EB]">
            <span>{selected.size} selecionada(s)</span>
            {allSelected && selected.size < effectiveTotal && (
              <button onClick={selectAllAcross} className="font-bold underline underline-offset-2 hover:text-[#1D4ED8]">
                Deseja selecionar todos os {effectiveTotal} registros?
              </button>
            )}
            {effectiveTotal > 0 && selected.size >= effectiveTotal && (
              <button onClick={() => setSelected(new Set())} className="text-[#64748B] underline underline-offset-2 hover:text-[#475569]">Limpar seleção</button>
            )}
          </span>
        )}

        {/* paginacao minimalista (server ou client) , canto direito */}
        {(() => {
          const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize))
          const from = effectiveTotal === 0 ? 0 : pageIndex * pageSize + 1
          const to = Math.min(effectiveTotal, (pageIndex + 1) * pageSize)
          const btn = 'flex size-7 items-center justify-center rounded-md border border-[#E2E8F0] text-[#64748B] disabled:opacity-30 enabled:hover:border-[#2563EB] enabled:hover:text-[#2563EB]'
          return (
            <div className="ml-auto flex items-center gap-1 text-xs text-[#94A3B8]">
              {loading && <span className="mr-1 size-3 animate-spin rounded-full border-2 border-[#CBD5E1] border-t-[#2563EB]" />}
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPageIndex(0) }}
                className="mr-1 rounded border border-[#E2E8F0] bg-white px-1 py-0.5 text-[11px] text-[#475569] outline-none focus:border-[#2563EB]"
                title="Itens por página"
              >
                {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}/pág</option>)}
              </select>
              <span className="tabular-nums">{from}-{to} de {effectiveTotal}</span>
              <button className={btn} title="Primeira" disabled={pageIndex === 0} onClick={() => setPageIndex(0)}><ChevronsLeft size={15} /></button>
              <button className={btn} title="Anterior" disabled={pageIndex === 0} onClick={() => setPageIndex((p) => Math.max(0, p - 1))}><ChevronLeft size={15} /></button>
              <button className={btn} title="Próxima" disabled={pageIndex >= totalPages - 1} onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}><ChevronRight size={15} /></button>
              <button className={btn} title="Última" disabled={pageIndex >= totalPages - 1} onClick={() => setPageIndex(totalPages - 1)}><ChevronsRight size={15} /></button>
            </div>
          )
        })()}

        {/* indicador de autosave: com auditoria vira nuvem com historico; senao so o icone */}
        {auditOn ? (
          <AuditCloud
            saved={saved}
            entries={auditLog}
            canRevert={canRevert}
            onRevert={applyRevert}
            fieldLabel={fieldLabel}
            renderGrid={renderLogGrid}
            gridWidth={LOG_GRID_WIDTH}
          />
        ) : minimal ? null : (
          <span
            title={saved ? 'Alterações salvas' : 'Tudo salvo'}
            className="flex size-7 items-center justify-center"
          >
            <Cloud size={16} className={cn('transition-colors duration-300', saved ? 'animate-pulse text-[#10B981]' : 'text-[#CBD5E1]')} />
          </span>
        )}
      </div>


      {/* Painel de filtros */}
      {filterOpen && (
        <>
          <div className="absolute inset-0 z-40" onMouseDown={() => setFilterOpen(false)} />
          <div className="absolute left-2 top-[46px] z-50">
            <FilterPanel
              fields={fields}
              value={filterRoot}
              onChange={commitFilter}
              recordOptions={recordOptions}
              headerRight={
                <button
                  onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSavedFiltersMenu({ x: r.right - 180, y: r.bottom + 2 }) }}
                  className="flex items-center gap-1 rounded-md border border-[#E2E8F0] px-2 py-1 text-xs text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB]"
                >
                  Filtros salvos{savedFilters.length ? ` (${savedFilters.length})` : ''} <ChevronDown size={13} />
                </button>
              }
            />
          </div>
        </>
      )}

      {/* Drawer de campos */}
      {configOpen && (
        <FieldsPanel
          toggleableFields={toggleableFields}
          visibleIds={visibleIds}
          onToggle={toggleField}
          onClose={() => setConfigOpen(false)}
        />
      )}

      {/* Tabela: 1 unico container de scroll (x + y), preso ao viewport */}
      <div className="flex-1 min-h-0 overflow-auto lab-scroll">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table
            className="caption-bottom text-sm border-separate border-spacing-0"
            style={{ width: table.getTotalSize() + GUTTER + (hasRowActions ? ACTIONS_W : 0) + (showAddField ? ADD_FIELD_W : 0), tableLayout: 'fixed', height: '100%' }}
          >
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="sticky top-0 z-20 bg-[#F8FAFC] hover:bg-[#F8FAFC]">
                  {/* gutter: checkbox selecionar tudo (congelado topo+esquerda) */}
                  <th
                    style={{ width: GUTTER, left: 0 }}
                    className="sticky left-0 z-30 h-10 border-b border-[#E2E8F0] bg-[#F8FAFC] px-0 align-middle"
                  >
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(el) => { if (el) el.indeterminate = someSelected }}
                        onChange={toggleAll}
                        className="size-3.5 cursor-pointer accent-[#2563EB]"
                        title="Selecionar todas"
                      />
                    </div>
                  </th>
                  <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                    {hg.headers.map((header, c) => (
                      <DraggableHeader
                        key={header.id}
                        header={header}
                        frozen={c < frozenCount}
                        left={colLeft(c)}
                        onToggleFreeze={() => toggleFreeze(c)}
                        onOpenMenu={(x, y) => setColMenu({ colId: header.column.id, index: c, x, y })}
                        onRename={onFieldUpdate ? (name) => onFieldUpdate(header.column.id, { name }) : undefined}
                        selected={active?.r === -1 && active.c === c && !editMode}
                        selectedRef={activeHeaderRef}
                        onKeyDown={onCellKeyDown}
                      />
                    ))}
                  </SortableContext>
                  {/* affordance "+" no fim do cabecalho: abre o popover de novo campo */}
                  {showAddField && (
                    <th
                      style={{ width: ADD_FIELD_W }}
                      className="h-10 border-b border-[#E2E8F0] bg-[#F8FAFC] px-0 align-middle"
                    >
                      <button
                        type="button"
                        title="Novo campo"
                        onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setNewFieldAt({ x: r.left - 120, y: r.bottom + 4 }) }}
                        className="flex size-full items-center justify-center text-[#94A3B8] hover:text-[#2563EB]"
                      >
                        <Plus size={15} />
                      </button>
                    </th>
                  )}
                  {hasRowActions && (
                    <th
                      style={{ width: ACTIONS_W, right: 0 }}
                      className="sticky right-0 z-30 h-10 border-b border-l border-[#E2E8F0] bg-[#F8FAFC]"
                    />
                  )}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {numRows === 0 ? (
                <TableRow>
                  <TableCell colSpan={bodyColSpan} className="text-center text-[#94A3B8] py-16 text-sm">
                    Nenhum registro encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                groups ? (
                  renderGroupNodes(groups)
                ) : (
                  orderedRows.map((row, r) => renderBodyRow(row, r))
                )
              )}
              {/* filler: empurra o rodape p/ o fundo qdo ha poucas linhas */}
              {numRows > 0 && (
                <tr aria-hidden className="h-full">
                  <td colSpan={bodyColSpan} className="p-0 border-0" />
                </tr>
              )}
            </TableBody>
            {/* rodape totalizador, fixo no fundo, rola junto na horizontal */}
            <tfoot>
              <tr className="sticky bottom-0 z-20">
                {/* gutter do rodape (congelado fundo+esquerda) */}
                <td style={{ width: GUTTER, left: 0 }} className="sticky left-0 z-30 h-9 border-t border-[#E2E8F0] bg-white px-0" />
                {orderedCols.map((col, c) => {
                  const field = visibleFields.find((f) => f.id === col.id)
                  const align = field && (field.type === 'currency' || field.type === 'number' || field.type === 'percent') ? 'right' : 'left'
                  const frozen = c < frozenCount
                  return (
                    <td
                      key={col.id}
                      style={{ width: col.getSize(), ...(frozen ? { position: 'sticky', left: colLeft(c), zIndex: 25 } : {}) }}
                      className="h-9 border-t border-[#E2E8F0] bg-white px-2 align-middle"
                    >
                      {c === 0 ? (
                        <span className="px-1 text-xs font-medium text-[#94A3B8]">{effectiveTotal} registros</span>
                      ) : field ? (
                        <AggFooterCell
                          field={field}
                          records={aggRecords}
                          recordsById={recordsById}
                          agg={getAgg(field)}
                          onAggChange={(fn) => setAgg(field.id, fn)}
                          align={align}
                          onFilter={addFilterValue}
                          aggregate={serverMode ? serverAggregates[field.id] : undefined}
                        />
                      ) : null}
                    </td>
                  )
                })}
                {hasRowActions && (
                  <td style={{ width: ACTIONS_W, right: 0 }} className="sticky right-0 z-30 h-9 border-t border-l border-[#E2E8F0] bg-white" />
                )}
              </tr>
            </tfoot>
          </table>
        </DndContext>
      </div>

      {/* menu de contexto da coluna */}
      {colMenu && (
        <ContextMenu
          x={colMenu.x}
          y={colMenu.y}
          items={buildColMenu(colMenu.colId, colMenu.index, colMenu.x, colMenu.y)}
          onClose={() => setColMenu(null)}
        />
      )}

      {/* popover: editar campo (nome + tipo + config type-específica) */}
      {fieldEdit && editingCol && (
        <FieldSchemaPopover
          x={fieldEdit.x}
          y={fieldEdit.y}
          mode="edit"
          initialName={editingCol.label}
          initialType={editingCol.type}
          initialOptions={editingCol.options ?? []}
          initialRelEntityId={editingCol.relationEntityId ?? ''}
          initialLabelFieldId={editingCol.labelFieldId ?? ''}
          initialMultiple={!!editingCol.multiple}
          initialViaFieldId={editingCol.viaFieldId ?? ''}
          initialLookupFieldId={editingCol.lookupFieldId ?? ''}
          initialMaxRating={editingCol.maxRating ?? 5}
          initialCurrencyCode={editingCol.currency ?? 'BRL'}
          initialRequired={editingCol.required ?? false}
          initialDefault={editingCol.defaultValue ?? ''}
          entities={entityList}
          thisFields={fields}
          loadEntityFields={loadEntityFields}
          loadDefaultOptions={
            loadRelationOptions ? (s) => loadRelationOptions(editingCol.id, s) : undefined
          }
          onSave={saveFieldEdit}
          onClose={() => setFieldEdit(null)}
        />
      )}

      {/* popover: novo campo (nome + tipo + config type-específica) */}
      {newFieldAt && (
        <FieldSchemaPopover
          x={newFieldAt.x}
          y={newFieldAt.y}
          mode="add"
          entities={entityList}
          thisFields={fields}
          loadEntityFields={loadEntityFields}
          onSave={(out) => {
            onFieldAdd?.({
              name: out.name,
              type: out.type,
              ...(out.options ? { options: out.options } : {}),
              ...(out.relationshipEntityId ? { relationshipEntityId: out.relationshipEntityId } : {}),
              ...(out.labelFieldId ? { labelFieldId: out.labelFieldId } : {}),
              ...(out.multiple ? { multiple: out.multiple } : {}),
              ...(out.viaFieldId ? { viaFieldId: out.viaFieldId } : {}),
              ...(out.lookupFieldId ? { lookupFieldId: out.lookupFieldId } : {}),
              ...(out.maxRating !== undefined ? { maxRating: out.maxRating } : {}),
              ...(out.currencyCode ? { currencyCode: out.currencyCode } : {}),
              ...(out.required !== undefined ? { required: out.required } : {}),
              ...(out.defaultValue ? { defaultValue: out.defaultValue } : {}),
            })
            setNewFieldAt(null)
          }}
          onClose={() => setNewFieldAt(null)}
        />
      )}

      {/* menu de contexto da celula */}
      {cellMenu && (
        <ContextMenu x={cellMenu.x} y={cellMenu.y} items={buildCellMenu(cellMenu.r, cellMenu.c)} onClose={() => setCellMenu(null)} />
      )}

      {/* menu de contexto da linha */}
      {rowMenu && (
        <ContextMenu x={rowMenu.x} y={rowMenu.y} items={buildRowMenu(rowMenu.r)} onClose={() => setRowMenu(null)} />
      )}

      {/* dropdowns de views / filtros salvos (lista + editar/excluir + salvar inline) */}
      {viewsMenu && (
        <SavedMenu
          x={viewsMenu.x}
          y={viewsMenu.y}
          title="Views salvas"
          items={savedViews}
          users={userOptions}
          onApply={(it) => applyView(it.payload, { id: it.id, name: it.name })}
          onSave={onSaveView}
          onDelete={onDeleteView}
          onClose={() => setViewsMenu(null)}
          dirty={viewDirty}
          appliedName={appliedView?.name ?? null}
          onUpdate={onUpdateView}
          defaults={{
            currentId: defaultViewId,
            onApplyPristine: applyDefault,
            onStar: setDefaultViewId,
          }}
        />
      )}
      {savedFiltersMenu && (
        <SavedMenu
          x={savedFiltersMenu.x}
          y={savedFiltersMenu.y}
          title="Filtros salvos"
          items={savedFilters}
          users={userOptions}
          onApply={(it) => { setFilterRoot(it.payload); setPageIndex(0) }}
          onSave={onSaveFilter}
          onDelete={(id) => setSavedFilters(removeSaved<FilterGroup>(FILTERS_KEY, id))}
          onClose={() => setSavedFiltersMenu(null)}
        />
      )}

      {/* menu: escolher campo(s) p/ agrupar (multi-nível). Clicar adiciona/remove um
          nível; a ordem de clique define o aninhamento. O menu fica aberto (keepOpen)
          p/ escolher vários; o badge numerado mostra a ordem dos níveis. */}
      {groupMenu && (
        <ContextMenu
          x={groupMenu.x}
          y={groupMenu.y}
          onClose={() => setGroupMenu(null)}
          items={[
            { icon: <Layers size={15} />, label: 'Não agrupar', disabled: !groupBy.length, onSelect: () => { setGroupBy([]); setCollapsed(new Set()) } },
            null,
            ...fields
              .filter((f) => !['id', 'image', 'file'].includes(f.type))
              .map((f) => {
                const idx = groupBy.indexOf(f.id)
                return {
                  label: f.label,
                  keepOpen: true,
                  icon: idx >= 0 ? (
                    <span className="flex size-[15px] items-center justify-center rounded bg-[#2563EB] text-[10px] font-bold text-white">{idx + 1}</span>
                  ) : (
                    <span className="size-[15px]" />
                  ),
                  onSelect: () => {
                    setGroupBy((prev) => (idx >= 0 ? prev.filter((x) => x !== f.id) : [...prev, f.id]))
                    setCollapsed(new Set())
                  },
                }
              }),
          ]}
        />
      )}

      {/* confirmacao do Ctrl+Z (reverter dado): "Não" foco/forte a direita, "Tenho certeza" a esquerda */}
      {confirmUndo && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onMouseDown={cancelUndo}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-[420px] max-w-[92vw] rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Escape') cancelUndo() }}
          >
            <h3 className="text-base font-semibold text-[#0F172A]">Reverter alteração?</h3>
            <p className="mt-1.5 text-sm text-[#64748B]">
              Isto reaplica o estado anterior de <span className="font-medium text-[#334155]">{confirmUndo.label}</span> como uma nova operação (fica registrada nos logs). A alteração original não é apagada.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={confirmUndoNow}
                className="rounded-md border border-[#E2E8F0] px-3 py-1.5 text-sm font-medium text-[#475569] hover:bg-[#F1F5F9]"
              >
                Tenho certeza
              </button>
              <button
                ref={undoNoBtnRef}
                onClick={cancelUndo}
                className="rounded-md bg-[#2563EB] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2"
              >
                Não
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </LightboxProvider>
  )
}
