import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { Confirmation } from './Confirmation'

const meta: Meta<typeof Confirmation> = {
  title: 'Molecules/Confirmation',
  component: Confirmation,
  tags: ['ai'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  argTypes: {
    state: { control: 'radio', options: ['requested', 'accepted', 'rejected', 'pending'] },
    onApprove: { action: 'approved' },
    onReject: { action: 'rejected' },
  },
  args: { onApprove: fn(), onReject: fn() },
}
export default meta
type Story = StoryObj<typeof Confirmation>

export const Requested: Story = {
  args: {
    title: 'Transferir R$ 15.000 para conta de fornecedor?',
    description: 'Pagamento ao fornecedor Silva & Cia referente NF #4521.',
    state: 'requested',
  },
}

export const Accepted: Story = {
  args: {
    title: 'Transferencia aprovada',
    description: 'Pagamento de R$ 15.000 confirmado.',
    state: 'accepted',
  },
}

export const Rejected: Story = {
  args: {
    title: 'Transferencia rejeitada',
    description: 'O pagamento nao foi autorizado.',
    state: 'rejected',
  },
}

export const Pending: Story = {
  args: {
    title: 'Aguardando aprovacao do gerente',
    state: 'pending',
  },
}

export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Confirmation
        title="Criar nova tabela de produtos?"
        state="requested"
        onApprove={fn()}
        onReject={fn()}
      />
      <Confirmation
        title="Tabela de produtos criada"
        state="accepted"
      />
      <Confirmation
        title="Criacao de tabela cancelada"
        state="rejected"
      />
      <Confirmation
        title="Aguardando aprovacao do admin"
        state="pending"
      />
    </div>
  ),
}
