import React from 'react'
import { type StepIndicatorStep } from '../../atoms/StepIndicator/StepIndicator'
import { Button } from '../../atoms/Button/Button'
import { AexLogo } from '../../atoms/AexLogo/AexLogo'
import { ArrowLeft, ArrowRight } from 'lucide-react'

export interface WizardStepLayoutProps {
  steps: StepIndicatorStep[]
  currentStep: number
  title: string
  description?: string
  children: React.ReactNode
  showcaseContent?: React.ReactNode
  onBack?: () => void
  onNext?: () => void
  nextLabel?: string
  nextDisabled?: boolean
  loading?: boolean
}

export function WizardStepLayout({
  steps: _steps,
  currentStep,
  title,
  description,
  children,
  showcaseContent,
  onBack,
  onNext,
  nextLabel = 'Next',
  nextDisabled = false,
  loading = false,
}: WizardStepLayoutProps) {
  const isFirst = currentStep === 0

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Left column: form */}
      <div
        style={{
          flex: '0 0 50%',
          maxWidth: '50%',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          overflow: 'hidden',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '36px 56px', flexShrink: 0 }}>
          <AexLogo size={28} />
        </div>

        {/* Form content area */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 56px 48px',
            overflow: 'auto',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, flexShrink: 0 }}>
            {title}
          </h2>
          {description && (
            <p style={{ margin: '10px 0 0', fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.5, flexShrink: 0 }}>
              {description}
            </p>
          )}
          <div style={{ marginTop: 36, flex: 1, minHeight: 0 }}>{children}</div>
        </div>

        {/* Navigation pinned to bottom */}
        <div
          style={{
            padding: '20px 56px 36px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          {!isFirst && onBack ? (
            <Button variant="secondary" onClick={onBack} leftIcon={<ArrowLeft size={14} />}>
              Back
            </Button>
          ) : (
            <div />
          )}
          {onNext && (
            <Button
              variant="primary"
              onClick={onNext}
              disabled={nextDisabled}
              loading={loading}
              rightIcon={!loading ? <ArrowRight size={14} /> : undefined}
            >
              {nextLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Right column: showcase */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', maxHeight: '100vh' }}>
        {showcaseContent}
      </div>
    </div>
  )
}

export default WizardStepLayout
