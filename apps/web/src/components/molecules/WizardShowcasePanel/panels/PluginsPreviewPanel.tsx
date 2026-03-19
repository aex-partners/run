import React from 'react'
import { Puzzle, Zap, Globe, Mail, CreditCard, BarChart3 } from 'lucide-react'
import { t } from '../../../../locales/en'

const PREVIEW_PLUGINS = [
  { name: 'Stripe', icon: <CreditCard size={18} />, color: '#635BFF' },
  { name: 'Mailgun', icon: <Mail size={18} />, color: '#F06B54' },
  { name: 'Google Maps', icon: <Globe size={18} />, color: '#4285F4' },
  { name: 'Analytics', icon: <BarChart3 size={18} />, color: '#10B981' },
  { name: 'Zapier', icon: <Zap size={18} />, color: '#FF4A00' },
]

export function PluginsPreviewPanel() {
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
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{t.setup.showcase.plugins.title}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t.setup.showcase.plugins.description}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
          {PREVIEW_PLUGINS.map((plugin, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#fff', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: `${plugin.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: plugin.color, flexShrink: 0 }}>
                {plugin.icon}
              </div>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', flex: 1, textAlign: 'left' }}>{plugin.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '2px 8px', background: 'var(--surface-2)', borderRadius: 10 }}>{t.setup.showcase.plugins.available}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default PluginsPreviewPanel
