import React from 'react'
import { Puzzle, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { trpc } from '../../../../lib/trpc'

interface CatalogEntry {
  id: string
  displayName: string
  category: string
  logoUrl: string
}

export interface PluginsPreviewPanelProps {
  selectedPlugins?: string[]
}

export function PluginsPreviewPanel({ selectedPlugins = [] }: PluginsPreviewPanelProps) {
  const { t } = useTranslation()
  const { data } = trpc.plugins.catalog.useQuery(undefined, { staleTime: Infinity })
  const catalog = (data ?? []) as CatalogEntry[]

  // Show selected plugins, or a few popular ones if none selected
  const displayPlugins = selectedPlugins.length > 0
    ? catalog.filter((p) => selectedPlugins.includes(p.id)).slice(0, 8)
    : catalog.filter((p) => ['piece-slack', 'piece-openai', 'piece-google-sheets', 'piece-stripe', 'piece-notion'].includes(p.id))

  return (
    <div
      data-testid="plugins-preview-panel"
      style={{
        flex: 1,
        background: 'var(--accent-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        minHeight: 0,
      }}
    >
      <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), #9a3412)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Puzzle size={32} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
            {selectedPlugins.length > 0
              ? `${selectedPlugins.length} ${selectedPlugins.length === 1 ? 'plugin' : 'plugins'} selected`
              : t('setup.showcase.plugins.title')
            }
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('setup.showcase.plugins.description')}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          {displayPlugins.map((plugin) => {
            const isSelected = selectedPlugins.includes(plugin.id)
            return (
              <div key={plugin.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#fff', borderRadius: 10, border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)' }}>
                {isSelected ? (
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: 'var(--accent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Check size={16} color="#fff" />
                  </div>
                ) : (
                  <img
                    src={plugin.logoUrl}
                    alt={plugin.displayName}
                    style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'contain', flexShrink: 0 }}
                  />
                )}
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', flex: 1, textAlign: 'left' }}>{plugin.displayName}</span>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 10,
                  color: isSelected ? '#fff' : 'var(--text-muted)',
                  background: isSelected ? 'var(--accent)' : 'var(--surface-2)',
                }}>
                  {isSelected ? 'Selected' : t('setup.showcase.plugins.available')}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default PluginsPreviewPanel
