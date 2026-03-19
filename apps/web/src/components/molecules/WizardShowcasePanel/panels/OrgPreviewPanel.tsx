import React from 'react'
import { MessageSquare, Database, ListTodo, Workflow, Settings } from 'lucide-react'
import { t } from '../../../../locales/en'

export interface OrgPreviewPanelProps {
  orgName?: string
  orgLogo?: string
  accentColor?: string
}

const NAV_ITEMS = [
  { icon: <MessageSquare size={16} />, labelKey: 'navChat' as const, active: true },
  { icon: <Database size={16} />, labelKey: 'navDatabase' as const },
  { icon: <ListTodo size={16} />, labelKey: 'navTasks' as const },
  { icon: <Workflow size={16} />, labelKey: 'navWorkflows' as const },
  { icon: <Settings size={16} />, labelKey: 'navSettings' as const },
]

export function OrgPreviewPanel({ orgName, orgLogo, accentColor = '#EA580C' }: OrgPreviewPanelProps) {
  const displayName = orgName?.trim() || 'Your Company'
  const initials = displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div
      data-testid="org-preview-panel"
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
      <div
        style={{
          width: 260,
          background: '#fff',
          borderRadius: 14,
          border: '1px solid var(--border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}
      >
        {/* Sidebar header */}
        <div style={{ padding: '20px 16px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)' }}>
          {orgLogo ? (
            <img src={orgLogo} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: 8, background: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>
              {initials}
            </div>
          )}
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{displayName}</span>
        </div>

        {/* Nav items */}
        <div style={{ padding: '8px 8px 20px' }}>
          {NAV_ITEMS.map((item) => (
            <div
              key={item.labelKey}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 12px',
                borderRadius: 8,
                background: item.active ? `${accentColor}15` : 'transparent',
                color: item.active ? accentColor : 'var(--text-muted)',
                fontSize: 13,
                fontWeight: item.active ? 600 : 400,
                marginBottom: 2,
              }}
            >
              {item.icon}
              {t.setup.showcase.org[item.labelKey]}
            </div>
          ))}
        </div>

        {/* Placeholder content */}
        <div style={{ padding: '0 16px 20px' }}>
          {[0.9, 0.7, 0.5].map((w, i) => (
            <div key={i} style={{ height: 10, borderRadius: 4, background: 'var(--surface-2)', marginBottom: 8, width: `${w * 100}%` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default OrgPreviewPanel
