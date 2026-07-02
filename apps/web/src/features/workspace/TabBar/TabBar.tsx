import React from 'react'
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
  User,
  X,
} from 'lucide-react'
import type { Section } from '../AppShell/AppShell'

const sectionIcon: Record<Section, React.ReactNode> = {
  chat: <MessageSquare size={14} />,
  mail: <Mail size={14} />,
  files: <HardDrive size={14} />,
  knowledge: <BookOpen size={14} />,
  database: <Database size={14} />,
  tasks: <CheckSquare size={14} />,
  workflows: <GitBranch size={14} />,
  settings: <Settings size={14} />,
  profile: <User size={14} />,
  docs: <BookOpen size={14} />,
}

export interface TabBarProps {
  tabs: Section[]
  activeTab: Section
  onSelectTab: (tab: Section) => void
  onCloseTab: (tab: Section) => void
}

export function TabBar({ tabs, activeTab, onSelectTab, onCloseTab }: TabBarProps) {
  const { t } = useTranslation()

  if (tabs.length <= 1) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        height: 36,
        minHeight: 36,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          overflow: 'auto',
          scrollbarWidth: 'none',
          flex: 1,
        }}
      >
        {tabs.map((tab) => {
          const label = t(`nav.${tab}`)
          const isActive = tab === activeTab

          return (
            <div
              key={tab}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 12px',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                background: isActive ? 'var(--background)' : 'transparent',
                borderRight: '1px solid var(--border)',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'all 0.15s',
                userSelect: 'none',
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
              onClick={() => onSelectTab(tab)}
            >
              <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {sectionIcon[tab]}
              </span>
              <span>{label}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onCloseTab(tab)
                }}
                aria-label={t('tabBar.closeTab', { label })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  border: 'none',
                  background: 'transparent',
                  color: isActive ? 'var(--text-muted)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  marginLeft: 2,
                  flexShrink: 0,
                  opacity: 0.5,
                  transition: 'opacity 0.15s, background 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1'
                  e.currentTarget.style.background = 'var(--surface-2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.5'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <X size={12} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
