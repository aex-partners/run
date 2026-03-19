import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { ShoppingBag, Heart, Cpu } from 'lucide-react'
import { ChipSelect } from './ChipSelect'

const meta: Meta<typeof ChipSelect> = {
  title: 'Atoms/ChipSelect',
  component: ChipSelect,
  tags: ['form-control'],
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    multiple: { control: 'boolean' },
    label: { control: 'text' },
    error: { control: 'text' },
    onChange: { action: 'changed' },
  },
  args: { onChange: fn() },
}
export default meta
type Story = StoryObj<typeof ChipSelect>

const basicOptions = [
  { value: 'sales', label: 'Sales' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'design', label: 'Design' },
]

/** Single select mode, one chip active at a time. */
export const SingleSelect: Story = {
  args: {
    options: basicOptions,
    value: 'sales',
    label: 'Department',
  },
}

/** Multiple select mode, toggle chips on and off. */
export const MultiSelect: Story = {
  args: {
    options: basicOptions,
    value: ['sales', 'engineering'],
    multiple: true,
    label: 'Departments',
  },
}

/** Chips with Lucide icons. */
export const WithIcons: Story = {
  args: {
    options: [
      { value: 'shopping', label: 'Shopping', icon: <ShoppingBag size={14} /> },
      { value: 'favorites', label: 'Favorites', icon: <Heart size={14} /> },
      { value: 'tech', label: 'Technology', icon: <Cpu size={14} /> },
    ],
    value: 'favorites',
    label: 'Category',
  },
}

/** Displaying a validation error message. */
export const WithError: Story = {
  args: {
    options: basicOptions,
    value: '',
    label: 'Department',
    error: 'Please select at least one department',
  },
}
