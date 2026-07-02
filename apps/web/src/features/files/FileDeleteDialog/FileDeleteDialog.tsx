import { AlertTriangle, ShieldAlert, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../shared/ui/Button/Button'

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
  const { t } = useTranslation()

  if (!open) return null

  const count = fileNames.length
  const itemLabel = isFolder
    ? t('fileDeleteDialog.folder', { count })
    : t('fileDeleteDialog.file', { count })

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
              {hasPermission ? t('fileDeleteDialog.title', { itemLabel }) : t('fileDeleteDialog.permissionDenied')}
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
                {t('fileDeleteDialog.confirmMessage', { count, itemLabel })}{' '}
                {t('fileDeleteDialog.cannotBeUndone')}
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
                    {t('fileDeleteDialog.willBeDeleted', { count, itemLabel })}
                  </span>
                </div>
              )}
              {isFolder && (
                <p style={{ fontSize: 12, color: '#dc2626', marginTop: 8, marginBottom: 0 }}>
                  {t('fileDeleteDialog.subfoldersWarning')}
                </p>
              )}
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, margin: '0 0 12px' }}>
                {t('fileDeleteDialog.noPermissionMessage', { count, itemLabel })}
              </p>
              <div style={{
                padding: '10px 12px', borderRadius: 6,
                background: '#fef2f2', border: '1px solid #fecaca',
              }}>
                <span style={{ fontSize: 12, color: '#991b1b' }}>
                  {t('fileDeleteDialog.contactOwner')}
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
            {hasPermission ? t('cancel') : t('close')}
          </Button>
          {hasPermission && (
            <Button variant="danger" size="sm" onClick={onConfirm}>
              {t('delete')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default FileDeleteDialog
