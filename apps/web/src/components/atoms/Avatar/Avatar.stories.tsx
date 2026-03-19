import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { Avatar } from './Avatar'

const meta: Meta<typeof Avatar> = {
  title: 'Atoms/Avatar',
  component: Avatar,
  tags: ['display'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    online: { control: 'boolean' },
    onClick: { action: 'clicked' },
  },
}
export default meta
type Story = StoryObj<typeof Avatar>

/** Default avatar showing initials derived from a full name. */
export const Default: Story = { args: { name: 'Ana Lima', size: 'md' } }

/** Shows the online presence indicator dot. */
export const Online: Story = { args: { name: 'Carlos Mendes', size: 'md', online: true } }

/** Small size variant — 24 px diameter. */
export const Small: Story = { args: { name: 'Diana Rocha', size: 'sm' } }

/** Large size with the online indicator. */
export const Large: Story = { args: { name: 'Eduardo Faria', size: 'lg', online: true } }

/** Single-word name produces one initial. */
export const SingleName: Story = { args: { name: 'Gabriel', size: 'md' } }

/** Clickable avatar — hover shows accent ring; click fires the callback. */
export const Clickable: Story = { args: { name: 'Ana Lima', size: 'md', onClick: fn() } }

/**
 * Keyboard-accessible avatar: Tab to focus, then press Enter or Space to
 * activate. The element renders with role="button" and tabIndex=0.
 */
export const KeyboardAccessible: Story = {
  args: { name: 'Fernanda Costa', size: 'lg', online: true, onClick: fn() },
  parameters: {
    docs: {
      description: {
        story:
          'Tab to this avatar and press **Enter** or **Space** to trigger the onClick callback. The div receives `role="button"`, `tabIndex={0}`, and an `onKeyDown` handler.',
      },
    },
  },
}
