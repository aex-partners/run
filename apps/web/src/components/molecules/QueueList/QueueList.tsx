import React from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import * as ScrollArea from '@radix-ui/react-scroll-area'
import { ChevronRight } from 'lucide-react'

export interface QueueItem {
  id: string
  content: string
  description?: string
  completed: boolean
}

export interface QueueSection {
  title: string
  items: QueueItem[]
}

export interface QueueListProps {
  sections: QueueSection[]
  defaultOpen?: boolean
}

export function QueueList({ sections, defaultOpen = false }: QueueListProps) {
  const [open, setOpen] = React.useState(defaultOpen)
  const totalItems = sections.reduce((acc, s) => acc + s.items.length, 0)

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen}>
      <Collapsible.Trigger asChild>
        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            color: 'var(--text-muted)',
            fontFamily: 'inherit',
            borderRadius: 6,
          }}
        >
          <span>Queue</span>
          <span
            style={{
              padding: '1px 6px',
              fontSize: 10,
              fontWeight: 500,
              background: 'var(--surface-2)',
              borderRadius: 10,
              color: 'var(--text-muted)',
            }}
          >
            {totalItems}
          </span>
          <ChevronRight
            size={12}
            style={{
              transition: 'transform 0.15s',
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          />
        </button>
      </Collapsible.Trigger>

      <Collapsible.Content>
        <ScrollArea.Root style={{ maxHeight: 240 }}>
          <ScrollArea.Viewport style={{ maxHeight: 240 }}>
            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sections.map((section) => (
                <SectionBlock key={section.title} section={section} />
              ))}
            </div>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar orientation="vertical" style={{ width: 4, padding: 1 }}>
            <ScrollArea.Thumb style={{ background: 'var(--border)', borderRadius: 2 }} />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

function SectionBlock({ section }: { section: QueueSection }) {
  const [sectionOpen, setSectionOpen] = React.useState(true)
  const completedCount = section.items.filter((i) => i.completed).length

  return (
    <Collapsible.Root open={sectionOpen} onOpenChange={setSectionOpen}>
      <Collapsible.Trigger asChild>
        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '2px 4px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text)',
            fontFamily: 'inherit',
          }}
        >
          <ChevronRight
            size={10}
            style={{
              transition: 'transform 0.15s',
              transform: sectionOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          />
          {section.title}
          <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
            ({completedCount}/{section.items.length})
          </span>
        </button>
      </Collapsible.Trigger>

      <Collapsible.Content>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 14, paddingTop: 4 }}>
          {section.items.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                opacity: item.completed ? 0.5 : 1,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: item.completed ? 'var(--success)' : 'var(--text-muted)',
                  flexShrink: 0,
                  marginTop: 5,
                }}
              />
              <div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text)',
                    textDecoration: item.completed ? 'line-through' : 'none',
                    lineHeight: 1.4,
                  }}
                >
                  {item.content}
                </div>
                {item.description && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {item.description}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}

export default QueueList
