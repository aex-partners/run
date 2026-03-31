import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  MessageSquare, Database, Zap, BarChart3, Users, ShieldCheck,
  Bell, CheckCircle2, TrendingUp, Package, FileText, Bot,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface NotificationItem {
  id: number
  icon: React.ReactNode
  title: string
  description: string
  time: string
  accent?: boolean
}

const NOTIFICATIONS: Omit<NotificationItem, 'id'>[] = [
  { icon: <Bot size={16} />, title: 'AI Agent', description: 'Invoice #1042 approved automatically', time: '2s ago', accent: true },
  { icon: <MessageSquare size={16} />, title: 'New message', description: 'Ana: "The Q4 report is ready"', time: '15s ago' },
  { icon: <CheckCircle2 size={16} />, title: 'Task completed', description: 'Stock count finished for warehouse A', time: '1m ago' },
  { icon: <TrendingUp size={16} />, title: 'Sales update', description: 'Revenue up 12% this week', time: '3m ago', accent: true },
  { icon: <Database size={16} />, title: 'Schema created', description: 'New entity "Suppliers" with 8 fields', time: '5m ago' },
  { icon: <Bell size={16} />, title: 'Reminder', description: 'Team meeting starts in 30 minutes', time: '8m ago' },
  { icon: <Package size={16} />, title: 'Low stock alert', description: 'Widget Pro below minimum threshold', time: '12m ago', accent: true },
  { icon: <FileText size={16} />, title: 'Document signed', description: 'Contract #287 signed by all parties', time: '15m ago' },
  { icon: <Users size={16} />, title: 'New lead', description: 'Carlos from TechCorp requested a demo', time: '20m ago' },
  { icon: <Zap size={16} />, title: 'Workflow triggered', description: 'Auto-send welcome email completed', time: '25m ago', accent: true },
  { icon: <ShieldCheck size={16} />, title: 'Compliance', description: 'Monthly audit report generated', time: '30m ago' },
  { icon: <BarChart3 size={16} />, title: 'Dashboard', description: 'KPI dashboard updated with latest data', time: '35m ago' },
]

export function WelcomePanel() {
  const { t } = useTranslation()
  const MAX_ITEMS = 5
  const [items, setItems] = useState<NotificationItem[]>(() =>
    NOTIFICATIONS.slice(0, 2).map((n, i) => ({ ...n, id: i }))
  )

  useEffect(() => {
    let next = 2
    const interval = setInterval(() => {
      if (next >= MAX_ITEMS) {
        clearInterval(interval)
        return
      }
      setItems((current) => [...current, { ...NOTIFICATIONS[next], id: next }])
      next++
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      style={{
        flex: 1,
        background: 'linear-gradient(135deg, var(--accent) 0%, #C4490A 50%, #9a3412 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 32,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0)`,
          backgroundSize: '24px 24px',
        }}
      />
      <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', top: -80, right: -60, filter: 'blur(60px)' }} />
      <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', bottom: -40, left: -40, filter: 'blur(40px)' }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400, margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1.25 }}>
            {t('setup.showcase.welcome.tagline').split(',').map((part, i) => (
              <React.Fragment key={i}>
                {i > 0 && <><br /></>}
                {part}{i === 0 ? ',' : ''}
              </React.Fragment>
            ))}
          </h2>
          <p style={{ margin: '14px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
            {t('setup.showcase.welcome.subtitle')}
          </p>
        </div>

        <div
          style={{
            background: 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(12px)',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.15)',
            padding: 16,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
            {t('setup.showcase.welcome.liveActivity')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
            {items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={index === 0 ? { opacity: 0, y: -16 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: item.accent ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.12)',
                  border: item.accent ? '1px solid rgba(255,255,255,0.28)' : '1px solid rgba(255,255,255,0.14)',
                }}
              >
                <div style={{ width: 30, height: 30, borderRadius: 7, background: item.accent ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.description}</div>
                </div>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', flexShrink: 0 }}>{item.time}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default WelcomePanel
