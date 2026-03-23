import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { Avatar } from '../../atoms/Avatar/Avatar'
import { Badge } from '../../atoms/Badge/Badge'
import { Button } from '../../atoms/Button/Button'

export interface User {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'inactive' | 'pending'
}

export interface UserTableProps {
  users: User[]
  onEdit?: (userId: string) => void
  onInvite?: () => void
  onDelete?: (userId: string) => void
  onChangeRole?: (userId: string, role: string) => void
  onChangeStatus?: (userId: string, status: string) => void
}

const ROLES = ['Administrator', 'Manager', 'Sales Rep', 'Stock Clerk', 'Finance', 'Support']

const STATUS_CYCLE: User['status'][] = ['active', 'pending', 'inactive']

const statusBadgeMap: Record<User['status'], { variant: 'success' | 'neutral' | 'warning'; label: string }> = {
  active: { variant: 'success', label: 'Active' },
  inactive: { variant: 'neutral', label: 'Inactive' },
  pending: { variant: 'warning', label: 'Pending' },
}

export function UserTable({ users: initialUsers, onEdit, onInvite, onDelete, onChangeRole, onChangeStatus }: UserTableProps) {
  const { t } = useTranslation()
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Keep local state in sync if parent re-renders with new users
  React.useEffect(() => {
    setUsers(initialUsers)
    setSelectedIds(new Set())
  }, [initialUsers])

  const handleDelete = (userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId))
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(userId)
      return next
    })
    onDelete?.(userId)
  }

  const handleRoleChange = (userId: string, role: string) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)))
    setEditingRoleId(null)
    onChangeRole?.(userId, role)
  }

  const handleStatusClick = (user: User) => {
    const currentIndex = STATUS_CYCLE.indexOf(user.status)
    const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length]
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)))
    onChangeStatus?.(user.id, nextStatus)
  }

  const allSelected = users.length > 0 && selectedIds.size === users.length
  const someSelected = selectedIds.size > 0 && !allSelected

  const toggleSelectAll = () => {
    if (allSelected || someSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(users.map((u) => u.id)))
    }
  }

  const toggleSelectRow = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const handleDeleteSelected = () => {
    selectedIds.forEach((id) => onDelete?.(id))
    setUsers((prev) => prev.filter((u) => !selectedIds.has(u.id)))
    setSelectedIds(new Set())
  }

  const checkboxStyle: React.CSSProperties = {
    width: 15,
    height: 15,
    cursor: 'pointer',
    accentColor: 'var(--accent)',
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('settings.users')}</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{users.length} users in the organization</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button variant="primary" leftIcon={<Plus size={14} />} onClick={onInvite}>
            Invite User
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            marginBottom: 8,
            background: 'var(--danger-light)',
            borderRadius: 8,
            border: '1px solid var(--danger)',
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--danger)', flex: 1 }}>
            {selectedIds.size} user{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          <Button variant="danger" size="sm" leftIcon={<Trash2 size={12} />} onClick={handleDeleteSelected}>
            Delete selected
          </Button>
        </div>
      )}

      {users.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          No users found
        </div>
      ) : (
        <div
          role="table"
          style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}
        >
          {/* Header */}
          <div
            role="rowgroup"
          >
            <div
              role="row"
              style={{
                display: 'grid',
                gridTemplateColumns: '36px 1fr 1fr 170px 130px 80px',
                padding: '10px 16px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface-2)',
                alignItems: 'center',
              }}
            >
              <div role="columnheader">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected
                  }}
                  onChange={toggleSelectAll}
                  aria-label={t('settings.selectAllUsers')}
                  style={checkboxStyle}
                />
              </div>
              {['User', 'Email', 'Role', 'Status', ''].map((h, i) => (
                <span
                  key={i}
                  role="columnheader"
                  style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}
                >
                  {h}
                </span>
              ))}
            </div>
          </div>

          <div role="rowgroup">
            {users.map((user, i) => {
              const isHovered = hoveredRow === user.id
              const isSelected = selectedIds.has(user.id)

              return (
                <div
                  key={user.id}
                  role="row"
                  onMouseEnter={() => setHoveredRow(user.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '36px 1fr 1fr 170px 130px 80px',
                    padding: '12px 16px',
                    borderBottom: i < users.length - 1 ? '1px solid var(--border)' : 'none',
                    alignItems: 'center',
                    background: isSelected ? 'var(--accent-light)' : isHovered ? 'var(--surface-2)' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  <div role="cell">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectRow(user.id)}
                      aria-label={t('settings.selectUser')}
                      style={checkboxStyle}
                    />
                  </div>

                  <div role="cell" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar name={user.name} size="md" />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{user.name}</span>
                  </div>

                  <div role="cell">
                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user.email}</span>
                  </div>

                  {/* Role cell */}
                  <div role="cell">
                    {editingRoleId === user.id || (isHovered && editingRoleId === null) ? (
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        onFocus={() => setEditingRoleId(user.id)}
                        onBlur={() => setEditingRoleId(null)}
                        autoFocus={editingRoleId === user.id}
                        aria-label={`Change role for ${user.name}`}
                        style={{
                          fontSize: 13,
                          color: 'var(--text)',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: 5,
                          padding: '3px 6px',
                          fontFamily: 'inherit',
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    ) : (
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>{user.role}</span>
                    )}
                  </div>

                  {/* Status cell */}
                  <div role="cell">
                    <span
                      onClick={() => handleStatusClick(user)}
                      aria-label={`Status: ${statusBadgeMap[user.status].label}, click to change`}
                      style={{ cursor: 'pointer', display: 'inline-flex' }}
                      title={t('settings.cycleStatus')}
                    >
                      <Badge variant={statusBadgeMap[user.status].variant}>
                        {statusBadgeMap[user.status].label}
                      </Badge>
                    </span>
                  </div>

                  {/* Actions cell */}
                  <div role="cell" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      onClick={() => onEdit?.(user.id)}
                      aria-label={`Edit ${user.name}`}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: 12,
                        padding: '4px 8px',
                        borderRadius: 5,
                        fontFamily: 'inherit',
                      }}
                    >
                      Edit
                    </button>
                    {isHovered && (
                      <button
                        onClick={() => handleDelete(user.id)}
                        aria-label={`Delete ${user.name}`}
                        title={t('settings.deleteUser')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--danger)',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: 5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default UserTable
