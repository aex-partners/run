/**
 * Skeleton de carregamento por tipo de view. Evita o "blink" (tela vazia/torta)
 * enquanto a view faz lazy-load ou busca a 1ª página (modo server). A forma
 * imita o layout real (grade, colunas, cards, calendário...).
 */
export type SkeletonVariant = 'table' | 'list' | 'board' | 'cards' | 'calendar' | 'timeline' | 'generic'

const PULSE = 'animate-pulse'
const bar = 'rounded bg-[#E2E8F0]'
const soft = 'rounded bg-[#F1F5F9]'

function Toolbar() {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[#E2E8F0] px-3">
      {Array.from({ length: 4 }).map((_, i) => <div key={i} className={`h-6 w-16 ${bar}`} />)}
      <div className="ml-auto h-6 w-28 rounded bg-[#F1F5F9]" />
    </div>
  )
}

function TableSk() {
  return (
    <div className={`flex h-full flex-col ${PULSE}`}>
      <Toolbar />
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-[#E2E8F0] px-3">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className={`h-3 flex-1 ${bar}`} />)}
      </div>
      <div className="flex-1 space-y-2 p-3">
        {Array.from({ length: 14 }).map((_, r) => (
          <div key={r} className="flex items-center gap-3">
            {Array.from({ length: 6 }).map((_, c) => <div key={c} className={`h-4 flex-1 ${soft}`} />)}
          </div>
        ))}
      </div>
    </div>
  )
}

function ListSk() {
  return (
    <div className={`flex h-full flex-col ${PULSE}`}>
      <Toolbar />
      <div className="flex-1 space-y-2 p-3">
        {Array.from({ length: 12 }).map((_, r) => (
          <div key={r} className="flex items-center gap-3 rounded-lg border border-[#F1F5F9] p-2">
            <div className={`size-7 shrink-0 rounded-full bg-[#E2E8F0]`} />
            <div className={`h-3.5 w-1/3 ${bar}`} />
            <div className={`h-3.5 w-20 ${soft}`} />
            <div className={`ml-auto h-3.5 w-24 ${soft}`} />
          </div>
        ))}
      </div>
    </div>
  )
}

function BoardSk() {
  return (
    <div className={`flex h-full flex-col ${PULSE}`}>
      <Toolbar />
      <div className="flex flex-1 gap-3 overflow-hidden p-3">
        {Array.from({ length: 5 }).map((_, col) => (
          <div key={col} className="flex w-60 shrink-0 flex-col gap-2">
            <div className={`h-6 w-32 ${bar}`} />
            {Array.from({ length: 4 }).map((_, c) => (
              <div key={c} className="space-y-2 rounded-lg border border-[#E2E8F0] p-3">
                <div className={`h-3.5 w-3/4 ${bar}`} />
                <div className={`h-3 w-1/2 ${soft}`} />
                <div className={`h-2 w-full ${soft}`} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function CardsSk() {
  return (
    <div className={`flex h-full flex-col ${PULSE}`}>
      <Toolbar />
      <div className="grid flex-1 grid-cols-2 gap-3 overflow-hidden p-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-[#E2E8F0] p-3">
            <div className={`h-28 w-full ${bar}`} />
            <div className={`h-3.5 w-3/4 ${bar}`} />
            <div className={`h-3 w-1/2 ${soft}`} />
          </div>
        ))}
      </div>
    </div>
  )
}

function CalendarSk() {
  return (
    <div className={`flex h-full flex-col ${PULSE}`}>
      <Toolbar />
      <div className="flex shrink-0 gap-2 border-b border-[#E2E8F0] px-14 py-2">
        {Array.from({ length: 7 }).map((_, i) => <div key={i} className={`h-6 flex-1 ${bar}`} />)}
      </div>
      <div className="flex flex-1 gap-2 overflow-hidden px-14 py-3">
        {Array.from({ length: 7 }).map((_, d) => (
          <div key={d} className="flex flex-1 flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className={`h-10 w-full ${soft}`} style={{ marginTop: (d + i) % 3 === 0 ? 16 : 0 }} />)}
          </div>
        ))}
      </div>
    </div>
  )
}

function TimelineSk() {
  return (
    <div className={`flex h-full flex-col ${PULSE}`}>
      <Toolbar />
      <div className="flex-1 space-y-3 p-3">
        {Array.from({ length: 10 }).map((_, r) => (
          <div key={r} className="flex items-center gap-3">
            <div className={`h-4 w-40 shrink-0 ${bar}`} />
            <div className={`h-5 ${soft}`} style={{ width: `${20 + ((r * 13) % 55)}%`, marginLeft: `${(r * 7) % 30}%` }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function GenericSk() {
  return (
    <div className={`flex h-full flex-col ${PULSE}`}>
      <Toolbar />
      <div className="flex-1 p-3"><div className={`h-full w-full ${soft}`} /></div>
    </div>
  )
}

export function ViewSkeleton({ variant = 'generic' }: { variant?: SkeletonVariant }) {
  switch (variant) {
    case 'table': return <TableSk />
    case 'list': return <ListSk />
    case 'board': return <BoardSk />
    case 'cards': return <CardsSk />
    case 'calendar': return <CalendarSk />
    case 'timeline': return <TimelineSk />
    default: return <GenericSk />
  }
}

/** mapeia a chave da view -> variante de skeleton. */
export function skeletonFor(viewKey: string): SkeletonVariant {
  switch (viewKey) {
    case 'table':
    case 'pivot': return 'table'
    case 'list': return 'list'
    case 'kanban': return 'board'
    case 'gallery': return 'cards'
    case 'calendar': return 'calendar'
    case 'timeline': return 'timeline'
    default: return 'generic'
  }
}
