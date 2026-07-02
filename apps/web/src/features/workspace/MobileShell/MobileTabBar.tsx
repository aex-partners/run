// apps/web/src/components/layout/MobileShell/MobileTabBar.tsx
import React from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, CheckSquare, Mail, HardDrive, MoreHorizontal } from 'lucide-react'

/** The five fixed bottom-bar slots. "more" is a virtual slot opening the Mais sheet. */
export type MobileTab = 'chat' | 'tasks' | 'mail' | 'files' | 'more'

const TABS: Array<{ id: MobileTab; icon: React.ReactNode; labelKey: string }> = [
  { id: 'chat', icon: <MessageSquare size={22} />, labelKey: 'nav.chat' },
  { id: 'tasks', icon: <CheckSquare size={22} />, labelKey: 'nav.tasks' },
  { id: 'mail', icon: <Mail size={22} />, labelKey: 'nav.mail' },
  { id: 'files', icon: <HardDrive size={22} />, labelKey: 'nav.files' },
  { id: 'more', icon: <MoreHorizontal size={22} />, labelKey: 'nav.more' },
]

export interface MobileTabBarProps {
  /** The active section; maps to a tab, or to "more" when the section is an overflow one. */
  activeTab: MobileTab
  onSelect: (tab: MobileTab) => void
}

export function MobileTabBar({ activeTab, onSelect }: MobileTabBarProps) {
  const { t } = useTranslation()
  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'space-around',
        height: 56,
        flexShrink: 0,
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {TABS.map((tab) => {
        const active = tab.id === activeTab
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            aria-label={t(tab.labelKey)}
            aria-current={active ? 'page' : undefined}
            style={{
              flex: 1,
              minWidth: 44,
              minHeight: 44,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 10,
              fontWeight: active ? 700 : 500,
              color: active ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            {tab.icon}
            {t(tab.labelKey)}
          </button>
        )
      })}
    </nav>
  )
}

export default MobileTabBar
