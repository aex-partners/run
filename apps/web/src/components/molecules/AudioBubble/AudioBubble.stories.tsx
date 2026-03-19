import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { AudioBubble } from './AudioBubble'

const sampleWaveform = [
  0.2, 0.4, 0.6, 0.8, 0.5, 0.3, 0.7, 0.9, 0.6, 0.4,
  0.8, 1.0, 0.7, 0.5, 0.3, 0.6, 0.8, 0.4, 0.2, 0.5,
  0.7, 0.9, 0.6, 0.3, 0.5, 0.8, 0.4, 0.6, 0.7, 0.3,
  0.5, 0.8, 0.6, 0.4, 0.9, 0.7, 0.5, 0.3, 0.6, 0.4,
]

const meta: Meta<typeof AudioBubble> = {
  title: 'Molecules/AudioBubble',
  component: AudioBubble,
  tags: ['chat'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  args: {
    onTranscriptionEdit: fn(),
  },
  decorators: [(Story) => <div style={{ maxWidth: 340 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof AudioBubble>

export const WithTranscription: Story = {
  args: {
    url: 'https://example.com/audio.mp3',
    duration: '0:42',
    waveform: sampleWaveform,
    transcription: 'Preciso que voce envie o relatorio de vendas do mes passado ate amanha.',
    isOwner: true,
  },
}

export const WithoutTranscription: Story = {
  args: {
    url: 'https://example.com/audio.mp3',
    duration: '0:18',
    waveform: sampleWaveform,
    isOwner: true,
  },
}

export const EditedTranscription: Story = {
  args: {
    url: 'https://example.com/audio.mp3',
    duration: '0:42',
    waveform: sampleWaveform,
    transcription: 'Relatorio de vendas corrigido: total de R$ 148.320 no trimestre.',
    transcriptionEdited: true,
    isOwner: true,
  },
}

export const NotOwner: Story = {
  args: {
    url: 'https://example.com/audio.mp3',
    duration: '0:55',
    waveform: sampleWaveform,
    transcription: 'A reuniao com o fornecedor foi remarcada para quinta-feira as 15h.',
    isOwner: false,
  },
}

export const LongTranscription: Story = {
  args: {
    url: 'https://example.com/audio.mp3',
    duration: '2:15',
    waveform: sampleWaveform,
    transcription: 'Bom dia equipe. Queria atualizar voces sobre o andamento do projeto de importacao. Ontem conseguimos finalizar a integracao com o sistema do fornecedor TechParts. Os dados estao sendo sincronizados a cada 30 minutos. Ainda precisamos ajustar os mapeamentos de categoria e validar os precos antes de colocar em producao. A previsao e que isso fique pronto ate sexta-feira. Carlos, preciso que voce revise os contratos antes disso.',
    isOwner: true,
  },
}
