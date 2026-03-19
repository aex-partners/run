import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import {
  Database, Users, ShoppingCart, Package, FileText, Briefcase,
  Building2, CreditCard, BarChart3, Calendar, Tag, Star,
  Heart, Zap, Globe, Layers, Box, Truck, Settings, Bell,
  Mail, Phone, MapPin, Clock, Flag, Bookmark, Archive,
  Folder, Grid3X3, List, Target, Award, Shield,
} from 'lucide-react'

const ICONS = [
  { name: 'database', icon: Database },
  { name: 'users', icon: Users },
  { name: 'shopping-cart', icon: ShoppingCart },
  { name: 'package', icon: Package },
  { name: 'file-text', icon: FileText },
  { name: 'briefcase', icon: Briefcase },
  { name: 'building', icon: Building2 },
  { name: 'credit-card', icon: CreditCard },
  { name: 'bar-chart', icon: BarChart3 },
  { name: 'calendar', icon: Calendar },
  { name: 'tag', icon: Tag },
  { name: 'star', icon: Star },
  { name: 'heart', icon: Heart },
  { name: 'zap', icon: Zap },
  { name: 'globe', icon: Globe },
  { name: 'layers', icon: Layers },
  { name: 'box', icon: Box },
  { name: 'truck', icon: Truck },
  { name: 'settings', icon: Settings },
  { name: 'bell', icon: Bell },
  { name: 'mail', icon: Mail },
  { name: 'phone', icon: Phone },
  { name: 'map-pin', icon: MapPin },
  { name: 'clock', icon: Clock },
  { name: 'flag', icon: Flag },
  { name: 'bookmark', icon: Bookmark },
  { name: 'archive', icon: Archive },
  { name: 'folder', icon: Folder },
  { name: 'grid', icon: Grid3X3 },
  { name: 'list', icon: List },
  { name: 'target', icon: Target },
  { name: 'award', icon: Award },
  { name: 'shield', icon: Shield },
]

export interface IconPickerProps {
  selectedIcon?: string
  onSelect: (iconName: string) => void
  children: React.ReactNode
}

export function IconPicker({ selectedIcon, onSelect, children }: IconPickerProps) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const filteredIcons = search
    ? ICONS.filter(i => i.name.includes(search.toLowerCase()))
    : ICONS

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            zIndex: 200,
            width: 260,
            padding: '8px',
          }}
        >
          <input
            placeholder="Search icons..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 12,
              color: 'var(--text)',
              background: 'var(--surface-2)',
              fontFamily: 'inherit',
              outline: 'none',
              marginBottom: 8,
              boxSizing: 'border-box',
            }}
          />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 2,
            maxHeight: 200,
            overflow: 'auto',
          }}>
            {filteredIcons.map(({ name, icon: Icon }) => (
              <button
                key={name}
                onClick={() => {
                  onSelect(name)
                  setOpen(false)
                }}
                title={name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: selectedIcon === name ? 'var(--accent-light)' : 'transparent',
                  color: selectedIcon === name ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
          {filteredIcons.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
              No icons found
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
