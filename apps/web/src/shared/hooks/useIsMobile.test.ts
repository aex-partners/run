import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from './useIsMobile'

/** Build a controllable matchMedia mock and install it on window. */
function installMatchMedia(initialMatches: boolean) {
  let matches = initialMatches
  const listeners = new Set<(e: MediaQueryListEvent) => void>()
  const mql = {
    get matches() {
      return matches
    },
    media: '(max-width: 767px)',
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
  }
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia
  return {
    setMatches(next: boolean) {
      matches = next
      listeners.forEach((cb) => cb({ matches: next } as MediaQueryListEvent))
    },
  }
}

describe('useIsMobile', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true when the viewport matches the mobile query', () => {
    installMatchMedia(true)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('returns false when the viewport does not match', () => {
    installMatchMedia(false)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('updates when the media query changes', () => {
    const ctl = installMatchMedia(false)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
    act(() => ctl.setMatches(true))
    expect(result.current).toBe(true)
  })
})
