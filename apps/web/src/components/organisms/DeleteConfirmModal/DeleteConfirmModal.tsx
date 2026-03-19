import React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useTranslation } from 'react-i18next'

export interface DeleteConfirmModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleteForEveryone: () => void
  onDeleteForMe: () => void
}

export function DeleteConfirmModal({ open, onOpenChange, onDeleteForEveryone, onDeleteForMe }: DeleteConfirmModalProps) {
  const { t } = useTranslation()
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 1000,
          }}
        />
        <Dialog.Content
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 340,
            background: 'var(--surface)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            zIndex: 1001,
            padding: '24px 28px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <Dialog.Title style={{ fontSize: 16, fontWeight: 600, margin: 0, textAlign: 'center' }}>
            {t('chat.contextMenu.delete.title')}
          </Dialog.Title>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
            <button
              onClick={() => {
                onDeleteForEveryone()
                onOpenChange(false)
              }}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid var(--danger)',
                background: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontFamily: 'inherit',
                color: 'var(--danger)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--danger-light)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'none'
              }}
            >
              {t('chat.contextMenu.delete.forEveryone')}
            </button>

            <button
              onClick={() => {
                onDeleteForMe()
                onOpenChange(false)
              }}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontFamily: 'inherit',
                color: 'var(--text)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'none'
              }}
            >
              {t('chat.contextMenu.delete.forMe')}
            </button>

            <Dialog.Close asChild>
              <button
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  color: 'var(--text-muted)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'none'
                }}
              >
                {t('cancel')}
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default DeleteConfirmModal
