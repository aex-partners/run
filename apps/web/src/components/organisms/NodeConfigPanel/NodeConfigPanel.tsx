import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { Button } from '../../atoms/Button/Button'
import { JsonEditor } from '../../molecules/JsonEditor/JsonEditor'

export type TaskType = 'inference' | 'structured'

export interface NodeConfigData {
  taskType: TaskType
  toolName?: string
  agentId?: string
  toolInput?: string
}

export interface NodeConfigPanelProps {
  nodeId: string
  nodeLabel?: string
  initialData?: Partial<NodeConfigData>
  toolOptions?: { value: string; label: string }[]
  agentOptions?: { value: string; label: string }[]
  onSave?: (nodeId: string, data: NodeConfigData) => void
  onClose?: () => void
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--text)',
  display: 'block',
  marginBottom: 6,
}

export function NodeConfigPanel({
  nodeId,
  nodeLabel,
  initialData,
  toolOptions = [],
  agentOptions = [],
  onSave,
  onClose,
}: NodeConfigPanelProps) {
  const { t } = useTranslation()
  const [config, setConfig] = useState<NodeConfigData>({
    taskType: initialData?.taskType ?? 'inference',
    toolName: initialData?.toolName ?? '',
    agentId: initialData?.agentId ?? '',
    toolInput: initialData?.toolInput ?? '{}',
  })

  const handleSave = () => {
    onSave?.(nodeId, config)
  }

  return (
    <div
      style={{
        width: 320,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{t('workflows.nodeConfig')}</div>
          {nodeLabel && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{nodeLabel}</div>}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex' }}
            aria-label="Close panel"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div style={{ flex: 1, padding: 16, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle}>{t('workflows.taskType')}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['inference', 'structured'] as const).map((tt) => (
              <button
                key={tt}
                type="button"
                onClick={() => setConfig((c) => ({ ...c, taskType: tt }))}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: config.taskType === tt ? (tt === 'inference' ? 'var(--accent-light)' : '#eef2ff') : 'var(--surface)',
                  border: `1px solid ${config.taskType === tt ? (tt === 'inference' ? 'var(--accent)' : '#6366f1') : 'var(--border)'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: 600,
                  color: config.taskType === tt ? (tt === 'inference' ? 'var(--accent)' : '#6366f1') : 'var(--text)',
                  textAlign: 'center',
                }}
              >
                {tt === 'inference' ? 'Inference' : 'Structured'}
              </button>
            ))}
          </div>
        </div>

        {config.taskType === 'structured' && (
          <div>
            <label style={labelStyle}>{t('workflows.tool')}</label>
            <select
              value={config.toolName ?? ''}
              onChange={(e) => setConfig((c) => ({ ...c, toolName: e.target.value || undefined }))}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 13,
                fontFamily: 'inherit',
              }}
            >
              <option value="">Select tool...</option>
              {toolOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label style={labelStyle}>{t('workflows.agent')}</label>
          <select
            value={config.agentId ?? ''}
            onChange={(e) => setConfig((c) => ({ ...c, agentId: e.target.value || undefined }))}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          >
            <option value="">{t('workflows.defaultAgent')}</option>
            {agentOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {config.taskType === 'structured' && (
          <div>
            <label style={labelStyle}>{t('workflows.toolInputJson')}</label>
            <JsonEditor
              value={config.toolInput}
              onChange={(toolInput) => setConfig((c) => ({ ...c, toolInput }))}
              rows={6}
            />
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: 8 }}>
          <Button variant="primary" onClick={handleSave} style={{ width: '100%' }}>
            Save Config
          </Button>
        </div>
      </div>
    </div>
  )
}

export default NodeConfigPanel
