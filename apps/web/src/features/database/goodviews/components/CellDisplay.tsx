import { Check, Minus, Star } from 'lucide-react'
import { useLightbox } from './Lightbox'

/**
 * Primitivas de exibição de pessoas/imagens, extraídas da TableView. Avatar (foto
 * ou iniciais), AvatarStack (aninhados), ImageThumb/ImageStack (miniatura quadrada
 * + hover/lightbox). Compartilhadas por TableView e demais views (ex sublinha da List).
 * ImageThumb/ImageStack usam o LightboxProvider (envolva a view).
 */

/** boolean (read): marca ✓ (verdadeiro) ou traço (falso/vazio). */
export function BoolCheck({ value }: { value: unknown }) {
  const on = value === true || value === 'true' || value === 1 || value === '1'
  return on ? (
    <Check size={15} className="text-[#16A34A]" aria-label="Sim" />
  ) : (
    <Minus size={14} className="text-[#CBD5E1]" aria-label="Não" />
  )
}

/** rating (read): N estrelas preenchidas de `max` (default 5). */
export function Stars({ value, max = 5 }: { value: number; max?: number }) {
  const n = Math.max(0, Math.min(max, Math.round(Number(value) || 0)))
  return (
    <span className="inline-flex items-center gap-0.5" title={`${n}/${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          size={13}
          className={i < n ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#CBD5E1]'}
        />
      ))}
    </span>
  )
}

/** duration (read): trata o número guardado como MINUTOS e formata `H:MM`. */
export function formatDuration(value: unknown): string {
  const total = Number(value)
  if (!Number.isFinite(total)) return ''
  const sign = total < 0 ? '-' : ''
  const mins = Math.abs(Math.round(total))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${sign}${h}:${String(m).padStart(2, '0')}`
}
export function Avatar({ label, image, size = 22 }: { label: string; image?: string; size?: number }) {
  const initials = label.trim().slice(0, 2).toUpperCase()
  if (image)
    return (
      <img
        src={image}
        alt={label}
        title={label}
        className="shrink-0 rounded-full object-cover ring-1 ring-white"
        style={{ width: size, height: size }}
        loading="lazy"
      />
    )
  return (
    <span
      title={label}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#E2E8F0] text-[10px] font-semibold text-[#475569] ring-1 ring-white"
      style={{ width: size, height: size }}
    >
      {initials}
    </span>
  )
}

/** avatares aninhados (stacked) p/ array de pessoas. */
export function AvatarStack({ people }: { people: { label: string; image?: string }[] }) {
  const shown = people.slice(0, 4)
  const extra = people.length - shown.length
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {shown.map((p, i) => (
          <Avatar key={i} label={p.label} image={p.image} />
        ))}
      </div>
      {extra > 0 && <span className="ml-1 text-xs text-[#94A3B8]">+{extra}</span>}
    </div>
  )
}

// thumbnail pequeno c/ borda (nao cresce a linha); hover mostra maior, flutuando
// sobre a tabela numa "divzinha" branca (igual o reveal das tags cortadas).
export function ImageThumb({ src, size = 24 }: { src: string; size?: number }) {
  const { open } = useLightbox()
  return (
    <span className="group/img relative inline-flex align-middle">
      <img
        src={src}
        alt=""
        loading="lazy"
        className="rounded border border-[#E2E8F0] object-cover"
        style={{ width: size, height: size }}
      />
      {/* preview no hover: clicavel p/ abrir em tela cheia */}
      <span className="absolute left-0 top-full z-40 mt-1 hidden w-max rounded-md border border-[#E2E8F0] bg-white p-1 shadow-xl group-hover/img:block">
        <img
          src={src}
          alt=""
          className="block cursor-zoom-in rounded object-cover"
          style={{ width: 180, height: 180 }}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
          onClick={(e) => { e.stopPropagation(); open([src], 0) }}
        />
      </span>
    </span>
  )
}

// varias imagens: thumbs sobrepostos + "+N"; hover mostra todas maiores (clicaveis -> tela cheia)
export function ImageStack({ srcs }: { srcs: string[] }) {
  const { open } = useLightbox()
  const shown = srcs.slice(0, 3)
  const extra = srcs.length - shown.length
  return (
    <span className="group/img relative inline-flex items-center align-middle">
      <span className="flex -space-x-1.5">
        {shown.map((s, i) => (
          <img
            key={i}
            src={s}
            alt=""
            loading="lazy"
            className="size-6 rounded border border-white object-cover ring-1 ring-[#E2E8F0]"
          />
        ))}
      </span>
      {extra > 0 && <span className="ml-1 text-xs text-[#94A3B8]">+{extra}</span>}
      <span className="absolute left-0 top-full z-40 mt-1 hidden w-max max-w-[420px] flex-wrap gap-1 rounded-md border border-[#E2E8F0] bg-white p-1 shadow-xl group-hover/img:flex">
        {srcs.map((s, i) => (
          <img
            key={i}
            src={s}
            alt=""
            className="block cursor-zoom-in rounded object-cover"
            style={{ width: 112, height: 112 }}
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
            onClick={(e) => { e.stopPropagation(); open(srcs, i) }}
          />
        ))}
      </span>
    </span>
  )
}
