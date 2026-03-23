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

export const Step8_Email: Story = {
  name: '8. Email',
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

export const Step9_AI_OpenAI: Story = {
  name: '9. AI (OpenAI)',
  args: {
    initialStep: 8,
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
      aiProvider: 'openai',
    },
  },
}

export const Step9_AI_Ollama: Story = {
  name: '9. AI (Ollama)',
  args: {
    initialStep: 8,
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
      aiProvider: 'ollama',
      aiOllamaModel: 'qwen3:14b',
    },
  },
}

export const Step9_AI_OpenRouter: Story = {
  name: '9. AI (OpenRouter)',
  args: {
    initialStep: 8,
    openRouterConnected: true,
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
      aiProvider: 'openrouter',
    },
  },
}

export const Step10_Plugins: Story = {
  name: '10. Plugins',
  args: {
    initialStep: 9,
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
      aiProvider: 'openai',
    },
  },
}
