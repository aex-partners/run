import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ConversationList, type Contact, type Conversation } from './ConversationList'

const CONVS: Conversation[] = [
  { id: 'c1', name: 'Buenaça', lastMessage: 'ola tudo bem', timestamp: 'now', type: 'dm' },
]
const CONTACTS: Contact[] = [
  { kind: 'user', id: 'u1', name: 'Olavo Silva', subtitle: 'olavo@t.local' },
  { kind: 'eric', id: 'eric', name: 'Eric', subtitle: 'assistant' },
]

describe('ConversationList contacts search', () => {
  it('shows the contacts section only when searching', async () => {
    render(<ConversationList conversations={CONVS} contacts={CONTACTS} />)
    expect(screen.queryByText('Contacts')).toBeNull()
    await userEvent.type(screen.getByLabelText('Search...'), 'ola')
    expect(screen.getByText('Contacts')).toBeInTheDocument()
    expect(screen.getByText('Olavo Silva')).toBeInTheDocument()
  })

  it('calls onOpenDm for a user contact and onOpenEric for Eric', async () => {
    const onOpenDm = vi.fn()
    const onOpenEric = vi.fn()
    render(
      <ConversationList
        conversations={CONVS}
        contacts={CONTACTS}
        onOpenDm={onOpenDm}
        onOpenEric={onOpenEric}
      />,
    )
    await userEvent.type(screen.getByLabelText('Search...'), 'olavo')
    await userEvent.click(screen.getByText('Olavo Silva'))
    expect(onOpenDm).toHaveBeenCalledWith('u1')

    await userEvent.clear(screen.getByLabelText('Search...'))
    await userEvent.type(screen.getByLabelText('Search...'), 'eric')
    await userEvent.click(screen.getByText('Eric'))
    expect(onOpenEric).toHaveBeenCalled()
  })
})
