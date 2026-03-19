import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { Database } from 'lucide-react'
import { IconPicker } from './IconPicker'

const meta: Meta<typeof IconPicker> = {
  title: 'Organisms/IconPicker',
  component: IconPicker,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  args: {
    onSelect: fn(),
  },
}
export default meta
type Story = StoryObj<typeof IconPicker>

export const Default: Story = {
  render: (args) => {
    const [selected, setSelected] = useState('database')
    return (
      <IconPicker
        {...args}
        selectedIcon={selected}
        onSelect={(name) => {
          setSelected(name)
          args.onSelect(name)
        }}
      >
        <button style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          border: '1px solid var(--border)',
          borderRadius: 6,
          background: 'var(--surface)',
          cursor: 'pointer',
          fontSize: 13,
          fontFamily: 'inherit',
          color: 'var(--text)',
        }}>
          <Database size={14} />
          Choose icon
        </button>
      </IconPicker>
    )
  },
}
