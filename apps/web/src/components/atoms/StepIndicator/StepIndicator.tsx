import React from 'react'
import { Check } from 'lucide-react'

export interface StepIndicatorStep {
  label: string
}

export interface StepIndicatorProps {
  steps: StepIndicatorStep[]
  currentStep: number
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <nav aria-label="Setup progress" style={{ display: 'flex', alignItems: 'center', gap: 0, width: '100%' }}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep
        const isCurrent = index === currentStep
        const isLast = index === steps.length - 1

        return (
          <React.Fragment key={index}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                flex: isLast ? '0 0 auto' : undefined,
              }}
            >
              <div
                role="listitem"
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Step ${index + 1}: ${step.label}${isCompleted ? ' (completed)' : isCurrent ? ' (current)' : ''}`}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  flexShrink: 0,
                  transition: 'all 0.2s',
                  ...(isCompleted
                    ? { background: 'var(--accent)', color: '#fff' }
                    : isCurrent
                      ? { background: 'var(--accent)', color: '#fff' }
                      : { background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }),
                }}
              >
                {isCompleted ? <Check size={14} /> : index + 1}
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: isCurrent ? 600 : 400,
                  color: isCompleted || isCurrent ? 'var(--text)' : 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: isCompleted ? 'var(--accent)' : 'var(--border)',
                  marginInline: 8,
                  marginBottom: 24,
                  borderRadius: 1,
                  transition: 'background 0.2s',
                }}
              />
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}

export default StepIndicator
