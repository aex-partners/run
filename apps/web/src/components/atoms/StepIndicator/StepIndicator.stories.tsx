import type { Meta, StoryObj } from '@storybook/react'
import { StepIndicator } from './StepIndicator'

const STEPS = [
  { label: 'Account' },
  { label: 'Organization' },
  { label: 'Details' },
  { label: 'Preferences' },
  { label: 'Team' },
]

const meta: Meta<typeof StepIndicator> = {
  title: 'Atoms/StepIndicator',
  component: StepIndicator,
  tags: ['onboarding'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    currentStep: { control: { type: 'range', min: 0, max: 4, step: 1 } },
  },
  decorators: [(Story) => <div style={{ width: 500 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof StepIndicator>

/** First step active, none completed. */
export const FirstStep: Story = { args: { steps: STEPS, currentStep: 0 } }

/** Middle step active, first two completed. */
export const MiddleStep: Story = { args: { steps: STEPS, currentStep: 2 } }

/** Last step active, all previous completed. */
export const LastStep: Story = { args: { steps: STEPS, currentStep: 4 } }

/** All steps completed (currentStep beyond last index). */
export const AllCompleted: Story = { args: { steps: STEPS, currentStep: 5 } }
