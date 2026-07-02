import React from 'react'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export interface StepIndicatorStep {
  label: string
}

export interface StepIndicatorProps {
  steps: StepIndicatorStep[]
  currentStep: number
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('stepIndicator.setupProgress')} style={{ display: 'flex', alignItems: 'center', gap: 0, width: '100%' }}>
      <ol role="list" style={{ display: 'flex', alignItems: 'center', gap: 0, width: '100%', margin: 0, padding: 0, listStyle: 'none' }}>
      {steps.map((step, index) => {
        const isCompleted = index < currentStep
        const isCurrent = index === currentStep
        const isLast = index === steps.length - 1

        return (
          <React.Fragment key={index}>
            <li
              aria-current={isCurrent ? 'step' : undefined}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                flex: isLast ? '0 0 auto' : undefined,
              }}
            >
              <div
                aria-label={t('stepIndicator.stepLabel', {
                  number: index + 1,
                  label: step.label,
                  status: isCompleted
                    ? t('stepIndicator.completedSuffix')
                    : isCurrent
                      ? t('stepIndicator.currentSuffix')
                      : '',
                })}
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
            </li>
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
      </ol>
    </nav>
  )
}

export default StepIndicator
