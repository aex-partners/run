import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, CheckCircle2, Database, Zap, Users, Shield, Sparkles } from 'lucide-react'

export type OnboardingPath = 'default' | 'scratch' | null

export interface PathPreviewPanelProps {
  selectedPath?: OnboardingPath
}

interface TerminalLine {
  id: number
  icon: React.ReactNode
  text: string
  done: boolean
}

const DEFAULT_LINES: { icon: React.ReactNode; text: string }[] = [
  { icon: <Database size={13} />, text: 'Analyzing your business niche...' },
  { icon: <Zap size={13} />, text: 'Generating recommended routines...' },
  { icon: <Users size={13} />, text: 'Preparing team workspace...' },
  { icon: <Shield size={13} />, text: 'Configuring permissions & roles...' },
  { icon: <Bot size={13} />, text: 'Activating AI assistants...' },
  { icon: <Database size={13} />, text: 'Building database schemas...' },
  { icon: <Zap size={13} />, text: 'Setting up automation triggers...' },
  { icon: <Users size={13} />, text: 'Syncing team preferences...' },
]

const SCRATCH_LINES: { icon: React.ReactNode; text: string }[] = [
  { icon: <Database size={13} />, text: 'Initializing empty workspace...' },
  { icon: <Shield size={13} />, text: 'Configuring base permissions...' },
  { icon: <Bot size={13} />, text: 'Activating AI assistant...' },
  { icon: <Zap size={13} />, text: 'Preparing custom builder tools...' },
  { icon: <Database size={13} />, text: 'Creating blank database...' },
  { icon: <Users size={13} />, text: 'Setting up admin workspace...' },
]

export function PathPreviewPanel({ selectedPath }: PathPreviewPanelProps) {
  const [lines, setLines] = useState<TerminalLine[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const idxRef = useRef(0)

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset state on path change
    setLines([])
    idxRef.current = 0

    if (!selectedPath) return

    const source = selectedPath === 'default' ? DEFAULT_LINES : SCRATCH_LINES

    setLines([{ id: 0, ...source[0], done: false }])
    idxRef.current = 1

    intervalRef.current = setInterval(() => {
      const idx = idxRef.current
      setLines((prev) => {
        const updated = prev.map((l, i) => (i === prev.length - 1 ? { ...l, done: true } : l))
        const nextIdx = idx % source.length
        const newLine = { id: idx, ...source[nextIdx], done: false }
        return [...updated, newLine].slice(-6)
      })
      idxRef.current = idx + 1
    }, 1800)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [selectedPath])

  return (
    <div
      data-testid="path-preview-panel"
      style={{
        flex: 1,
        background: 'linear-gradient(135deg, var(--accent) 0%, #C4490A 50%, #9a3412 100%)',
        display: 'flex',
        flexDirection: 'column',
        padding: 32,
        position: 'relative',
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />
      <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', top: -80, right: -60, filter: 'blur(60px)' }} />
      <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', bottom: -40, left: -40, filter: 'blur(40px)' }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {!selectedPath && (
          <div style={{ textAlign: 'center' }}>
            <motion.div
              animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.12)',
                border: '2px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 28px',
              }}
            >
              <Sparkles size={36} color="rgba(255,255,255,0.8)" />
            </motion.div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#fff' }}>AI-Powered Setup</h2>
            <p style={{ margin: '12px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
              Choose a path and watch the AI configure your workspace in real time.
            </p>
          </div>
        )}

        {selectedPath && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff' }}>
                {selectedPath === 'default' ? 'Building Your Workspace' : 'Preparing Clean Slate'}
              </h2>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                {selectedPath === 'default'
                  ? 'The AI will suggest routines tailored to your business.'
                  : 'Start with a blank canvas and full control.'}
              </p>
            </div>

            <div
              style={{
                background: 'rgba(0,0,0,0.35)',
                backdropFilter: 'blur(12px)',
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.1)',
                padding: 20,
                minHeight: 300,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e2445c' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fdab3d' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00c875' }} />
                <span style={{ marginLeft: 8, fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>aex-setup</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <AnimatePresence mode="popLayout" initial={false}>
                  {lines.map((line) => (
                    <motion.div
                      key={line.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20, scale: 0.95 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: line.done ? 'rgba(0, 200, 117, 0.1)' : 'rgba(255,255,255,0.05)',
                        border: line.done ? '1px solid rgba(0, 200, 117, 0.2)' : '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          background: line.done ? 'rgba(0, 200, 117, 0.25)' : 'rgba(255,255,255,0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: line.done ? '#00c875' : 'rgba(255,255,255,0.6)',
                          flexShrink: 0,
                        }}
                      >
                        {line.done ? <CheckCircle2 size={13} /> : line.icon}
                      </div>
                      <span
                        style={{
                          fontSize: 12,
                          fontFamily: 'monospace',
                          color: line.done ? 'rgba(0, 200, 117, 0.85)' : 'rgba(255,255,255,0.75)',
                          flex: 1,
                        }}
                      >
                        {line.text}
                      </span>
                      {!line.done && (
                        <motion.span
                          animate={{ opacity: [1, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
                          style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--accent-light)' }}
                        >
                          _
                        </motion.span>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default PathPreviewPanel
