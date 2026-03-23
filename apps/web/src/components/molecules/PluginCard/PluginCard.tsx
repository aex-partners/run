import React from 'react'
import { Download, Settings, Star, Trash2, Wrench } from 'lucide-react'
import { Button } from '../../atoms/Button/Button'

export interface PluginCardProps {
  name: string
  description: string
  icon: React.ReactNode
  logoUrl?: string
  installed: boolean
  rating?: number
  category?: string
  version?: string
  enabled?: boolean
  installing?: boolean
  toolCount?: number
  onInstall?: () => void
  onConfigure?: () => void
  onUninstall?: () => void
  onToggle?: (enabled: boolean) => void
}

const CATEGORY_LABELS: Record<string, string> = {
  ARTIFICIAL_INTELLIGENCE: 'AI',
  COMMUNICATION: 'Communication',
  COMMERCE: 'Commerce',
  PRODUCTIVITY: 'Productivity',
  DEVELOPER_TOOLS: 'Dev Tools',
  SALES_AND_CRM: 'Sales & CRM',
  PAYMENT_PROCESSING: 'Payments',
  MARKETING: 'Marketing',
  CONTENT_AND_FILES: 'Content',
  CUSTOMER_SUPPORT: 'Support',
  FORMS_AND_SURVEYS: 'Forms',
  BUSINESS_INTELLIGENCE: 'Analytics',
  ACCOUNTING: 'Accounting',
  HUMAN_RESOURCES: 'HR',
  CORE: 'Core',
  FLOW_CONTROL: 'Flow Control',
  UNIVERSAL_AI: 'Universal AI',
}

export function PluginCard({
  name,
  description,
  icon,
  logoUrl,
  installed,
  rating,
  category,
  version,
  enabled = true,
  installing = false,
  toolCount,
  onInstall,
  onConfigure,
  onUninstall,
  onToggle,
}: PluginCardProps) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        background: 'var(--surface)',
        borderRadius: 10,
        border: '1px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      {/* Installing progress bar */}
      {installing && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 3,
            background: 'var(--border)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: '40%',
              background: 'var(--accent)',
              borderRadius: 3,
              animation: 'pluginInstallProgress 1.5s ease-in-out infinite',
            }}
          />
          <style>{`
            @keyframes pluginInstallProgress {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(350%); }
            }
          `}</style>
        </div>
      )}

      {logoUrl ? (
        <img
          src={logoUrl}
          alt={name}
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            objectFit: 'contain',
            flexShrink: 0,
          }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      ) : (
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: 'var(--accent)',
          }}
        >
          {icon}
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
          {version && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 10, border: '1px solid var(--border)' }}>
              v{version}
            </span>
          )}
          {category && (
            <span style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '1px 6px', borderRadius: 10, border: '1px solid var(--border)' }}>
              {CATEGORY_LABELS[category] ?? category}
            </span>
          )}
          {installing && (
            <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>
              Installing...
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{description}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {toolCount !== undefined && toolCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Wrench size={11} color="var(--text-muted)" />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{toolCount}</span>
          </div>
        )}
        {rating !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span aria-label={`${rating} out of 5 stars`} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Star size={11} fill="#f59e0b" color="#f59e0b" aria-hidden="true" />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{rating}</span>
            </span>
          </div>
        )}
        {installing ? null : installed ? (
          <>
            {onToggle && (
              <label style={{ position: 'relative', display: 'inline-block', width: 32, height: 18, flexShrink: 0 }}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => onToggle(e.target.checked)}
                  aria-label={`${enabled ? 'Disable' : 'Enable'} ${name}`}
                  style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                />
                <span
                  style={{
                    position: 'absolute', cursor: 'pointer', inset: 0, borderRadius: 18,
                    background: enabled ? 'var(--accent)' : 'var(--border)',
                    transition: 'background 0.2s',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute', height: 14, width: 14, left: enabled ? 15 : 3, bottom: 2,
                      background: '#fff', borderRadius: '50%', transition: 'left 0.2s',
                    }}
                  />
                </span>
              </label>
            )}
            <Button variant="secondary" size="sm" leftIcon={<Settings size={11} />} onClick={onConfigure} aria-label={`Connect ${name}`}>
              Connect
            </Button>
            {onUninstall && (
              <Button variant="danger" size="sm" leftIcon={<Trash2 size={11} />} onClick={onUninstall} aria-label={`Uninstall ${name}`}>
                Uninstall
              </Button>
            )}
          </>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Download size={11} />}
            onClick={onInstall}
            aria-label={`Install ${name}`}
          >
            Install
          </Button>
        )}
      </div>
    </div>
  )
}

export default PluginCard
