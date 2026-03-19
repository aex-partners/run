import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, X } from 'lucide-react'

export interface EntityDeleteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityName: string
  rowCount: number
  onConfirm: () => void
}

export function EntityDeleteModal({ open, onOpenChange, entityName, rowCount, onConfirm }: EntityDeleteModalProps) {
  const [confirmText, setConfirmText] = useState('')
  const canDelete = confirmText === entityName

  const handleConfirm = () => {
    if (canDelete) {
      onConfirm()
      onOpenChange(false)
      setConfirmText('')
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 200,
        }} />
        <Dialog.Content style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--surface)',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
          padding: '24px',
          width: 420,
          maxWidth: '90vw',
          zIndex: 201,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />
              <Dialog.Title style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                Delete entity
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-muted)' }}>
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
            This action cannot be undone. This entity contains{' '}
            <strong style={{ color: 'var(--text)' }}>{rowCount.toLocaleString()}</strong>{' '}
            records that will be permanently deleted.
          </Dialog.Description>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)', marginBottom: 6 }}>
              Type <strong style={{ color: 'var(--text)' }}>{entityName}</strong> to confirm
            </label>
            <input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canDelete) handleConfirm() }}
              placeholder={entityName}
              style={{
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
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Dialog.Close asChild>
              <button style={{
                padding: '8px 16px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--surface)',
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
                color: 'var(--text)',
              }}>
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleConfirm}
              disabled={!canDelete}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: 6,
                background: canDelete ? 'var(--danger)' : 'var(--surface-2)',
                color: canDelete ? '#fff' : 'var(--text-muted)',
                fontSize: 13,
                fontWeight: 500,
                cursor: canDelete ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              Delete permanently
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
