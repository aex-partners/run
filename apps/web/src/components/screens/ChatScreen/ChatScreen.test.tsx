import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeAll } from 'vitest'
import { ChatScreen } from './ChatScreen'

// ConversationList uses Radix ScrollArea which needs ResizeObserver
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

const mockConversations = [
  { id: 'c1', name: 'Test Chat', type: 'ai' as const, lastMessage: 'Hello', timestamp: 'now' },
]

const mockMessages = [
  { id: 'm1', role: 'user' as const, content: 'Hello', author: 'User' },
]

const mockAgents = [
  { id: 'agent-1', name: 'Sales Agent' },
  { id: 'agent-2', name: 'Support Agent' },
]

describe('ChatScreen', () => {
  it('renders conversation list and main area', () => {
    render(
      <ChatScreen
        conversations={mockConversations}
        messages={mockMessages}
        activeConversationId="c1"
      />
    )
    // "Test Chat" appears in both the sidebar list and the header
    expect(screen.getAllByText('Test Chat').length).toBeGreaterThanOrEqual(1)
    // "Hello" appears as lastMessage in sidebar and as message content
    expect(screen.getAllByText('Hello').length).toBeGreaterThanOrEqual(1)
  })

  it('shows agent selector when agents prop is provided and conversation is AI type', () => {
    render(
      <ChatScreen
        conversations={mockConversations}
        messages={mockMessages}
        activeConversationId="c1"
        agents={mockAgents}
        onSetAgent={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: 'Select agent' })).toBeInTheDocument()
  })

  it('agent selector shows "Default" option and agent list', async () => {
    const user = userEvent.setup()
    render(
      <ChatScreen
        conversations={mockConversations}
        messages={mockMessages}
        activeConversationId="c1"
        agents={mockAgents}
        onSetAgent={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Select agent' }))

    expect(screen.getByText('Default')).toBeInTheDocument()
    // Agents appear in the dropdown list (in addition to possible other occurrences)
    expect(screen.getAllByText('Sales Agent').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Support Agent').length).toBeGreaterThanOrEqual(1)
  })

  it('clicking an agent option calls onSetAgent with agent id', async () => {
    const user = userEvent.setup()
    const onSetAgent = vi.fn()
    render(
      <ChatScreen
        conversations={mockConversations}
        messages={mockMessages}
        activeConversationId="c1"
        agents={mockAgents}
        onSetAgent={onSetAgent}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Select agent' }))
    // The dropdown items have the agent name as text within a button. Find the dropdown option.
    const agentButtons = screen.getAllByText('Sales Agent')
    // Click the one inside the dropdown (the last occurrence since the button label text comes first)
    await user.click(agentButtons[agentButtons.length - 1])

    expect(onSetAgent).toHaveBeenCalledWith('agent-1')
  })

  it('clicking "Default" calls onSetAgent with null', async () => {
    const user = userEvent.setup()
    const onSetAgent = vi.fn()
    render(
      <ChatScreen
        conversations={mockConversations}
        messages={mockMessages}
        activeConversationId="c1"
        agents={mockAgents}
        activeAgent={mockAgents[0]}
        onSetAgent={onSetAgent}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Select agent' }))
    await user.click(screen.getByText('Default'))

    expect(onSetAgent).toHaveBeenCalledWith(null)
  })

  it('header shows agent name when activeAgent is set', () => {
    render(
      <ChatScreen
        conversations={mockConversations}
        messages={mockMessages}
        activeConversationId="c1"
        agents={mockAgents}
        activeAgent={mockAgents[0]}
        onSetAgent={vi.fn()}
      />
    )
    // The agent name appears in the status area and in the selector button.
    // Verify at least one instance of the agent name is rendered.
    const matches = screen.getAllByText('Sales Agent')
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  it('header shows status label when no activeAgent', () => {
    render(
      <ChatScreen
        conversations={mockConversations}
        messages={mockMessages}
        activeConversationId="c1"
      />
    )
    expect(screen.getByText('AI Agent')).toBeInTheDocument()
  })
})
