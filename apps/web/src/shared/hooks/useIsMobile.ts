import { useSyncExternalStore } from 'react'

/** Viewport width (px) at/below which the app switches to its mobile shell. */
export const MOBILE_BREAKPOINT = 768

const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(QUERY).matches
}

/**
 * True when the viewport is narrower than MOBILE_BREAKPOINT. Reactive: updates
 * on resize/orientation change via a matchMedia listener. The single source of
 * truth for desktop-vs-mobile layout decisions across the app.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
