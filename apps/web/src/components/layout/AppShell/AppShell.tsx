import React, { useEffect, useRef, useState } from 'react'
import {
  MessageSquare,
  Mail,
  HardDrive,
  Database,
  CheckSquare,
  GitBranch,
  Settings,
  LogOut,
} from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { Avatar } from '../../atoms/Avatar/Avatar'
import { NavItem } from '../../molecules/NavItem/NavItem'
import { Separator } from '../../atoms/Separator/Separator'
import { AexLogo } from '../../atoms/AexLogo/AexLogo'

export type Section = 'chat' | 'mail' | 'files' | 'database' | 'tasks' | 'workflows' | 'settings'

const navItems: Array<{ id: Section; icon: React.ReactNode; label: string }> = [
  { id: 'chat', icon: <MessageSquare size={20} />, label: 'Chat' },
  { id: 'mail', icon: <Mail size={20} />, label: 'Mail' },
  { id: 'files', icon: <HardDrive size={20} />, label: 'Files' },
  { id: 'database', icon: <Database size={20} />, label: 'Database' },
  { id: 'tasks', icon: <CheckSquare size={20} />, label: 'Tasks' },
  { id: 'workflows', icon: <GitBranch size={20} />, label: 'Workflows' },
  { id: 'settings', icon: <Settings size={20} />, label: 'Settings' },
]

export interface AppShellProps {
  activeSection?: Section
  onSectionChange?: (section: Section) => void
  children?: React.ReactNode
  /** Display name for the current user. Defaults to "Ana Lima" for development. */
  currentUser?: string
  currentUserEmail?: string
  currentUserRole?: string
  onLogout?: () => void
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
  onLogout,
  isOnline = true,
  tabBar,
}: AppShellProps) {
  const [internalSection, setInternalSection] = useState<Section>('chat')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const active = controlledSection ?? internalSection

  const handleNav = (section: Section) => {
    setInternalSection(section)
    onSectionChange?.(section)
  }

  useEffect(() => {
    if (!userMenuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [userMenuOpen])

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
                  label={item.label}
                  active={active === item.id}
                  onClick={() => handleNav(item.id)}
                />
              </div>
            ))}

          <div style={{ flex: 1 }} />

          {/* User avatar with dropdown */}
          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setUserMenuOpen((prev) => !prev)}
              aria-label="User menu"
              aria-expanded={userMenuOpen}
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
              <Avatar name={currentUser} size="sm" online={isOnline} />
            </button>

            {userMenuOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: 8,
                  width: 200,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                  zIndex: 100,
                  overflow: 'hidden',
                }}
              >
                <div role="none" style={{ padding: '10px 12px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {currentUser}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {currentUserEmail}
                  </div>
                </div>
                <Separator />
                <button
                  role="menuitem"
                  onClick={() => {
                    setUserMenuOpen(false)
                    onLogout?.()
                  }}
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
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'none'
                  }}
                >
                  <LogOut size={14} />
                  Log out
                </button>
              </div>
            )}
          </div>
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
