import type { Meta, StoryObj } from '@storybook/react'
import { AexLogo } from './AexLogo'

const meta: Meta<typeof AexLogo> = {
  title: 'Atoms/AexLogo',
  component: AexLogo,
  tags: ['display'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    size: { control: { type: 'range', min: 16, max: 80, step: 4 } },
    variant: { control: 'select', options: ['default', 'orange', 'black', 'white'] },
  },
}
export default meta
type Story = StoryObj<typeof AexLogo>

/** Default variant: black text with orange accent on the X chevron. */
export const Default: Story = { args: { size: 40 } }

/** Small size for nav bars and compact UI. */
export const Small: Story = { args: { size: 20 } }

/** Large size for hero and splash screens. */
export const Large: Story = { args: { size: 56 } }

/** All orange — monochrome brand variant. */
export const Orange: Story = { args: { size: 40, variant: 'orange' } }

/** All black — for print and formal use. */
export const Black: Story = { args: { size: 40, variant: 'black' } }

/** All white — for dark or accent backgrounds. */
export const White: Story = {
  args: { size: 40, variant: 'white' },
  parameters: {
    backgrounds: { default: 'dark', values: [{ name: 'dark', value: '#111827' }] },
  },
}
