import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReminderCard } from './ReminderCard'

// Mutable fixtures the mocked hooks read from, so each test sets its own state.
let taskData: unknown = undefined
let authUser: { id: string } | null = { id: 'u1' }

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({ user: authUser }),
}))

vi.mock('../../../platform/trpc', () => ({
  trpc: {
    useUtils: () => ({ tasks: { getById: { invalidate: vi.fn() }, list: { invalidate: vi.fn() } } }),
    tasks: {
      getById: { useQuery: () => ({ data: taskData }) },
      snooze: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      acknowledge: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}))

describe('ReminderCard isolation gating', () => {
  beforeEach(() => {
    taskData = undefined
    authUser = { id: 'u1' }
  })

  it('renders nothing when the task is not visible (getById returned null)', () => {
    taskData = null
    const { container } = render(<ReminderCard taskId="t1" title="Ship invoice" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when the current user is not an assignee', () => {
    // Task visible, but assignees do not include the current user (u1).
    taskData = { id: 't1', title: 'Ship invoice', status: 'pending', assigneeIds: ['someone-else'] }
    const { container } = render(<ReminderCard taskId="t1" title="Ship invoice" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the card when the current user is an assignee', () => {
    taskData = { id: 't1', title: 'Ship invoice', status: 'pending', assigneeIds: ['u1'] }
    render(<ReminderCard taskId="t1" title="Ship invoice" />)
    expect(screen.getByText('Ship invoice')).toBeInTheDocument()
  })
})
