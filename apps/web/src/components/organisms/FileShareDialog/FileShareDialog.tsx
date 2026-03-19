import { useState, useEffect, useRef } from 'react'
import {
  X, Link2, Copy, Check, Globe, Users, UserPlus, Trash2, ChevronDown,
} from 'lucide-react'
import { Button } from '../../atoms/Button/Button'
import { Avatar } from '../../atoms/Avatar/Avatar'

export type ShareAccess = 'viewer' | 'editor'

export interface SharedUser {
  id: string
  name: string
  email: string
  access: ShareAccess
}

export interface FileShareDialogProps {
  open: boolean
  fileName: string
  isFolder?: boolean
  publicLink?: string | null
  publicEnabled?: boolean
  sharedWith?: SharedUser[]
  onClose?: () => void
  onTogglePublic?: (enabled: boolean) => void
  onCopyLink?: () => void
  onAddUser?: (email: string, access: ShareAccess) => void
  onRemoveUser?: (userId: string) => void
  onChangeAccess?: (userId: string, access: ShareAccess) => void
}

export function FileShareDialog({
  open,
  fileName,
  isFolder = false,
  publicLink,
  publicEnabled = false,
  sharedWith = [],
  onClose,
  onTogglePublic,
  onCopyLink,
  onAddUser,
  onRemoveUser,
  onChangeAccess,
}: FileShareDialogProps) {
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteAccess, setInviteAccess] = useState<ShareAccess>('viewer')
  const [copied, setCopied] = useState(false)
  const [accessDropdownOpen, setAccessDropdownOpen] = useState<string | null>(null)
  const [inviteFeedback, setInviteFeedback] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!accessDropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.querySelector(`[data-dropdown="${accessDropdownOpen}"]`)?.contains(e.target as Node)) {
        setAccessDropdownOpen(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [accessDropdownOpen])

  if (!open) return null

  const handleCopy = () => {
    onCopyLink?.()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleInvite = () => {
    if (!inviteEmail.trim()) return
    onAddUser?.(inviteEmail.trim(), inviteAccess)
    setInviteEmail('')
    setInviteFeedback(true)
    setTimeout(() => setInviteFeedback(false), 2000)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)',
    }}>
      <div ref={dialogRef} style={{
        width: 480, maxHeight: '80vh',
        background: 'var(--surface)', borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              Share {isFolder ? 'folder' : 'file'}
            </h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fileName}</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Invite people */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 6 }}>
              <UserPlus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Invite people
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Enter email address"
                onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                style={{
                  flex: 1, padding: '8px 10px', borderRadius: 6,
                  border: '1px solid var(--border)', background: 'var(--surface-2)',
                  color: 'var(--text)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
                }}
              />
              <select
                value={inviteAccess}
                onChange={(e) => setInviteAccess(e.target.value as ShareAccess)}
                style={{
                  padding: '8px 8px', borderRadius: 6,
                  border: '1px solid var(--border)', background: 'var(--surface-2)',
                  color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
              </select>
              <Button variant="primary" size="sm" onClick={handleInvite}>
                {inviteFeedback ? 'Invited!' : 'Invite'}
              </Button>
            </div>
            {inviteFeedback && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Check size={12} color="#059669" />
                <span style={{ fontSize: 11, color: '#059669' }}>Invitation sent</span>
              </div>
            )}
          </div>

          {/* Shared with list */}
          {sharedWith.length > 0 && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'block', marginBottom: 8 }}>
                <Users size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Shared with ({sharedWith.length})
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {sharedWith.map((user) => (
                  <div key={user.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 8px', borderRadius: 6,
                    background: 'var(--surface-2)',
                  }}>
                    <Avatar name={user.name} size="sm" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{user.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{user.email}</div>
                    </div>
                    <div style={{ position: 'relative' }} data-dropdown={user.id}>
                      <button
                        onClick={() => setAccessDropdownOpen(accessDropdownOpen === user.id ? null : user.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 2,
                          background: 'none', border: '1px solid var(--border)', borderRadius: 4,
                          padding: '3px 8px', cursor: 'pointer',
                          fontSize: 11, color: 'var(--text)', fontFamily: 'inherit',
                        }}
                      >
                        {user.access === 'editor' ? 'Editor' : 'Viewer'}
                        <ChevronDown size={10} />
                      </button>
                      {accessDropdownOpen === user.id && (
                        <div style={{
                          position: 'absolute', top: '100%', right: 0, marginTop: 2,
                          background: 'var(--surface)', border: '1px solid var(--border)',
                          borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          zIndex: 10, overflow: 'hidden', minWidth: 100,
                        }}>
                          <button
                            onClick={() => { onChangeAccess?.(user.id, 'viewer'); setAccessDropdownOpen(null) }}
                            style={{
                              width: '100%', padding: '6px 10px', background: user.access === 'viewer' ? 'var(--accent-light)' : 'none',
                              border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text)',
                              textAlign: 'left', fontFamily: 'inherit',
                            }}
                          >
                            Viewer
                          </button>
                          <button
                            onClick={() => { onChangeAccess?.(user.id, 'editor'); setAccessDropdownOpen(null) }}
                            style={{
                              width: '100%', padding: '6px 10px', background: user.access === 'editor' ? 'var(--accent-light)' : 'none',
                              border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text)',
                              textAlign: 'left', fontFamily: 'inherit',
                            }}
                          >
                            Editor
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => onRemoveUser?.(user.id)}
                      title="Remove"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-muted)' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Public link */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Globe size={12} />
                Public link
              </label>
              <button
                onClick={() => onTogglePublic?.(!publicEnabled)}
                role="switch"
                aria-checked={publicEnabled}
                style={{
                  width: 36, height: 20, borderRadius: 10, padding: 2,
                  background: publicEnabled ? 'var(--accent)' : 'var(--border)',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                  transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#fff',
                  transform: publicEnabled ? 'translateX(16px)' : 'translateX(0)',
                  transition: 'transform 0.2s',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                }} />
              </button>
            </div>
            {publicEnabled && publicLink && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 10px', borderRadius: 6,
                background: 'var(--surface-2)', border: '1px solid var(--border)',
              }}>
                <Link2 size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <span style={{
                  flex: 1, fontSize: 12, color: 'var(--text)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {publicLink}
                </span>
                <button
                  onClick={handleCopy}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                    display: 'flex', color: copied ? '#059669' : 'var(--text-muted)',
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            )}
            {publicEnabled && !publicLink && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Generating link...</span>
            )}
            {!publicEnabled && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Enable to create a public link anyone with the URL can access.
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <Button variant="secondary" size="sm" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  )
}

export default FileShareDialog
