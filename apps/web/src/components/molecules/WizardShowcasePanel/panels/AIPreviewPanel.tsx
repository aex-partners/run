import { useMemo } from 'react'
import { Bot, Cloud, Server, Cpu, HardDrive, Clock, Gauge, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export type AIProvider = 'openai' | 'ollama' | null
export type OllamaModel = 'qwen3:72b' | 'qwen3:14b' | 'qwen3:8b' | 'llama3.1:8b' | null

export interface AIPreviewPanelProps {
  provider: AIProvider
  ollamaModel: OllamaModel
}

function SpecRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#fff', borderRadius: 10, border: '1px solid var(--border)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
      </div>
    </div>
  )
}

function QualityBar({ percent, label, qualityLabel }: { percent: number; label: string; qualityLabel: string }) {
  const color = percent >= 85 ? '#00c875' : percent >= 65 ? 'var(--accent)' : '#fdab3d'
  return (
    <div style={{ padding: '10px 14px', background: '#fff', borderRadius: 10, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Gauge size={14} color="var(--accent)" />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{qualityLabel}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{label}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${percent}%`, borderRadius: 3, background: color, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

export function AIPreviewPanel({ provider, ollamaModel }: AIPreviewPanelProps) {
  const { t } = useTranslation()

  const MODEL_SPECS = useMemo(() => ({
    'qwen3:72b': {
      label: 'Qwen 3 72B',
      vram: '48 GB+',
      ram: '64 GB',
      disk: '~42 GB',
      download: '~25 min (100 Mbps)',
      quality: 90,
      qualityLabel: '~90%',
      tag: t('setup.showcase.ai.bestQuality'),
      tagColor: '#00c875',
    },
    'qwen3:14b': {
      label: 'Qwen 3 14B',
      vram: '12-16 GB',
      ram: '24 GB',
      disk: '~9 GB',
      download: '~6 min (100 Mbps)',
      quality: 70,
      qualityLabel: '~70%',
      tag: t('setup.showcase.ai.recommended'),
      tagColor: 'var(--accent)',
    },
    'qwen3:8b': {
      label: 'Qwen 3 8B',
      vram: '8-10 GB',
      ram: '16 GB',
      disk: '~5 GB',
      download: '~3 min (100 Mbps)',
      quality: 65,
      qualityLabel: '~65%',
      tag: t('setup.showcase.ai.budgetFriendly'),
      tagColor: '#fdab3d',
    },
    'llama3.1:8b': {
      label: 'Llama 3.1 8B',
      vram: '8-10 GB',
      ram: '16 GB',
      disk: '~4.7 GB',
      download: '~3 min (100 Mbps)',
      quality: 60,
      qualityLabel: '~60%',
      tag: t('setup.showcase.ai.minimalSetup'),
      tagColor: '#fdab3d',
    },
  }), [t])

  const spec = ollamaModel ? MODEL_SPECS[ollamaModel] : null

  return (
    <div
      data-testid="ai-preview-panel"
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
      <div style={{ width: '100%', maxWidth: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), #9a3412)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Bot size={32} color="#fff" />
        </div>

        {/* No provider selected */}
        {!provider && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{t('setup.showcase.ai.title')}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('setup.showcase.ai.description')}</div>
          </div>
        )}

        {/* OpenAI selected */}
        {provider === 'openai' && (
          <>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{t('setup.showcase.ai.openaiTitle')}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('setup.showcase.ai.openaiDesc')}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#fff', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                  <Cloud size={16} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', textAlign: 'left' }}>{t('setup.showcase.ai.cloudHosted')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#fff', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                  <CheckCircle2 size={16} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', textAlign: 'left' }}>{t('setup.showcase.ai.fullToolCalling')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#fff', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                  <Gauge size={16} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', textAlign: 'left' }}>{t('setup.showcase.ai.payPerUse')}</span>
              </div>
            </div>
            <QualityBar percent={100} label="100%" qualityLabel={t('setup.showcase.ai.quality')} />
          </>
        )}

        {/* Ollama selected but no model yet */}
        {provider === 'ollama' && !spec && (
          <>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{t('setup.showcase.ai.ollamaTitle')}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('setup.showcase.ai.ollamaDesc')}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: '#fffbeb', borderRadius: 10, border: '1px solid #fde68a', width: '100%' }}>
              <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#92400e', lineHeight: 1.4, textAlign: 'left' }}>
                {t('setup.showcase.ai.selectModelHint')}
              </span>
            </div>
          </>
        )}

        {/* Ollama with model selected */}
        {provider === 'ollama' && spec && (
          <>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{spec.label}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: '#fff', background: spec.tagColor, padding: '2px 8px', borderRadius: 10 }}>{spec.tag}</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', textAlign: 'left' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{t('setup.showcase.ai.requirements')}</div>
              <SpecRow icon={<Cpu size={16} />} label={t('setup.showcase.ai.vram')} value={spec.vram} />
              <SpecRow icon={<Server size={16} />} label={t('setup.showcase.ai.ram')} value={spec.ram} />
              <SpecRow icon={<HardDrive size={16} />} label={t('setup.showcase.ai.disk')} value={spec.disk} />
              <SpecRow icon={<Clock size={16} />} label={t('setup.showcase.ai.downloadTime')} value={spec.download} />
            </div>

            <QualityBar percent={spec.quality} label={spec.qualityLabel} qualityLabel={t('setup.showcase.ai.quality')} />
          </>
        )}
      </div>
    </div>
  )
}

export default AIPreviewPanel
