/**
 * Contrato compartilhado do multi-view (sandbox /lab).
 *
 * Uma fonte de dados (DataSource) expõe `records` + `fields` (o schema).
 * Cada VIEW recebe esse mesmo contrato (ViewProps) e renderiza a sua forma,
 * lendo a config (campos visiveis, papeis, filtros, sort). Assim todas as views
 * consomem a MESMA fonte e dao pra unir depois num container so.
 */
import type { PageQuery, PageResult } from './server'

export type FieldType =
  | 'id'
  | 'text'
  | 'longtext'
  | 'number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'status'
  | 'person'
  | 'url'
  | 'image'
  | 'geo'
  | 'relation'
  | 'file'
  | 'boolean'
  | 'email'
  | 'phone'
  | 'rating'
  | 'duration'
  // Campo derivado (lê um campo do registro apontado por uma relação). Somente
  // leitura: o host resolve o valor e injeta na célula; não tem editor.
  | 'lookup'

/**
 * Metadado de um arquivo (campo 'file'). Pensado p/ conectar depois com a view
 * de Drive (id aponta p/ o arquivo la). Mostra dados basicos no hover.
 */
export interface FileMeta {
  id: string
  name: string
  /** mime, ex 'application/pdf'. */
  mime?: string
  /** tamanho em bytes. */
  size?: number
  createdAt?: string
  modifiedAt?: string
  author?: string
  /** nº de paginas (pdf). */
  pages?: number
  /** url p/ abrir/baixar (blob: de upload local ou link do Drive). */
  url?: string
}

export interface FieldOption {
  value: string
  label: string
  /** cor hex p/ badge/coluna (status/select). */
  color?: string
  /** url da imagem p/ avatar (person). */
  image?: string
}

export interface Field {
  id: string
  label: string
  type: FieldType
  /** opcoes p/ select / multiselect / status. */
  options?: FieldOption[]
  /** id do field que guarda o pai (relation), p/ arvore/grafo. */
  relationTo?: string
  /** regra de campo p/ array (multiselect / relacao multipla): minimo e maximo de itens. */
  min?: number
  max?: number
  /** permite criar itens novos na combobox (digitar -> "Adicionar ..."). */
  creatable?: boolean
  /** campo aceita varios itens (image/file): array vs item unico. */
  multiple?: boolean
  /**
   * Campo somente-leitura: a célula não entra em edição (nem inline nem em massa).
   * Usado por campos derivados/computados/de sistema (lookup, rollup, formula,
   * autonumber, created_at/by, updated_at/by) — o host resolve o valor.
   */
  readonly?: boolean
  /**
   * Rating: nº máximo de estrelas (default 5). Reaproveita nada de multiselect;
   * `max` (min/max de itens) é de array, então rating usa este campo próprio.
   */
  maxRating?: number
  /** renderiza como avatar (img + nome); arrays viram avatares aninhados (stacked). */
  avatar?: boolean
  /**
   * Formatacao de moeda (so p/ type 'currency'). Numero puro e o padrao (type 'number').
   * `currency` = codigo ISO fixo (ex 'BRL'). `currencyField` = id de um campo da linha
   * que guarda o codigo por registro (ex transacao com a propria moeda). currencyField
   * tem prioridade; se nada, cai em 'BRL'.
   */
  currency?: string
  currencyField?: string
}

/** Um registro. Sempre tem `id`; demais chaves seguem os fields. */
export type Row = { id: string } & Record<string, unknown>

/** Uma alteracao de valor (numa celula). Guarda antes/depois p/ reverter. */
export interface AuditCell {
  rowId: string
  fieldId: string
  before: unknown
  after: unknown
}
/**
 * Entrada do log de auditoria (append-only). Cada operacao do usuario vira uma
 * entry. `restore` (reverter / Ctrl+Z) NAO anula a entry anterior: cria uma nova
 * operacao apontando p/ a original via `restoreOf`.
 */
export interface AuditEntry {
  id: string
  /** epoch ms. */
  ts: number
  /** autor da operacao. */
  user: string
  kind: 'edit' | 'bulk' | 'delete' | 'duplicate' | 'restore'
  /** descricao legivel (ex "Editou Status"). */
  label: string
  /** alteracoes de valor (edit / bulk / restore de valores). */
  cells?: AuditCell[]
  /** linha afetada (delete = removida; duplicate = copia criada). */
  row?: Row
  /** id da entry que esta operacao restaurou (so em kind 'restore'). */
  restoreOf?: string
}
/**
 * Adaptador de auditoria. O dev liga o recurso e conecta a tabela do banco:
 * `log` faz o INSERT, `list` faz o SELECT do historico. Sem adapter (ou
 * enabled:false) a tabela esconde a nuvem/historico e o Ctrl+Z fica off.
 */
export interface AuditAdapter {
  /** liga o recurso. */
  enabled?: boolean
  /** usuario atual (autor das operacoes). */
  currentUser?: string
  /** persiste uma entrada (produto: INSERT na tabela de auditoria). */
  log?: (entry: AuditEntry) => void
  /** carrega o historico (produto: SELECT na tabela). */
  list?: () => AuditEntry[] | Promise<AuditEntry[]>
}

/**
 * Config POR VIEW. Tudo opcional: cada view usa o que precisa.
 * `roles` mapeia papeis -> id de field (groupBy, coverImage, dateField,
 * startField, endField, parentField, xField, yField, latField, lngField,
 * rowField, colField, valueField, etc). `extra` guarda settings livres
 * (chartType, agregacao, timescale...).
 */
export interface ViewConfig {
  visibleFieldIds?: string[]
  sort?: { fieldId: string; dir: 'asc' | 'desc' }[]
  filters?: { fieldId: string; op: string; value: unknown }[]
  roles?: Record<string, string | null>
  extra?: Record<string, unknown>
}

/** Props que TODA view implementa. */
export interface ViewProps {
  records: Row[]
  fields: Field[]
  config: ViewConfig
  /** patch raso na config da view (a pagina faz o merge). */
  onConfigChange: (patch: Partial<ViewConfig>) => void
  /** edita um valor de um registro (inline / drag-to-edit). */
  onEdit: (rowId: string, fieldId: string, value: unknown) => void
  /** clicar p/ abrir a tela de detalhe do registro (ver/editar). */
  onRowOpen?: (rowId: string) => void
  /** excluir o registro de forma persistida (o host confirma + persiste). */
  onRowDelete?: (rowId: string) => void
  /** cria um registro novo (ex: clicar num slot vazio do calendario). Retorna o id. */
  onCreate?: (partial: Partial<Row>) => void
  /**
   * Paginacao SERVER-SIDE: se o host fornece, a tabela pede pagina ao backend
   * (limit/offset/sort/filter) e ignora `records`. Se NAO fornece, a tabela usa
   * `records` em modo CLIENTE (filtra/ordena/pagina localmente).
   */
  fetchPage?: (q: PageQuery) => Promise<PageResult>
  /**
   * Auditoria + Ctrl+Z (opcional). Se o host fornece um adapter habilitado, a
   * tabela registra cada operacao, mostra a nuvem com historico e habilita o
   * desfazer. Sem isto o recurso fica invisivel.
   */
  audit?: AuditAdapter
  /** modo enxuto: esconde chrome pesado (agrupar/filtros/views/nuvem). Usado p/ embutir. */
  minimal?: boolean
  /**
   * Edição de schema (ligada pelo host). Quando o host fornece estes callbacks, o
   * cabeçalho habilita a UI de editar/duplicar/excluir/adicionar campo (popovers +
   * duplo-clique p/ renomear). `fieldId` é o id do campo no good-views (o host
   * mapeia p/ o id real do backend). `type` é o FieldType do good-views.
   */
  onFieldUpdate?: (fieldId: string, updates: { name?: string; type?: FieldType; options?: FieldOption[]; required?: boolean }) => void
  onFieldDelete?: (fieldId: string) => void
  onFieldDuplicate?: (fieldId: string) => void
  onFieldAdd?: (spec: { name: string; type: FieldType; options?: FieldOption[] }) => void
  /**
   * Picker de edição de relação: carregador assíncrono das opções da entidade-ALVO
   * de um campo relation (id + rótulo), com busca server-side. Quando fornecido, o
   * editor de célula relation lista/busca os registros do alvo em vez do `records`
   * local (que em modo servidor é vazio). Ao escolher, persiste o id do alvo.
   */
  loadRelationOptions?: (fieldId: string, search: string) => Promise<{ value: string; label: string }[]>
  /** acoes extras por linha (entram no menu de contexto da linha). */
  rowActions?: RowAction[]
  /**
   * Renderiza as rowActions tambem como botoes inline numa coluna fixa a direita.
   * Default false: as acoes ficam so no menu de contexto (botao direito), evitando
   * poluir a tabela. Usado internamente pelo grid de logs (botao "Reverter").
   */
  rowActionsInline?: boolean
}

/** Acao customizada por linha (menu de contexto). */
export interface RowAction {
  label: string
  onSelect: (rowId: string) => void
  danger?: boolean
  /** habilita por linha (default: sempre). */
  enabled?: (rowId: string) => boolean
}

/** helpers de schema */
export function getField(fields: Field[], id: string | null | undefined): Field | undefined {
  return id ? fields.find((f) => f.id === id) : undefined
}
export function fieldsByType(fields: Field[], ...types: FieldType[]): Field[] {
  return fields.filter((f) => types.includes(f.type))
}
