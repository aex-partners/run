import { AlertTriangle, ShieldAlert, X } from 'lucide-react'
import { Button } from '../../atoms/Button/Button'

export interface FileDeleteDialogProps {
  open: boolean
  fileNames: string[]
  isFolder?: boolean
  hasPermission?: boolean
  onConfirm?: () => void
  onClose?: () => void
}

export function FileDeleteDialog({
  open,
  fileNames,
  isFolder = false,
  hasPermission = true,
  onConfirm,
  onClose,
}: FileDeleteDialogProps) {
  if (!open) return null

  const count = fileNames.length
  const itemLabel = isFolder ? (count === 1 ? 'folder' : 'folders') : (count === 1 ? 'file' : 'files')

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.4)',
    }}>
      <div style={{
        width: 420,
        background: 'var(--surface)', borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {hasPermission ? (
              <AlertTriangle size={18} color="#dc2626" />
            ) : (
              <ShieldAlert size={18} color="#dc2626" />
            )}
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
              {hasPermission ? `Delete ${itemLabel}` : 'Permission denied'}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px' }}>
          {hasPermission ? (
            <>
              <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: '0 0 12px' }}>
                Are you sure you want to delete {count === 1 ? 'this' : 'these'} {count > 1 ? `${count} ` : ''}{itemLabel}?
                This action cannot be undone.
              </p>
              {count <= 5 ? (
                <div style={{
                  padding: '8px 12px', borderRadius: 6,
                  background: '#fef2f2', border: '1px solid #fecaca',
                  display: 'flex', flexDirection: 'column', gap: 4,
                }}>
                  {fileNames.map((name, i) => (
                    <span key={i} style={{ fontSize: 12, color: '#991b1b', fontWeight: 500 }}>
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{
                  padding: '8px 12px', borderRadius: 6,
                  background: '#fef2f2', border: '1px solid #fecaca',
                }}>
                  <span style={{ fontSize: 12, color: '#991b1b', fontWeight: 500 }}>
                    {count} {itemLabel} will be permanently deleted.
                  </span>
                </div>
              )}
              {isFolder && (
                <p style={{ fontSize: 12, color: '#dc2626', marginTop: 8, marginBottom: 0 }}>
                  All files and subfolders inside will also be deleted.
                </p>
              )}
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: '0 0 12px' }}>
                You do not have permission to delete {count === 1 ? 'this' : 'these'} {itemLabel}.
              </p>
              <div style={{
                padding: '10px 12px', borderRadius: 6,
                background: '#fef2f2', border: '1px solid #fecaca',
              }}>
                <span style={{ fontSize: 12, color: '#991b1b' }}>
                  Contact the file owner or an administrator to request access.
                </span>
              </div>
              {count <= 5 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {fileNames.map((name, i) => (
                    <span key={i} style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {hasPermission ? 'Cancel' : 'Close'}
          </Button>
          {hasPermission && (
            <Button variant="danger" size="sm" onClick={onConfirm}>
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default FileDeleteDialog
