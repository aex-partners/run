import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { FileUpload } from './FileUpload'

const meta: Meta<typeof FileUpload> = {
  title: 'Atoms/FileUpload',
  component: FileUpload,
  tags: ['form-control'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    disabled: { control: 'boolean' },
    onChange: { action: 'fileSelected' },
  },
  args: { onChange: fn() },
}
export default meta
type Story = StoryObj<typeof FileUpload>

/** Empty state — upload icon with dashed border. */
export const Empty: Story = {
  args: { hint: 'Click to upload (PNG, JPG, max 2 MB)' },
}

/** With image preview — shows uploaded logo. */
export const WithPreview: Story = {
  args: {
    value: 'https://ui-avatars.com/api/?name=RUN&background=EA580C&color=fff&size=80',
    hint: 'Click to change',
  },
}

/** Disabled state — non-interactive. */
export const Disabled: Story = {
  args: { disabled: true, hint: 'Upload disabled' },
}
