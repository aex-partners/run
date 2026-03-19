import React from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { CheckCircle2, Loader2, Circle, AlertCircle, ChevronRight } from 'lucide-react'

export interface PlanStep {
  id: string
  label: string
  status: 'pending' | 'active' | 'complete' | 'error'
}

export interface PlanCardProps {
  title: string
  description?: string
  steps: PlanStep[]
  isStreaming?: boolean
  defaultOpen?: boolean
}

const shimmerKeyframes = `
@keyframes aex-plan-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`

const spinKeyframes2 = `
@keyframes aex-plan-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
`

function injectPlanStyles() {
  if (typeof document === 'undefined') return
  const id = 'aex-plan-styles'
  if (!document.getElementById(id)) {
    const style = document.createElement('style')
    style.id = id
    style.textContent = shimmerKeyframes + spinKeyframes2
    document.head.appendChild(style)
  }
}

function PlanStepIcon({ status }: { status: PlanStep['status'] }) {
  if (status === 'complete') return <CheckCircle2 size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
  if (status === 'active') return <Loader2 size={14} style={{ color: 'var(--accent)', flexShrink: 0, animation: 'aex-plan-spin 1s linear infinite' }} />
  if (status === 'error') return <AlertCircle size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} />
  return <Circle size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
}

export function PlanCard({ title, description, steps, isStreaming = false, defaultOpen = false }: PlanCardProps) {
  const [open, setOpen] = React.useState(defaultOpen)
  const completeCount = steps.filter((s) => s.status === 'complete').length

  injectPlanStyles()

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--surface)',
        maxWidth: 420,
        overflow: 'hidden',
      }}
    >
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger asChild>
          <button
            type="button"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '10px 12px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>
                {title}
              </div>
              {steps.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {completeCount} of {steps.length} complete
                </div>
              )}
            </div>
            <ChevronRight
              size={14}
              style={{
                color: 'var(--text-muted)',
                transition: 'transform 0.15s',
                transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                flexShrink: 0,
              }}
            />
          </button>
        </Collapsible.Trigger>

        <Collapsible.Content>
          <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border)' }}>
            {description && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, padding: '8px 0' }}>
                {description}
              </div>
            )}

            {isStreaming && steps.length === 0 ? (
              <div
                style={{
                  height: 32,
                  marginTop: 8,
                  borderRadius: 6,
                  background: 'linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'aex-plan-shimmer 1.5s ease-in-out infinite',
                }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8 }}>
                {steps.map((step) => (
                  <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <PlanStepIcon status={step.status} />
                    <span
                      style={{
                        fontSize: 13,
                        color: step.status === 'error' ? 'var(--danger)' : step.status === 'pending' ? 'var(--text-muted)' : 'var(--text)',
                        fontWeight: step.status === 'active' ? 500 : 400,
                        textDecoration: step.status === 'complete' ? 'line-through' : 'none',
                        lineHeight: 1.4,
                      }}
                    >
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  )
}

export default PlanCard
