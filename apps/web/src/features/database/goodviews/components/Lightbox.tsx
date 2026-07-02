import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react'

interface LightboxState { srcs: string[]; index: number }
interface LightboxApi { open: (srcs: string[], index?: number) => void }

const Ctx = createContext<LightboxApi>({ open: () => {} })
export function useLightbox(): LightboxApi {
  return useContext(Ctx)
}

/** Provider do visualizador em tela cheia de imagens (com navegação prev/próx). */
export function LightboxProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LightboxState | null>(null)
  const open = useCallback((srcs: string[], index = 0) => {
    const clean = srcs.filter(Boolean)
    if (clean.length) setState({ srcs: clean, index: Math.max(0, Math.min(index, clean.length - 1)) })
  }, [])
  const close = useCallback(() => setState(null), [])
  const go = useCallback((d: number) => setState((s) => (s ? { ...s, index: (s.index + d + s.srcs.length) % s.srcs.length } : s)), [])

  useEffect(() => {
    if (!state) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, close, go])

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-6" onMouseDown={close}>
          <button onClick={close} className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" title="Fechar (Esc)">
            <X size={20} />
          </button>
          <a href={state.srcs[state.index]} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="absolute right-16 top-4 flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" title="Abrir original">
            <ExternalLink size={18} />
          </a>
          {state.srcs.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); go(-1) }} className="absolute left-4 flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" title="Anterior (←)">
                <ChevronLeft size={26} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); go(1) }} className="absolute right-4 flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" title="Próxima (→)">
                <ChevronRight size={26} />
              </button>
            </>
          )}
          <img
            src={state.srcs[state.index]}
            alt=""
            className="max-h-[88vh] max-w-[92vw] rounded object-contain shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          />
          {state.srcs.length > 1 && (
            <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
              {state.index + 1} / {state.srcs.length}
            </span>
          )}
        </div>
      )}
    </Ctx.Provider>
  )
}
