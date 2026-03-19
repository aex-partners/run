import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { FormBuilder } from '../FormBuilder/FormBuilder'

const mockEntityFields = [
  { id: 'f1', name: 'Company Name', slug: 'company_name', type: 'text' },
  { id: 'f2', name: 'Contact Email', slug: 'contact_email', type: 'email' },
  { id: 'f3', name: 'Phone', slug: 'phone', type: 'phone' },
  { id: 'f4', name: 'Annual Revenue', slug: 'annual_revenue', type: 'number' },
  { id: 'f5', name: 'Active', slug: 'active', type: 'checkbox' },
]

const mockFormFields = mockEntityFields.map((ef, i) => ({
  id: `ff-${i}`,
  entityFieldId: ef.id,
  order: i,
  required: i < 2,
  visible: true,
  placeholder: i === 0 ? 'Acme Corp' : undefined,
  helpText: i === 1 ? 'Business email preferred' : undefined,
}))

const meta: Meta<typeof FormBuilder> = {
  title: 'Organisms/FormBuilder',
  component: FormBuilder,
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  args: {
    formId: 'form-1',
    formName: 'Customer Registration',
    fields: mockFormFields,
    entityFields: mockEntityFields,
    settings: {
      submitButtonText: 'Submit',
      successMessage: 'Thank you for your submission.',
      title: 'Customer Registration',
      description: 'Fill in the details below.',
    },
    isPublic: true,
    publicToken: 'abc-123-def',
    submissionCount: 14,
    onFieldsChange: fn(),
    onSettingsChange: fn(),
    onTogglePublic: fn(),
  },
  decorators: [(Story) => <div style={{ height: 700 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof FormBuilder>

export const Default: Story = {}

export const EmptyForm: Story = {
  args: {
    fields: [],
    submissionCount: 0,
    isPublic: false,
    publicToken: null,
  },
}
