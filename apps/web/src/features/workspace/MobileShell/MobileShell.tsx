// apps/web/src/components/layout/MobileShell/MobileShell.tsx
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Database, BookOpen, GitBranch, Settings, LogOut, User, X } from 'lucide-react'
import type { Section } from '../AppShell/AppShell'
import { MobileTabBar, type MobileTab } from './MobileTabBar'

/** Sections that live in their own bottom-bar slot. Everything else falls under "more". */
const PRIMARY_SECTIONS: Section[] = ['chat', 'tasks', 'mail', 'files']

/** Map a Section to the bottom-bar tab that should appear active for it. */
// eslint-disable-next-line react-refresh/only-export-components
export function sectionToTab(section: Section): MobileTab {
  return (PRIMARY_SECTIONS as string[]).includes(section) ? (section as MobileTab) : 'more'
}

/** Map a bottom-bar tab to the Section to navigate to. "more" returns null (opens the sheet). */
// eslint-disable-next-line react-refresh/only-export-components
export function tabToSection(tab: MobileTab): Section | null {
  return tab === 'more' ? null : (tab as Section)
}

const MORE_ITEMS: Array<{ id: Section; icon: React.ReactNode; labelKey: string; adminOnly?: boolean }> = [
  { id: 'profile', icon: <User size={18} />, labelKey: 'profile.menuItem' },
  { id: 'database', icon: <Database size={18} />, labelKey: 'nav.database' },
  { id: 'knowledge', icon: <BookOpen size={18} />, labelKey: 'nav.knowledge' },
  { id: 'workflows', icon: <GitBranch size={18} />, labelKey: 'nav.workflows' },
  { id: 'settings', icon: <Settings size={18} />, labelKey: 'nav.settings', adminOnly: true },
]

export interface MobileShellProps {
  activeSection: Section
  onSectionChange: (section: Section) => void
  currentUser: string
  currentUserEmail: string
  currentUserRole: string
  onLogout: () => void
  children: React.ReactNode
}

export function MobileShell({
  activeSection,
  onSectionChange,
  currentUser,
  currentUserEmail,
  currentUserRole,
  onLogout,
  children,
}: MobileShellProps) {
  const { t } = useTranslation()
  const [sheetOpen, setSheetOpen] = useState(false)
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner'

  const handleTab = (tab: MobileTab) => {
    const section = tabToSection(tab)
    if (section === null) {
      setSheetOpen(true)
      return
    }
    setSheetOpen(false)
    onSectionChange(section)
  }

  const pickFromSheet = (section: Section) => {
    setSheetOpen(false)
    onSectionChange(section)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100%',
        background: 'var(--background)',
        overflow: 'hidden',
      }}
    >
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </main>

      <MobileTabBar activeTab={sectionToTab(activeSection)} onSelect={handleTab} />

      {sheetOpen && (
        <div
          onClick={() => setSheetOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              background: 'var(--surface)',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{t('nav.more')}</span>
              <button
                onClick={() => setSheetOpen(false)}
                aria-label={t('chat.back')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            {MORE_ITEMS.filter((item) => !item.adminOnly || isAdmin).map((item) => (
              <button
                key={item.id}
                onClick={() => pickFromSheet(item.id)}
                style={{
                  width: '100%',
                  minHeight: 48,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: activeSection === item.id ? 'var(--accent-light)' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 14,
                  color: activeSection === item.id ? 'var(--accent)' : 'var(--text)',
                  textAlign: 'left',
                  padding: '0 8px',
                  borderRadius: 8,
                }}
              >
                {item.icon}
                {t(item.labelKey)}
              </button>
            ))}

            <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />

            <div style={{ padding: '4px 8px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{currentUser}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{currentUserEmail}</div>
            </div>
            <button
              onClick={onLogout}
              style={{
                width: '100%',
                minHeight: 48,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 14,
                color: 'var(--text)',
                textAlign: 'left',
                padding: '0 8px',
              }}
            >
              <LogOut size={18} />
              {t('auth.logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MobileShell
