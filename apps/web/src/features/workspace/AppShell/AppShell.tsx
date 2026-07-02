import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MessageSquare,
  Mail,
  HardDrive,
  Database,
  BookOpen,
  CheckSquare,
  GitBranch,
  Settings,
  LogOut,
  User,
} from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Avatar } from '../../../shared/ui/Avatar/Avatar'
import { NavItem } from '../NavItem/NavItem'
import { NotificationBadge } from '../NotificationBadge/NotificationBadge'
import { Separator } from '../../../shared/ui/Separator/Separator'
import { AexLogo } from '../../../shared/ui/AexLogo/AexLogo'

export type Section = 'chat' | 'mail' | 'files' | 'knowledge' | 'database' | 'tasks' | 'workflows' | 'settings' | 'profile' | 'docs'

const navItems: Array<{ id: Section; icon: React.ReactNode }> = [
  { id: 'chat', icon: <MessageSquare size={20} /> },
  { id: 'mail', icon: <Mail size={20} /> },
  { id: 'files', icon: <HardDrive size={20} /> },
  { id: 'knowledge', icon: <BookOpen size={20} /> },
  { id: 'database', icon: <Database size={20} /> },
  { id: 'tasks', icon: <CheckSquare size={20} /> },
  { id: 'workflows', icon: <GitBranch size={20} /> },
  { id: 'settings', icon: <Settings size={20} /> },
]

export interface AppShellProps {
  activeSection?: Section
  onSectionChange?: (section: Section) => void
  children?: React.ReactNode
  /** Display name for the current user. Defaults to "Ana Lima" for development. */
  currentUser?: string
  currentUserEmail?: string
  currentUserRole?: string
  /** Avatar image URL for the current user. Falls back to initials when absent. */
  currentUserImage?: string | null
  onLogout?: () => void
  /** Opens the self-service profile section (from the user menu). */
  onOpenProfile?: () => void
  /** Whether the user is shown as online in the avatar. Defaults to true. */
  isOnline?: boolean
  /** Optional tab bar rendered above the main content area */
  tabBar?: React.ReactNode
}

export function AppShell({
  activeSection: controlledSection,
  onSectionChange,
  children,
  currentUser = 'Ana Lima',
  currentUserEmail = 'user@aex.app',
  currentUserRole = 'user',
  currentUserImage = null,
  onLogout,
  onOpenProfile,
  isOnline = true,
  tabBar,
}: AppShellProps) {
  const { t } = useTranslation()
  const [internalSection, setInternalSection] = useState<Section>('chat')

  const active = controlledSection ?? internalSection

  const handleNav = (section: Section) => {
    setInternalSection(section)
    onSectionChange?.(section)
  }

  return (
    <Tooltip.Provider delayDuration={300}>
      <div
        style={{
          display: 'flex',
          height: '100vh',
          width: '100%',
          background: 'var(--background)',
          overflow: 'hidden',
        }}
      >
        {/* Left nav bar */}
        <nav
          style={{
            width: 56,
            minWidth: 56,
            background: 'var(--surface)',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 16,
            paddingBottom: 16,
            gap: 4,
          }}
        >
          {/* Logo */}
          <div
            style={{
              width: 32,
              height: 32,
              marginBottom: 16,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AexLogo size={28} />
          </div>

          {navItems
            .filter((item) => item.id !== 'settings' || currentUserRole === 'admin' || currentUserRole === 'owner')
            .map((item) => (
              <div key={item.id} data-tour={`nav-${item.id}`}>
                <NavItem
                  icon={item.icon}
                  label={t(`nav.${item.id}`)}
                  active={active === item.id}
                  onClick={() => handleNav(item.id)}
                />
              </div>
            ))}

          <div style={{ flex: 1 }} />

          {/* Notifications */}
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
            <NotificationBadge side="right" align="end" />
          </div>

          {/* User avatar with dropdown */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                aria-label={t('appShell.userMenu')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                }}
              >
                <Avatar name={currentUser} image={currentUserImage} size="sm" online={isOnline} />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                side="top"
                align="center"
                sideOffset={8}
                style={{
                  width: 200,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                  zIndex: 100,
                  outline: 'none',
                }}
              >
                <div style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {currentUser}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {currentUserEmail}
                  </div>
                </div>
                <Separator />
                <DropdownMenu.Item
                  onSelect={() => onOpenProfile?.()}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: 'var(--text)',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    outline: 'none',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLDivElement).style.background = 'none'
                  }}
                >
                  <User size={14} />
                  {t('profile.menuItem')}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => handleNav('docs')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: 'var(--text)',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    outline: 'none',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLDivElement).style.background = 'none'
                  }}
                >
                  <BookOpen size={14} />
                  {t('nav.docs')}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => onLogout?.()}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: 'var(--text)',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    outline: 'none',
                    borderRadius: '0 0 8px 8px',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLDivElement).style.background = 'none'
                  }}
                >
                  <LogOut size={14} />
                  {t('auth.logout')}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </nav>

        {/* Main content */}
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--background)',
          }}
        >
          {tabBar}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {children}
          </div>
        </main>
      </div>
    </Tooltip.Provider>
  )
}

export default AppShell
