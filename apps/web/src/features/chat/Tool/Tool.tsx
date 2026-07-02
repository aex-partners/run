import React from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '../../../shared/ui/Badge/Badge'

export type ToolState = 'input-streaming' | 'input-available' | 'output-available' | 'output-error'

export interface ToolProps {
  toolName: string
  state: ToolState
  input?: Record<string, unknown>
  output?: string
  error?: string
  defaultOpen?: boolean
}

const stateConfig: Record<ToolState, { labelKey: string; variant: 'orange' | 'success' | 'danger' }> = {
  'input-streaming': { labelKey: 'tool.states.running', variant: 'orange' },
  'input-available': { labelKey: 'tool.states.running', variant: 'orange' },
  'output-available': { labelKey: 'tool.states.complete', variant: 'success' },
  'output-error': { labelKey: 'tool.states.error', variant: 'danger' },
}

export function Tool({ toolName, state, input, output, error, defaultOpen = false }: ToolProps) {
  const { t } = useTranslation()
  const [open, setOpen] = React.useState(defaultOpen)
  const config = stateConfig[state]

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--surface)',
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
              gap: 8,
              padding: '8px 12px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text)', fontFamily: 'monospace' }}>
              {toolName}
            </span>
            <Badge variant={config.variant} size="sm" dot>{t(config.labelKey)}</Badge>
            <ChevronRight
              size={12}
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
          <div style={{ borderTop: '1px solid var(--border)' }}>
            {input && Object.keys(input).length > 0 && (
              <div style={{ padding: '8px 12px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {t('tool.input')}
                </div>
                <pre
                  style={{
                    fontSize: 12,
                    fontFamily: 'monospace',
                    color: 'var(--text)',
                    background: 'var(--surface-2)',
                    padding: 8,
                    borderRadius: 6,
                    margin: 0,
                    overflow: 'auto',
                    maxHeight: 160,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {JSON.stringify(input, null, 2)}
                </pre>
              </div>
            )}

            {(output || error) && (
              <div style={{ padding: '8px 12px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {error ? t('tool.error') : t('tool.output')}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: error ? 'var(--danger)' : 'var(--text)',
                    background: 'var(--surface-2)',
                    padding: 8,
                    borderRadius: 6,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    maxHeight: 160,
                    overflow: 'auto',
                  }}
                >
                  {error || output}
                </div>
              </div>
            )}
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </div>
  )
}

export default Tool
