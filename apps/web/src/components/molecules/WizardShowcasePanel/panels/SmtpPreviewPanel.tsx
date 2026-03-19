import { Mail, Shield, Send, CheckCircle } from 'lucide-react'
import { t } from '../../../../locales/en'

const FEATURES = [
  { icon: <Send size={16} />, label: t.setup.showcase.smtp.feature1 },
  { icon: <Shield size={16} />, label: t.setup.showcase.smtp.feature2 },
  { icon: <CheckCircle size={16} />, label: t.setup.showcase.smtp.feature3 },
]

export function SmtpPreviewPanel() {
  return (
    <div
      data-testid="smtp-preview-panel"
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
          <Mail size={32} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{t.setup.showcase.smtp.title}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t.setup.showcase.smtp.description}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#fff', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                {f.icon}
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', textAlign: 'left' }}>{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SmtpPreviewPanel
