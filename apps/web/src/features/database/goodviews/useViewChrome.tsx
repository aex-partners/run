/**
 * Chrome compartilhado das views (modo cliente): filtro + campos visíveis +
 * paginação + views/filtros salvos + export CSV + auditoria/undo (nuvem de logs)
 * + agregações de rodapé. Extraído da TableView p/ que List/Kanban/Gallery/etc
 * herdem a mesma toolbar/footer. Devolve um objeto `chrome` que alimenta
 * <ViewToolbar/> e <ViewFooter/>, e expõe `records` (página atual) p/ a view.
 */
import { lazy, Suspense, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Check, Copy, ExternalLink, EyeOff, ListFilter, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { filterRows, type FilterGroup } from './server'
import { addSaved, deepEqual, FILTERS_KEY, getDefaultView, loadSaved, removeSaved, saveDefaultView, updateSaved, VIEWS_KEY, type Saved, type Scope } from './storage'
import { ViewKeyContext } from './viewKeyContext'
import { cellToText, exportCsv } from './csv'
import { countFilterLeaves } from './components/FilterPanel'
import { defaultAgg, type AggFn } from './components/AggFooterCell'
import { type MenuEntry } from './components/ContextMenu'
import { isGroup } from './server'
import type { AuditAdapter, AuditCell, AuditEntry, Field, Row, RowAction, ViewConfig } from './types'

// TableView renderiza o grid de logs (modo enxuto). lazy p/ não puxar no 1º paint.
const TableView = lazy(() => import('./views/TableView'))

export const PAGE_SIZES = [10, 25, 50, 100]

// schema do grid de LOGS (o histórico renderiza usando a própria TableView)
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
const LOG_GRID_WIDTH = 980
function fmtLogVal(v: unknown): string {
  if (v == null || v === '') return '∅'
  if (Array.isArray(v)) return v.length ? v.map(String).join(', ') : '∅'
  return String(v)
}

export interface ChromeViewPayload {
  visibleFieldIds: string[]
  filter: FilterGroup
  /** papéis da view (groupBy, coverImage, xField...) , parte do "layout". */
  roles?: Record<string, string | null>
  /** settings livres da view (chartType, cardLayout, cardWidth, timescale...). */
  extra?: Record<string, unknown>
  /** campos agregados no rodapé. */
  footerIds?: string[]
  /** função de agregação por campo do rodapé. */
  aggs?: Record<string, AggFn>
  /** agrupamento (campo + direção). */
  groupBy?: string | null
  groupDir?: 'asc' | 'desc'
}

const newId = () => `${Date.now()}-${Math.round(Math.random() * 1e6)}`
const scopeMsg = (s: Scope) => (s === 'public' ? 'pública' : s === 'shared' ? 'compartilhada' : 'privada')

export function useViewChrome({
  records,
  fields,
  config,
  onConfigChange,
  onEdit,
  onRowOpen,
  onRowDelete,
  rowActions,
  audit,
  defaultVisible,
  csvName = 'dados.csv',
}: {
  records: Row[]
  fields: Field[]
  config: ViewConfig
  onConfigChange: (patch: Partial<ViewConfig>) => void
  onEdit?: (rowId: string, fieldId: string, value: unknown) => void
  onRowOpen?: (rowId: string) => void
  onRowDelete?: (rowId: string) => void
  rowActions?: RowAction[]
  audit?: AuditAdapter
  defaultVisible?: string[]
  csvName?: string
}) {
  const auditOn = !!audit?.enabled
  const auditUser = audit?.currentUser ?? 'você'
  // tipo da view ativa (table/kanban/...) p/ escopar a view padrão do usuário
  const viewKey = useContext(ViewKeyContext)

  const [filterRoot, setFilterRootState] = useState<FilterGroup>({ conj: 'and', items: [] })
  const [savedViews, setSavedViews] = useState<Saved<ChromeViewPayload>[]>(() => loadSaved<ChromeViewPayload>(VIEWS_KEY))
  const [savedFilters, setSavedFilters] = useState<Saved<FilterGroup>[]>(() => loadSaved<FilterGroup>(FILTERS_KEY))
  const [appliedView, setAppliedView] = useState<{ id: string; name: string } | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [aggs, setAggs] = useState<Record<string, AggFn>>({})
  // campos escolhidos p/ o rodapé (independente da visibilidade na linha).
  // default minimal: só moeda (soma de valor faz sentido); o usuário liga o resto na aba Campos.
  const defaultFooterIds = useMemo(() => fields.filter((f) => f.type === 'currency').map((f) => f.id), [fields])
  const [footerIds, setFooterIds] = useState<string[]>(() => fields.filter((f) => f.type === 'currency').map((f) => f.id))
  const toggleFooter = (id: string) => setFooterIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const removeFooter = (id: string) => setFooterIds((prev) => prev.filter((x) => x !== id))
  // move `fromId` p/ antes de `toId` (toId null = pro fim)
  const reorderFooter = (fromId: string, toId: string | null) => setFooterIds((prev) => {
    if (fromId === toId) return prev
    const a = prev.filter((x) => x !== fromId)
    if (toId == null) a.push(fromId)
    else { const ti = a.indexOf(toId); if (ti < 0) a.push(fromId); else a.splice(ti, 0, fromId) }
    return a
  })
  // selecao de linhas (checkbox + select-all + shift-range)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const lastClickedRef = useRef<number | null>(null)
  // agrupamento por campo
  const [groupBy, setGroupBy] = useState<string | null>(null)
  const [groupDir, setGroupDir] = useState<'asc' | 'desc'>('asc')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggleCollapse = (k: string) => setCollapsed((prev) => {
    const n = new Set(prev)
    if (n.has(k)) n.delete(k); else n.add(k)
    return n
  })

  // ---- auditoria + Ctrl+Z (modo cliente) ----
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [saved, setSaved] = useState(false)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const auditSeq = useRef(0)
  const undoRef = useRef<({ type: 'audit'; entry: AuditEntry } | { type: 'filter'; prev: FilterGroup })[]>([])
  const revertedRef = useRef<Set<string>>(new Set())
  const filterRootRef = useRef(filterRoot)
  filterRootRef.current = filterRoot
  const [confirmUndo, setConfirmUndo] = useState<AuditEntry | null>(null)
  const confirmUndoRef = useRef<AuditEntry | null>(null)
  confirmUndoRef.current = confirmUndo
  const undoNoBtnRef = useRef<HTMLButtonElement>(null)
  const applyRevertRef = useRef<(e: AuditEntry) => void>(() => {})

  useEffect(() => {
    if (!audit?.list) return
    Promise.resolve(audit.list()).then(setAuditLog)
  }, [audit])

  const visibleIds = config.visibleFieldIds?.length
    ? config.visibleFieldIds
    : (defaultVisible ?? fields.filter((f) => f.type !== 'id').map((f) => f.id))

  const toggleableFields = useMemo(() => fields.filter((f) => f.type !== 'id'), [fields])
  const visibleFields = useMemo(() => visibleIds.flatMap((id) => fields.find((f) => f.id === id) ?? []), [visibleIds, fields])
  const footerFields = useMemo(() => footerIds.flatMap((id) => fields.find((f) => f.id === id) ?? []), [footerIds, fields])
  const recordsById = useMemo(() => {
    const m = new Map<string, Row>()
    for (const r of records) m.set(r.id, r)
    return m
  }, [records])
  const recordOptions = useMemo(() => records.map((r) => ({ value: r.id, label: String(r.nome ?? r.id) })), [records])
  const userOptions = useMemo(() => (fields.find((f) => f.type === 'person')?.options ?? []).map((o) => ({ value: o.value, label: o.label })), [fields])

  const filtered = useMemo(() => filterRows(records, filterRoot), [records, filterRoot])
  const total = filtered.length
  const filterCount = countFilterLeaves(filterRoot)

  // clampa a página quando o conjunto filtrado encolhe
  useEffect(() => {
    const last = Math.max(0, Math.ceil(total / pageSize) - 1)
    if (pageIndex > last) setPageIndex(last)
  }, [total, pageSize, pageIndex])
  const page = useMemo(() => filtered.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize), [filtered, pageIndex, pageSize])

  // ---- agrupamento (sobre a página atual, igual à Table no modo cliente) ----
  const groupableFields = useMemo(() => fields.filter((f) => !['id', 'image', 'file'].includes(f.type)), [fields])
  const groupField = groupBy ? fields.find((f) => f.id === groupBy) : undefined
  const groupLabelOf = (k: string): string => {
    if (k === '∅') return '(vazio)'
    const opt = groupField?.options?.find((o) => o.value === k)
    if (opt) return opt.label
    const rec = recordsById.get(k)
    if (rec) return String(rec.nome ?? k)
    return k
  }
  const groups = useMemo(() => {
    if (!groupBy) return null
    const map = new Map<string, Row[]>()
    for (const row of page) {
      const raw = row[groupBy]
      const key = Array.isArray(raw) ? (raw.length ? String(raw[0]) : '∅') : raw == null || raw === '' ? '∅' : String(raw)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(row)
    }
    const keys = [...map.keys()].sort((a, b) => groupLabelOf(a).localeCompare(groupLabelOf(b), 'pt-BR'))
    if (groupDir === 'desc') keys.reverse()
    return keys.map((k) => ({ key: k, label: groupLabelOf(k), field: groupField, rows: map.get(k)!, collapsed: collapsed.has(k) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBy, page, groupDir, collapsed, groupField, recordsById])

  const setFilterRoot = (g: FilterGroup) => { setFilterRootState(g); setPageIndex(0) }
  const commitFilter = (g: FilterGroup) => {
    undoRef.current.push({ type: 'filter', prev: filterRootRef.current })
    setFilterRoot(g)
  }
  const addFilterValue = (fieldId: string, value: string) => {
    const f = fields.find((x) => x.id === fieldId)
    const op = f && (f.type === 'multiselect' || f.type === 'relation') ? 'tem' : '='
    const root = filterRootRef.current
    if (root.items.some((it) => !isGroup(it) && it.fieldId === fieldId && it.op === op && it.value === value)) return
    commitFilter({ ...root, items: [...root.items, { fieldId, op, value }] })
  }

  const toggleField = (fieldId: string) => {
    const next = fields
      .filter((f) => (f.id === fieldId ? !visibleIds.includes(f.id) : visibleIds.includes(f.id)))
      .map((f) => f.id)
    onConfigChange({ visibleFieldIds: next })
  }

  const getAgg = (field: Field): AggFn => aggs[field.id] ?? defaultAgg(field)
  const setAgg = (id: string, fn: AggFn) => setAggs((p) => ({ ...p, [id]: fn }))

  const markSaved = () => {
    setSaved(true)
    if (savedTimer.current) clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 1500)
  }
  const fieldLabel = (id: string) => fields.find((f) => f.id === id)?.label ?? id

  function pushAudit(p: Omit<AuditEntry, 'id' | 'ts' | 'user'>): AuditEntry | null {
    if (!auditOn) return null
    const entry: AuditEntry = { id: `a${Date.now()}-${auditSeq.current++}`, ts: Date.now(), user: auditUser, ...p }
    audit?.log?.(entry)
    setAuditLog((prev) => [...prev, entry])
    if (entry.kind !== 'restore') undoRef.current.push({ type: 'audit', entry })
    return entry
  }

  // edição com auditoria: a view chama isto no lugar do onEdit cru.
  const edit = (rowId: string, fieldId: string, value: unknown) => {
    const before = recordsById.get(rowId)?.[fieldId]
    onEdit?.(rowId, fieldId, value)
    if (auditOn && before !== value)
      pushAudit({ kind: 'edit', label: `Editou ${fieldLabel(fieldId)}`, cells: [{ rowId, fieldId, before, after: value }] })
    markSaved()
  }

  function applyRevert(entry: AuditEntry) {
    if (!auditOn || revertedRef.current.has(entry.id)) return
    revertedRef.current.add(entry.id)
    if (entry.cells?.length) {
      for (const c of entry.cells) onEdit?.(c.rowId, c.fieldId, c.before)
      const swapped: AuditCell[] = entry.cells.map((c) => ({ rowId: c.rowId, fieldId: c.fieldId, before: c.after, after: c.before }))
      const what = entry.cells.length === 1 ? fieldLabel(entry.cells[0].fieldId) : `${entry.cells.length} células`
      pushAudit({ kind: 'restore', label: `Reverteu ${what}`, cells: swapped, restoreOf: entry.id })
    }
    markSaved()
  }
  applyRevertRef.current = applyRevert
  const canRevert = (e: AuditEntry) => auditOn && e.kind !== 'restore' && !revertedRef.current.has(e.id) && !!e.cells?.length

  // Ctrl+Z global: desfaz a última ação (filtro = sem log; dado = pede confirmação)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.key !== 'z' && e.key !== 'Z') || e.shiftKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      let act = undoRef.current.pop()
      while (act && act.type === 'audit' && revertedRef.current.has(act.entry.id)) act = undoRef.current.pop()
      if (!act) return
      e.preventDefault()
      if (act.type === 'filter') setFilterRoot(act.prev)
      else if (!confirmUndoRef.current) setConfirmUndo(act.entry)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { if (confirmUndo) undoNoBtnRef.current?.focus() }, [confirmUndo])
  const cancelUndo = () => {
    if (confirmUndo) undoRef.current.push({ type: 'audit', entry: confirmUndo })
    setConfirmUndo(null)
  }
  const confirmUndoNow = () => {
    if (confirmUndo) applyRevertRef.current(confirmUndo)
    setConfirmUndo(null)
  }

  // grid de logs: a própria TableView (modo cliente + enxuto) com ação "Reverter"
  const renderLogGrid = (list: AuditEntry[]) => {
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
      <Suspense fallback={<div className="p-8 text-sm text-[#94A3B8]">Carregando…</div>}>
        <TableView
          records={logRows}
          fields={LOG_FIELDS}
          config={{ visibleFieldIds: LOG_FIELD_IDS }}
          onConfigChange={() => {}}
          onEdit={() => {}}
          minimal
          rowActions={[{
            label: 'Reverter',
            onSelect: (rowId) => { const e = byId.get(rowId); if (e) applyRevert(e) },
            enabled: (rowId) => { const e = byId.get(rowId); return !!e && canRevert(e) },
          }]}
        />
      </Suspense>
    )
  }

  // ---- snapshot da view + detecção de mudanças não salvas (dirty) ----
  // captura tudo que uma view guarda: config (campos/papéis/extra) + filtro +
  // rodapé (campos/agregações) + agrupamento. NÃO inclui dados, paginação nem seleção.
  const captureView = (): ChromeViewPayload => ({
    visibleFieldIds: visibleIds,
    filter: filterRoot,
    roles: config.roles,
    extra: config.extra,
    footerIds,
    aggs,
    groupBy,
    groupDir,
  })
  const baselineRef = useRef<ChromeViewPayload | null>(null)
  if (baselineRef.current === null) baselineRef.current = captureView()
  // pristine = snapshot do 1º render (o defaultConfig do registry, sem filtro/grupo).
  // é a "View Padrão" p/ onde o usuário volta. Capturado ANTES de qualquer auto-apply.
  const pristineRef = useRef<ChromeViewPayload | null>(null)
  if (pristineRef.current === null) pristineRef.current = captureView()
  const dirty = !deepEqual(captureView(), baselineRef.current)

  // restaura um snapshot (config + filtro + rodapé + agrupamento) e fixa o baseline.
  const restoreSnapshot = (p: ChromeViewPayload) => {
    onConfigChange({ visibleFieldIds: p.visibleFieldIds, roles: p.roles, extra: p.extra })
    setFilterRoot(p.filter ?? { conj: 'and', items: [] })
    setFooterIds(p.footerIds ?? defaultFooterIds)
    setAggs(p.aggs ?? {})
    setGroupBy(p.groupBy ?? null)
    setGroupDir(p.groupDir ?? 'asc')
    baselineRef.current = {
      visibleFieldIds: p.visibleFieldIds,
      filter: p.filter ?? { conj: 'and', items: [] },
      roles: p.roles,
      extra: p.extra,
      footerIds: p.footerIds ?? defaultFooterIds,
      aggs: p.aggs ?? {},
      groupBy: p.groupBy ?? null,
      groupDir: p.groupDir ?? 'asc',
    }
  }

  // ---- views / filtros salvos ----
  const saveView = (name: string, scope: Scope, sharedWith: string[] | undefined, editingId: string | null) => {
    if (editingId) {
      setSavedViews(updateSaved<ChromeViewPayload>(VIEWS_KEY, editingId, { name, scope, sharedWith }))
    } else {
      const id = newId()
      setSavedViews(addSaved<ChromeViewPayload>(VIEWS_KEY, { id, name, scope, sharedWith, payload: captureView() }))
      setAppliedView({ id, name }) // a nova view vira a aplicada
      baselineRef.current = captureView() // limpa o "não salvo"
    }
    toast.success(`View salva (${scopeMsg(scope)})`)
  }
  // sobrescreve a view aplicada com o estado atual (botão "Atualizar")
  const updateAppliedView = () => {
    if (!appliedView) return
    setSavedViews(updateSaved<ChromeViewPayload>(VIEWS_KEY, appliedView.id, { payload: captureView() }))
    baselineRef.current = captureView()
    toast.success('View atualizada')
  }
  const applyView = (it: Saved<ChromeViewPayload>) => {
    restoreSnapshot(it.payload)
    setAppliedView({ id: it.id, name: it.name })
  }
  // volta ao pristine (a "View Padrão": defaultConfig do registry, sem filtro/grupo)
  const applyDefault = () => {
    if (pristineRef.current) restoreSnapshot(pristineRef.current)
    setAppliedView(null)
  }

  // ---- view padrão do usuário (estrela): auto-aplica ao entrar, por tipo de view ----
  const [defaultViewId, setDefaultViewIdState] = useState<string | null>(() => getDefaultView(viewKey))
  const setDefaultViewId = (id: string | null) => {
    setDefaultViewIdState(id)
    saveDefaultView(viewKey, id)
    if (id) { const it = savedViews.find((v) => v.id === id); if (it) applyView(it) }
    else applyDefault()
  }
  const deleteView = (id: string) => {
    setSavedViews(removeSaved<ChromeViewPayload>(VIEWS_KEY, id))
    if (appliedView?.id === id) setAppliedView(null)
    if (defaultViewId === id) { setDefaultViewIdState(null); saveDefaultView(viewKey, null) }
  }
  // ao montar: se há uma view padrão salva p/ este tipo de view, aplica-a
  const didInitDefault = useRef(false)
  useEffect(() => {
    if (didInitDefault.current) return
    didInitDefault.current = true
    if (defaultViewId) { const it = savedViews.find((v) => v.id === defaultViewId); if (it) applyView(it) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const saveFilter = (name: string, scope: Scope, sharedWith: string[] | undefined, editingId: string | null) => {
    if (editingId) setSavedFilters(updateSaved<FilterGroup>(FILTERS_KEY, editingId, { name, scope, sharedWith }))
    else setSavedFilters(addSaved<FilterGroup>(FILTERS_KEY, { id: newId(), name, scope, sharedWith, payload: filterRoot }))
    toast.success(`Filtro salvo (${scopeMsg(scope)})`)
  }
  const deleteFilter = (id: string) => setSavedFilters(removeSaved<FilterGroup>(FILTERS_KEY, id))
  const applyFilter = (it: Saved<FilterGroup>) => setFilterRoot(it.payload)

  const doExport = () => {
    const n = exportCsv(visibleFields, filtered, recordsById, csvName)
    toast.success(`CSV exportado (${n} linhas)`)
  }

  // ---- selecao de linhas (checkbox + select-all + shift-range) ----
  const pageIds = useMemo(() => page.map((r) => r.id), [page])
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const someSelected = selected.size > 0 && !allSelected
  const isSelected = (id: string) => selected.has(id)
  const clearSelection = () => setSelected(new Set())
  const selectAllAcross = () => setSelected(new Set(filtered.map((r) => r.id)))
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(pageIds))
  const toggleSelect = (id: string) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n })
  // orderedIds = lista na ordem exibida (default: a página). Views que renderizam o
  // conjunto inteiro (Tree/Kanban/etc) passam seus ids p/ o shift-range cobrir tudo.
  const toggleRow = (id: string, index: number, shift: boolean, orderedIds: string[] = pageIds) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (shift && lastClickedRef.current != null) {
        const a = Math.min(lastClickedRef.current, index)
        const b = Math.max(lastClickedRef.current, index)
        const target = !prev.has(id)
        for (let i = a; i <= b; i++) { const rid = orderedIds[i]; if (!rid) continue; if (target) next.add(rid); else next.delete(rid) }
      } else if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    lastClickedRef.current = index
  }

  // ---- copiar / abrir / excluir ----
  const copyText = (s: string) => { navigator.clipboard?.writeText(s).then(() => toast.success('Copiado')).catch(() => {}) }
  const openRow = (id: string) => { if (onRowOpen) onRowOpen(id); else toast.info('Abrir detalhe , conecte onRowOpen(rowId)') }
  const deleteRow = (id: string) => { onRowDelete?.(id); setSelected((p) => { const n = new Set(p); n.delete(id); return n }); if (auditOn) { const r = recordsById.get(id); if (r) pushAudit({ kind: 'delete', label: 'Excluiu linha', row: r }) } markSaved() }

  // menu de contexto da LINHA (compartilhado por todas as views)
  function rowMenu(id: string, opts?: { onEditField?: () => void }): MenuEntry[] {
    const row = recordsById.get(id)
    return [
      { icon: <ExternalLink size={15} />, label: 'Abrir registro', onSelect: () => openRow(id) },
      ...(opts?.onEditField ? [{ icon: <Pencil size={15} />, label: 'Editar', onSelect: opts.onEditField }] : []),
      null,
      { icon: <Check size={15} />, label: selected.has(id) ? 'Desmarcar linha' : 'Selecionar linha', onSelect: () => toggleSelect(id) },
      { icon: <Copy size={15} />, label: 'Copiar linha', onSelect: () => row && copyText(visibleFields.map((f) => cellToText(f, row[f.id], recordsById)).join('\t')) },
      null,
      { icon: <Trash2 size={15} />, label: 'Excluir linha', danger: true, disabled: !onRowDelete, hint: onRowDelete ? undefined : 'sem permissão', onSelect: () => deleteRow(id) },
      ...(rowActions?.length ? [null as MenuEntry, ...rowActions.map((a): MenuEntry => ({ icon: <RotateCcw size={15} />, label: a.label, danger: a.danger, disabled: a.enabled ? !a.enabled(id) : false, onSelect: () => a.onSelect(id) }))] : []),
    ]
  }

  // menu de contexto do CAMPO (valor) , filtrar/copiar/ocultar
  function fieldMenu(id: string, fieldId: string, opts?: { onEditField?: () => void }): MenuEntry[] {
    const field = fields.find((f) => f.id === fieldId)
    const row = recordsById.get(id)
    const value = row?.[fieldId]
    const text = field ? cellToText(field, value, recordsById) : String(value ?? '')
    const filterVal = Array.isArray(value) ? String((value as unknown[])[0] ?? '') : String(value ?? '')
    return [
      ...(opts?.onEditField ? [{ icon: <Pencil size={15} />, label: 'Editar campo', onSelect: opts.onEditField }] : []),
      { icon: <Copy size={15} />, label: 'Copiar valor', onSelect: () => copyText(text) },
      { icon: <ListFilter size={15} />, label: 'Filtrar por este valor', onSelect: () => fieldId && addFilterValue(fieldId, filterVal) },
      { icon: <EyeOff size={15} />, label: 'Ocultar campo', onSelect: () => toggleField(fieldId) },
    ]
  }

  return {
    // dados
    records: page,
    filtered,
    aggRecords: filtered,
    recordsById,
    recordOptions,
    userOptions,
    fields,
    toggleableFields,
    total,
    // visibilidade
    visibleIds,
    visibleFields,
    toggleField,
    // rodapé (campos agregados, escolhidos na aba Campos)
    footerIds,
    footerFields,
    toggleFooter,
    removeFooter,
    reorderFooter,
    // selecao
    selected,
    isSelected,
    allSelected,
    someSelected,
    toggleRow,
    toggleSelect,
    toggleAll,
    selectAllAcross,
    clearSelection,
    // menus de contexto (linha + campo)
    rowMenu,
    fieldMenu,
    openRow,
    // agrupamento
    groupBy,
    setGroupBy,
    groupDir,
    setGroupDir,
    groups,
    groupField,
    groupableFields,
    collapsed,
    toggleCollapse,
    // filtro
    filterRoot,
    setFilterRoot: commitFilter,
    filterCount,
    addFilterValue,
    // paginação
    pageIndex,
    pageSize,
    setPageIndex,
    setPageSize,
    pageSizes: PAGE_SIZES,
    // salvos
    savedViews,
    savedFilters,
    appliedView,
    dirty,
    saveView,
    updateAppliedView,
    deleteView,
    applyView,
    applyDefault,
    defaultViewId,
    setDefaultViewId,
    saveFilter,
    deleteFilter,
    applyFilter,
    // export
    exportCsv: doExport,
    // agregação (rodapé)
    getAgg,
    setAgg,
    // edição auditada
    edit,
    // auditoria (nuvem de logs)
    audit: {
      enabled: auditOn,
      saved,
      entries: auditLog,
      canRevert,
      onRevert: applyRevert,
      fieldLabel,
      renderGrid: renderLogGrid,
      gridWidth: LOG_GRID_WIDTH,
    },
    // Ctrl+Z (confirmação de reverter dado)
    confirmUndo,
    cancelUndo,
    confirmUndoNow,
    undoNoBtnRef,
  }
}

export type ViewChrome = ReturnType<typeof useViewChrome>
