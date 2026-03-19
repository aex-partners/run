import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { NewWorkspaceWizard } from './NewWorkspaceWizard'

const meta: Meta<typeof NewWorkspaceWizard> = {
  title: 'Screens/NewWorkspaceWizard',
  component: NewWorkspaceWizard,
  tags: ['wizard', 'setup'],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    onSubmit: fn(),
  },
}
export default meta
type Story = StoryObj<typeof NewWorkspaceWizard>

export const Default: Story = {}

export const Step1_Account: Story = {
  name: '1. Account',
  args: {
    initialStep: 0,
  },
}

export const Step2_Organization: Story = {
  name: '2. Organization',
  args: {
    initialStep: 1,
    initialData: {
      name: 'John Doe',
      email: 'john@acme.com',
      password: 'Str0ng!Pass',
      confirmPassword: 'Str0ng!Pass',
    },
  },
}

export const Step3_Details: Story = {
  name: '3. Business Details',
  args: {
    initialStep: 2,
    initialData: {
      name: 'John Doe',
      email: 'john@acme.com',
      password: 'Str0ng!Pass',
      confirmPassword: 'Str0ng!Pass',
      orgName: 'Acme Corp',
      accentColor: '#EA580C',
    },
  },
}

export const Step4_Preferences: Story = {
  name: '4. Preferences',
  args: {
    initialStep: 3,
    initialData: {
      name: 'John Doe',
      email: 'john@acme.com',
      password: 'Str0ng!Pass',
      confirmPassword: 'Str0ng!Pass',
      orgName: 'Acme Corp',
      niche: 'retail',
    },
  },
}

export const Step5_Team: Story = {
  name: '5. Team',
  args: {
    initialStep: 4,
    initialData: {
      name: 'John Doe',
      email: 'john@acme.com',
      password: 'Str0ng!Pass',
      confirmPassword: 'Str0ng!Pass',
      orgName: 'Acme Corp',
      niche: 'retail',
      country: 'BR',
      language: 'pt-BR',
      timezone: 'America/Sao_Paulo',
    },
  },
}

export const Step6_Path: Story = {
  name: '6. Onboarding Path',
  args: {
    initialStep: 5,
    initialData: {
      name: 'John Doe',
      email: 'john@acme.com',
      password: 'Str0ng!Pass',
      confirmPassword: 'Str0ng!Pass',
      orgName: 'Acme Corp',
      niche: 'retail',
      country: 'BR',
      language: 'pt-BR',
      timezone: 'America/Sao_Paulo',
    },
  },
}

export const Step7_Routines: Story = {
  name: '7. Routines',
  args: {
    initialStep: 6,
    initialData: {
      name: 'John Doe',
      email: 'john@acme.com',
      password: 'Str0ng!Pass',
      confirmPassword: 'Str0ng!Pass',
      orgName: 'Acme Corp',
      niche: 'retail',
      country: 'BR',
      language: 'pt-BR',
      timezone: 'America/Sao_Paulo',
      onboardingPath: 'default',
    },
  },
}

export const Step8_Plugins: Story = {
  name: '8. Plugins',
  args: {
    initialStep: 7,
    initialData: {
      name: 'John Doe',
      email: 'john@acme.com',
      password: 'Str0ng!Pass',
      confirmPassword: 'Str0ng!Pass',
      orgName: 'Acme Corp',
      niche: 'retail',
      country: 'BR',
      language: 'pt-BR',
      timezone: 'America/Sao_Paulo',
      onboardingPath: 'default',
      selectedRoutines: ['daily-sales-report', 'low-stock-alert'],
    },
  },
}
