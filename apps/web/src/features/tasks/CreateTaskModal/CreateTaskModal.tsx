import { useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import * as Dialog from '@radix-ui/react-dialog'
import { CheckSquare, X } from 'lucide-react'
import { trpc } from '../../../platform/trpc'

export interface CreateTaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: () => void
}

type Kind = 'task' | 'reminder' | 'approval'

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 13,
  color: 'var(--text)',
  background: 'var(--surface)',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--text-muted)',
  marginBottom: 6,
}

export function CreateTaskModal({ open, onOpenChange, onCreated }: CreateTaskModalProps) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [kind, setKind] = useState<Kind>('task')
  const [dueAt, setDueAt] = useState('')

  const usersQuery = trpc.users.listAssignable.useQuery(undefined, { enabled: open })
  const createMut = trpc.tasks.create.useMutation({
    onSuccess: () => {
      onCreated?.()
      reset()
      onOpenChange(false)
    },
  })

  const canSubmit = title.trim().length > 0 && assigneeIds.length > 0 && !createMut.isPending

  function reset() {
    setTitle('')
    setDescription('')
    setAssigneeIds([])
    setKind('task')
    setDueAt('')
  }

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function handleSubmit() {
    if (!canSubmit) return
    createMut.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      assigneeIds,
      kind,
      dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
    })
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  const users = usersQuery.data ?? []

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }} />
        <Dialog.Content style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--surface)',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
          padding: '24px',
          width: 460,
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflowY: 'auto',
          zIndex: 201,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckSquare size={18} style={{ color: 'var(--accent)' }} />
              <Dialog.Title style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                {t('tasks.createTask')}
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-muted)' }} aria-label={t('clear')}>
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{t('tasks.taskTitle')}</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('tasks.taskTitlePlaceholder')}
              autoFocus
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{t('tasks.taskDescription')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{t('tasks.assignTo')}</label>
            {usersQuery.isLoading ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, padding: 6 }}>
                {users.map((u) => {
                  const checked = assigneeIds.includes(u.id)
                  return (
                    <label
                      key={u.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 5, cursor: 'pointer', background: checked ? 'var(--accent-light)' : 'transparent' }}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggleAssignee(u.id)} />
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>{u.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{u.email}</span>
                    </label>
                  )
                })}
                {users.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('tasks.noAssignees')}</span>}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('tasks.kind')}</label>
              <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} style={inputStyle}>
                <option value="task">{t('tasks.kindTask')}</option>
                <option value="reminder">{t('tasks.kindReminder')}</option>
                <option value="approval">{t('tasks.kindApproval')}</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>{t('tasks.dueAt')}</label>
              <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Dialog.Close asChild>
              <button style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text)' }}>
                {t('cancel')}
              </button>
            </Dialog.Close>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: 6,
                background: canSubmit ? 'var(--accent)' : 'var(--surface-2)',
                color: canSubmit ? '#fff' : 'var(--text-muted)',
                fontSize: 13,
                fontWeight: 500,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              {t('tasks.createTask')}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default CreateTaskModal
