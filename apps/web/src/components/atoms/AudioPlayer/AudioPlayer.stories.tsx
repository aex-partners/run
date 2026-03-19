import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { AudioPlayer } from './AudioPlayer'

const sampleWaveform = [
  0.2, 0.4, 0.6, 0.8, 0.5, 0.3, 0.7, 0.9, 0.6, 0.4,
  0.8, 1.0, 0.7, 0.5, 0.3, 0.6, 0.8, 0.4, 0.2, 0.5,
  0.7, 0.9, 0.6, 0.3, 0.5, 0.8, 0.4, 0.6, 0.7, 0.3,
  0.5, 0.8, 0.6, 0.4, 0.9, 0.7, 0.5, 0.3, 0.6, 0.4,
]

const meta: Meta<typeof AudioPlayer> = {
  title: 'Atoms/AudioPlayer',
  component: AudioPlayer,
  tags: ['chat'],
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'light', values: [{ name: 'light', value: '#f9fafb' }] },
  },
  args: {
    onPlayStateChange: fn(),
  },
  decorators: [(Story) => <div style={{ maxWidth: 320 }}><Story /></div>],
}
export default meta
type Story = StoryObj<typeof AudioPlayer>

export const Default: Story = {
  args: {
    url: 'https://example.com/audio.mp3',
    duration: '0:42',
    waveform: sampleWaveform,
  },
}

export const NoWaveform: Story = {
  args: {
    url: 'https://example.com/audio.mp3',
    duration: '1:15',
  },
}

export const ShortClip: Story = {
  args: {
    url: 'https://example.com/short.mp3',
    duration: '0:05',
    waveform: [0.3, 0.6, 0.9, 0.7, 0.4, 0.2, 0.5, 0.8, 0.6, 0.3],
  },
}

export const LongClip: Story = {
  args: {
    url: 'https://example.com/long.mp3',
    duration: '5:32',
    waveform: [
      0.1, 0.3, 0.5, 0.7, 0.4, 0.6, 0.8, 0.5, 0.3, 0.7,
      0.9, 0.6, 0.4, 0.8, 1.0, 0.7, 0.5, 0.3, 0.6, 0.8,
      0.4, 0.2, 0.5, 0.7, 0.9, 0.6, 0.3, 0.5, 0.8, 0.4,
      0.6, 0.7, 0.3, 0.5, 0.8, 0.6, 0.4, 0.9, 0.7, 0.5,
      0.3, 0.6, 0.4, 0.7, 0.5, 0.8, 0.6, 0.3, 0.4, 0.7,
    ],
  },
}
