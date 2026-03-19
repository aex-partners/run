import React from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { CheckCircle2, Loader2, Circle, ChevronRight } from 'lucide-react'

export interface ChainOfThoughtStep {
  id: string
  label: string
  description?: string
  status: 'complete' | 'active' | 'pending'
}

export interface ChainOfThoughtProps {
  steps: ChainOfThoughtStep[]
  defaultOpen?: boolean
}

const spinKeyframes = `
@keyframes aex-cot-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`

function injectSpinStyles() {
  if (typeof document === 'undefined') return
  const id = 'aex-cot-spin'
  if (!document.getElementById(id)) {
    const style = document.createElement('style')
    style.id = id
    style.textContent = spinKeyframes
    document.head.appendChild(style)
  }
}

function StepIcon({ status }: { status: ChainOfThoughtStep['status'] }) {
  injectSpinStyles()

  if (status === 'complete') return <CheckCircle2 size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
  if (status === 'active') return <Loader2 size={14} style={{ color: 'var(--accent)', flexShrink: 0, animation: 'aex-cot-spin 1s linear infinite' }} />
  return <Circle size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
}

export function ChainOfThought({ steps, defaultOpen = false }: ChainOfThoughtProps) {
  const [open, setOpen] = React.useState(defaultOpen)
  const completeCount = steps.filter((s) => s.status === 'complete').length

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger asChild>
        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            color: 'var(--text-muted)',
            fontFamily: 'inherit',
            borderRadius: 6,
          }}
        >
          <span>Reasoning Steps</span>
          <span
            style={{
              padding: '1px 6px',
              fontSize: 10,
              fontWeight: 500,
              background: 'var(--surface-2)',
              borderRadius: 10,
              color: 'var(--text-muted)',
            }}
          >
            {completeCount}/{steps.length}
          </span>
          <ChevronRight
            size={12}
            style={{
              transition: 'transform 0.15s',
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          />
        </button>
      </Collapsible.Trigger>

      <Collapsible.Content>
        <div
          style={{
            marginTop: 4,
            padding: '8px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {steps.map((step) => (
            <div key={step.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingLeft: 4 }}>
              <StepIcon status={step.status} />
              <div>
                <div
                  style={{
                    fontSize: 13,
                    color: step.status === 'pending' ? 'var(--text-muted)' : 'var(--text)',
                    fontWeight: step.status === 'active' ? 500 : 400,
                    lineHeight: 1.4,
                  }}
                >
                  {step.label}
                </div>
                {step.description && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4, marginTop: 2 }}>
                    {step.description}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

export default ChainOfThought
