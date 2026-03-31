import React from 'react'
import {
  MessageSquare,
  Mail,
  HardDrive,
  Database,
  BookOpen,
  CheckSquare,
  GitBranch,
  Settings,
  X,
} from 'lucide-react'
import type { Section } from '../../layout/AppShell/AppShell'

const sectionMeta: Record<Section, { icon: React.ReactNode; label: string }> = {
  chat: { icon: <MessageSquare size={14} />, label: 'Chat' },
  mail: { icon: <Mail size={14} />, label: 'Mail' },
  files: { icon: <HardDrive size={14} />, label: 'Files' },
  knowledge: { icon: <BookOpen size={14} />, label: 'Knowledge' },
  database: { icon: <Database size={14} />, label: 'Database' },
  tasks: { icon: <CheckSquare size={14} />, label: 'Tasks' },
  workflows: { icon: <GitBranch size={14} />, label: 'Workflows' },
  settings: { icon: <Settings size={14} />, label: 'Settings' },
}

export interface TabBarProps {
  tabs: Section[]
  activeTab: Section
  onSelectTab: (tab: Section) => void
  onCloseTab: (tab: Section) => void
}

export function TabBar({ tabs, activeTab, onSelectTab, onCloseTab }: TabBarProps) {
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
          const meta = sectionMeta[tab]
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
                {meta.icon}
              </span>
              <span>{meta.label}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onCloseTab(tab)
                }}
                aria-label={`Close ${meta.label}`}
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
