import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { CellProps } from '../types'

export function AICell({ column, value, rowId, onAIGenerate, onDirectCommit }: CellProps) {
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState<string | null>(null)
  const displayValue = generated ?? String(value)

  const handleGenerate = async () => {
    if (!onAIGenerate || loading) return
    setLoading(true)
    try {
      const result = await onAIGenerate(rowId, column.id, column.aiPrompt || '')
      setGenerated(result)
      onDirectCommit?.(result)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
        color: 'var(--accent)',
      }}>
        <Sparkles size={12} />
        ...
      </span>
    )
  }

  if (!displayValue || displayValue === 'undefined') {
    return (
      <button
        onClick={handleGenerate}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          background: 'linear-gradient(135deg, var(--accent-light), #f0f0ff)',
          border: '1px solid var(--accent-border)',
          borderRadius: 4,
          padding: '3px 10px',
          fontSize: 12,
          color: 'var(--accent)',
          fontWeight: 500,
          cursor: onAIGenerate ? 'pointer' : 'default',
          fontFamily: 'inherit',
        }}
      >
        <Sparkles size={12} />
        Generate
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <Sparkles size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
      <span style={{ fontSize: 13 }}>{displayValue}</span>
    </div>
  )
}
