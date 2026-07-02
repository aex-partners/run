import { type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

/**
 * Botão da toolbar das views: só ícone; no hover expande o texto; se `active`,
 * o texto fica fixo. `badge` mostra um contador (ex nº de filtros). `dot` mostra
 * um ponto âmbar (ex mudanças não salvas). Compartilhado por TableView e ViewToolbar.
 */
export function HeaderBtn({
  icon,
  label,
  active,
  onClick,
  badge,
  dot,
}: {
  icon: ReactNode
  label: string
  active?: boolean
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  badge?: number
  dot?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        'group/hb relative flex h-7 items-center rounded-md border px-1.5 transition-colors',
        active ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]' : 'border-[#E2E8F0] text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB]',
      )}
    >
      <span className="flex size-[18px] shrink-0 items-center justify-center">{icon}</span>
      <span className={cn('overflow-hidden whitespace-nowrap text-xs font-medium transition-[max-width] duration-200', active ? 'max-w-[160px]' : 'max-w-0 group-hover/hb:max-w-[160px]')}>
        <span className="pl-1">{label}</span>
      </span>
      {badge != null && badge > 0 && (
        <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-[#2563EB] text-[9px] font-bold text-white">{badge}</span>
      )}
      {dot && (badge == null || badge <= 0) && (
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[#F59E0B] ring-2 ring-white" title="Alterações não salvas" />
      )}
    </button>
  )
}
